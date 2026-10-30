/**
 * Third-Party Import Integration Test Suite (Letterboxd, IMDb, and Normalized CSVs)
 * Tests full-file parsing fidelity, formula injection defense, and field mapping for KeepMoviEZ v6.0.0.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const sandbox = {
    console,
    Math,
    String,
    Number,
    Array,
    Object,
    parseFloat,
    parseInt,
    isNaN,
    encodeURIComponent,
    decodeURIComponent,
    generateUUID: () => 'uuid-import-123',
    document: {
        createElement: () => ({ click: () => {}, setAttribute: () => {} }),
        body: { appendChild: () => {}, removeChild: () => {} }
    },
    URL: { createObjectURL: () => 'blob:mock', revokeObjectURL: () => {} },
    Blob: class Blob {}
};
sandbox.window = sandbox;

vm.createContext(sandbox);
const utilsCode = fs.readFileSync(path.join(__dirname, '../js/utils.js'), 'utf8');
vm.runInContext(utilsCode, sandbox);
const code = fs.readFileSync(path.join(__dirname, '../js/input-output.js'), 'utf8');
vm.runInContext(code, sandbox);

test('Import: Real-world Letterboxd diary export parsed accurately', () => {
    const rawDiary = [
        {
            Date: '2024-11-20',
            Name: 'Spirited Away',
            Year: '2001',
            'Letterboxd URI': 'https://boxd.it/2aek',
            Rating: '5.0',
            Rewatch: 'Yes',
            Tags: 'anime, ghibli, miyazaki',
            'Watched Date': '2024-11-20'
        },
        {
            Date: '2025-01-05',
            Name: 'Severance',
            Year: '2022',
            'Letterboxd URI': 'https://boxd.it/uH9C',
            Rating: '4.5',
            Rewatch: 'No',
            Tags: 'tv, scifi',
            'Watched Date': '2025-01-05'
        }
    ];

    const entries = rawDiary.map(row => sandbox.normalizeImportedRow(row));

    assert.equal(entries.length, 2);

    // Entry 1
    assert.equal(entries[0].Name, 'Spirited Away');
    assert.equal(entries[0].Year, '2001');
    assert.equal(entries[0].Category, 'Movie');
    assert.equal(entries[0].Status, 'Watched');
    assert.equal(entries[0].overallRating, '5');
    assert.equal(entries[0].watchHistory.length, 1);
    assert.equal(entries[0].watchHistory[0].date, '2024-11-20');
    assert.equal(entries[0].watchHistory[0].rating, 5.0);

    // Entry 2
    assert.equal(entries[1].Name, 'Severance');
    assert.equal(entries[1].Year, '2022');
    assert.equal(entries[1].overallRating, '4.5');
    assert.equal(entries[1].watchHistory[0].date, '2025-01-05');
});

test('Import: Real-world IMDb rating export parsed accurately', () => {
    const rawImdb = [
        {
            Const: 'tt0068646',
            'Your Rating': '10',
            'Date Rated': '2023-04-12',
            Title: 'The Godfather',
            URL: 'https://www.imdb.com/title/tt0068646/',
            'Title Type': 'movie',
            'IMDb Rating': '9.2',
            'Runtime (mins)': '175',
            Year: '1972',
            Genres: 'Crime, Drama',
            'Num Votes': '2000000',
            'Release Date': '1972-03-24',
            Directors: 'Francis Ford Coppola'
        },
        {
            Const: 'tt0944947',
            'Your Rating': '9',
            'Date Rated': '2022-08-15',
            Title: 'Game of Thrones',
            URL: 'https://www.imdb.com/title/tt0944947/',
            'Title Type': 'tvSeries',
            'IMDb Rating': '9.2',
            'Runtime (mins)': '57',
            Year: '2011',
            Genres: 'Action, Adventure, Drama',
            'Num Votes': '2200000',
            'Release Date': '2011-04-17',
            Directors: 'David Benioff, D.B. Weiss'
        }
    ];

    const entries = rawImdb.map(row => sandbox.normalizeImportedRow(row));

    assert.equal(entries.length, 2);

    // Entry 1
    assert.equal(entries[0].Name, 'The Godfather');
    assert.equal(entries[0].Year, '1972');
    assert.equal(entries[0].Category, 'Movie');
    assert.equal(entries[0].Status, 'Watched');
    assert.equal(entries[0].overallRating, '10');
    assert.equal(entries[0].imdb_id, 'tt0068646');
    assert.equal(entries[0].watchHistory.length, 1);
    assert.equal(entries[0].watchHistory[0].date, '2023-04-12');

    // Entry 2 (TV Series detection)
    assert.equal(entries[1].Name, 'Game of Thrones');
    assert.equal(entries[1].Year, '2011');
    assert.equal(entries[1].Category, 'Series');
    assert.equal(entries[1].Status, 'Watched');
    assert.equal(entries[1].overallRating, '9');
    assert.equal(entries[1].imdb_id, 'tt0944947');
});

test('Import: CSV Formula Injection protection sanitizes malicious fields', () => {
    const maliciousInputs = [
        '=cmd|"/C calc"!A0',
        '+1+2',
        '-5+2',
        '@SUM(1,2)',
        '\t=maliciousTab',
        ' \r =maliciousSpace'
    ];

    maliciousInputs.forEach(input => {
        const sanitized = sandbox.sanitizeCSVField(input);
        assert.ok(sanitized.startsWith("'"), `Expected ${input} to be prefixed with single-quote but got: ${sanitized}`);
    });

    // Safe strings should not be prefixed
    assert.equal(sandbox.sanitizeCSVField('Normal Movie Title'), 'Normal Movie Title');
    assert.equal(sandbox.sanitizeCSVField('1999'), '1999');
    assert.equal(sandbox.sanitizeCSVField(null), null);
});

test('Import: IMDb titleType switch correctly resolves Special, Movie, Series, and skips tvEpisode', () => {
    // 1. tvSpecial -> Special
    const tvSpecialRow = { Const: 'tt1234567', Title: 'Guardians Holiday Special', 'Title Type': 'tvSpecial', Year: '2022' };
    const tvSpecialEntry = sandbox.normalizeImportedRow(tvSpecialRow);
    assert.ok(tvSpecialEntry);
    assert.equal(tvSpecialEntry.Category, 'Special');

    // 2. tvMovie -> Movie
    const tvMovieRow = { Const: 'tt2345678', Title: 'Duel', 'Title Type': 'tvMovie', Year: '1971' };
    const tvMovieEntry = sandbox.normalizeImportedRow(tvMovieRow);
    assert.ok(tvMovieEntry);
    assert.equal(tvMovieEntry.Category, 'Movie');

    // 3. tvShort & short -> Special
    const tvShortRow = { Const: 'tt3456789', Title: 'I Am Groot: Groot Takes a Bath', 'Title Type': 'tvShort', Year: '2022' };
    const tvShortEntry = sandbox.normalizeImportedRow(tvShortRow);
    assert.ok(tvShortEntry);
    assert.equal(tvShortEntry.Category, 'Special');

    const shortRow = { Const: 'tt4567890', Title: 'Bao', 'Title Type': 'short', Year: '2018' };
    const shortEntry = sandbox.normalizeImportedRow(shortRow);
    assert.ok(shortEntry);
    assert.equal(shortEntry.Category, 'Special');

    // 4. tvSeries & tvMiniSeries -> Series
    const tvSeriesRow = { Const: 'tt5678901', Title: 'Chernobyl', 'Title Type': 'tvMiniSeries', Year: '2019' };
    const tvSeriesEntry = sandbox.normalizeImportedRow(tvSeriesRow);
    assert.ok(tvSeriesEntry);
    assert.equal(tvSeriesEntry.Category, 'Series');

    // 5. documentary -> Documentary
    const docRow = { Const: 'tt6789012', Title: 'Free Solo', 'Title Type': 'documentary', Year: '2018' };
    const docEntry = sandbox.normalizeImportedRow(docRow);
    assert.ok(docEntry);
    assert.equal(docEntry.Category, 'Documentary');

    // 6. tvEpisode -> skipped (returns null)
    const epRow = { Const: 'tt7890123', Title: 'Ozymandias', 'Title Type': 'tvEpisode', Year: '2013' };
    const epEntry = sandbox.normalizeImportedRow(epRow);
    assert.equal(epEntry, null);
});

