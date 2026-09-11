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
    window: {}
};
sandbox.window = sandbox;

vm.createContext(sandbox);
const utilsCode = fs.readFileSync(path.join(__dirname, '../js/utils.js'), 'utf8');
vm.runInContext(utilsCode, sandbox);
const code = fs.readFileSync(path.join(__dirname, '../js/backfill.js'), 'utf8');
vm.runInContext(code, sandbox);

test('normalizeCountryCode converts country inputs safely', () => {
    sandbox.countryCodeToNameMap = { 'US': 'United States', 'CA': 'Canada' };
    assert.equal(sandbox.normalizeCountryCode('US'), 'US');
    assert.equal(sandbox.normalizeCountryCode('United States'), 'US');
    assert.equal(sandbox.normalizeCountryCode('Canada'), 'CA');
});

test('isFieldMissing identifies missing or empty fields correctly', () => {
    const entry = { Name: 'Inception', Year: '', Description: null };
    assert.equal(sandbox.isFieldMissing(entry, 'Year'), true);
    assert.equal(sandbox.isFieldMissing(entry, 'Description'), true);
    assert.equal(sandbox.isFieldMissing(entry, 'Name'), false);
});

test('transformFieldValue cleans and formats field values', () => {
    const fieldConfig = { type: 'number' };
    assert.equal(sandbox.transformFieldValue('Year', '2010', fieldConfig, {}), 2010);
});

test('extractFieldFromTmdb retrieves requested metadata from TMDB object', () => {
    const tmdbData = {
        runtime: 148,
        release_date: '2010-07-16',
        production_countries: [{ iso_3166_1: 'US', name: 'United States' }],
        overview: 'A thief who steals corporate secrets through the use of dream-sharing technology.',
        poster_path: '/edv5CZvWj09upOsy2Y6IwDhK8bt.jpg',
        credits: {
            crew: [
                { job: 'Director', name: 'Christopher Nolan', id: 525, profile_path: '/path.jpg' }
            ]
        }
    };

    assert.equal(sandbox.extractFieldFromTmdb('Year', tmdbData, 'movie'), 2010);
    assert.equal(sandbox.extractFieldFromTmdb('Country', tmdbData, 'movie'), 'US');
    assert.equal(sandbox.extractFieldFromTmdb('Description', tmdbData, 'movie'), tmdbData.overview);
    assert.equal(sandbox.extractFieldFromTmdb('Poster URL', tmdbData, 'movie'), 'https://image.tmdb.org/t/p/w500/edv5CZvWj09upOsy2Y6IwDhK8bt.jpg');
    const directors = sandbox.extractFieldFromTmdb('director_info', tmdbData, 'movie');
    assert.equal(directors.length, 1);
    assert.equal(directors[0].name, 'Christopher Nolan');
    assert.equal(directors[0].id, 525);
});

test('extractFieldFromTmdb retrieves episodes_per_season and TV creators correctly', () => {
    const tvData = {
        number_of_seasons: 3,
        number_of_episodes: 28,
        seasons: [
            { season_number: 0, episode_count: 2 }, // Special season should be filtered out
            { season_number: 1, episode_count: 8 },
            { season_number: 2, episode_count: 10 },
            { season_number: 3, episode_count: 10 }
        ],
        created_by: [
            { id: 987, name: 'Vince Gilligan', profile_path: '/vince.jpg' }
        ],
        credits: { crew: [] }
    };

    const eps = sandbox.extractFieldFromTmdb('episodes_per_season', tvData, 'tv');
    assert.deepEqual(Array.from(eps), [8, 10, 10]);

    const creators = sandbox.extractFieldFromTmdb('director_info', tvData, 'tv');
    assert.equal(creators.length, 1);
    assert.equal(creators[0].name, 'Vince Gilligan');
    assert.equal(creators[0].job, 'Creator');
});

test('isFieldMissing detects missing episodes_per_season for series only', () => {
    const movieEntry = { Category: 'Movie' };
    assert.equal(sandbox.isFieldMissing(movieEntry, 'episodes_per_season'), false);

    const seriesMissing = { Category: 'Series', runtime: { seasons: 2, episodes: 16 } };
    assert.equal(sandbox.isFieldMissing(seriesMissing, 'episodes_per_season'), true);

    const seriesWithRuntime = {
        Category: 'Series',
        runtime: { seasons: 2, episodes: 16, episodes_per_season: [8, 8] }
    };
    assert.equal(sandbox.isFieldMissing(seriesWithRuntime, 'episodes_per_season'), false);

    const seriesWithTopLevel = {
        Category: 'Series',
        episodesPerSeason: [8, 8]
    };
    assert.equal(sandbox.isFieldMissing(seriesWithTopLevel, 'episodes_per_season'), false);
});

test('transformFieldValue processes episodes_per_season and multi-director structures', () => {
    const fieldConfig = { saveFormat: 'tmdb-json' };
    const epArray = sandbox.transformFieldValue('episodes_per_season', [8, 10, '12'], fieldConfig, {});
    assert.deepEqual(Array.from(epArray), [8, 10, 12]);

    const epString = sandbox.transformFieldValue('episodes_per_season', '8, 10, 12', fieldConfig, {});
    assert.deepEqual(Array.from(epString), [8, 10, 12]);

    const multiDirectors = [
        { id: 1, name: 'Anthony Russo', profile_path: '/anthony.jpg', job: 'Director' },
        { id: 2, name: 'Joe Russo', profile_path: '/joe.jpg', job: 'Director' }
    ];
    const transformedDir = sandbox.transformFieldValue('director_info', multiDirectors, fieldConfig, {});
    assert.equal(transformedDir.name, 'Anthony Russo, Joe Russo');
    assert.equal(transformedDir.id, 1);
    assert.equal(transformedDir.directors.length, 2);

    const commaDir = sandbox.transformFieldValue('director_info', 'Joel Coen, Ethan Coen', fieldConfig, {});
    assert.equal(commaDir.name, 'Joel Coen, Ethan Coen');
    assert.equal(commaDir.directors.length, 2);
});

test('renderFieldInput escapes select option values and input placeholders', () => {
    const selectConfig = {
        inputType: 'select',
        options: ['Option "<script>alert(1)</script>"', 'Normal & Safe']
    };
    const selectHtml = sandbox.renderFieldInput(selectConfig, {});
    assert.ok(selectHtml.includes('value="Option &quot;&lt;script&gt;alert(1)&lt;/script&gt;&quot;"'));
    assert.ok(selectHtml.includes('Normal &amp; Safe'));

    const textConfig = {
        inputType: 'text',
        placeholder: 'e.g. "<img src=x onerror=alert(1)>"'
    };
    const textHtml = sandbox.renderFieldInput(textConfig, {});
    assert.ok(textHtml.includes('placeholder="e.g. &quot;&lt;img src=x onerror=alert(1)&gt;&quot;"'));
});
