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
    isNaN
};

vm.createContext(sandbox);
const code = fs.readFileSync(path.join(__dirname, '../js/backfill.js'), 'utf8');
vm.runInContext(code, sandbox);

test('stringSimilarity & getEditDistance calculate string closeness accurately', () => {
    assert.equal(sandbox.stringSimilarity('Inception', 'Inception'), 1);
    assert.ok(sandbox.stringSimilarity('Inception', 'Inception') > 0.8);
    assert.ok(sandbox.getEditDistance('kitten', 'sitting') === 3);
});

test('calculateMatchScore weights title and year match correctly', () => {
    const scoreExact = sandbox.calculateMatchScore('Inception', '2010', 'Inception', '2010');
    const scoreDiffYear = sandbox.calculateMatchScore('Inception', '2010', 'Inception', '2020');
    assert.ok(scoreExact > scoreDiffYear);
});

test('parseColumnInput splits comma-separated fields cleanly', () => {
    const fields = sandbox.parseColumnInput('runtime, director');
    assert.deepEqual(Array.from(fields), ['runtime', 'director']);
});

test('extractTmdbData formats API response to internal structure', () => {
    const tmdbData = {
        genres: [{ name: 'Sci-Fi' }, { name: 'Action' }],
        runtime: 148,
        release_date: '2010-07-16',
        overview: 'A thief who steals corporate secrets...'
    };

    const extracted = sandbox.extractTmdbData(tmdbData, 'movie', ['runtime']);
    assert.equal(extracted.runtime, 148);
});
