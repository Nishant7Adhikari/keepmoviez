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
        production_countries: [{ iso_3166_1: 'US', name: 'United States' }]
    };

    assert.equal(sandbox.extractFieldFromTmdb('Year', tmdbData, 'movie'), 2010);
    assert.equal(sandbox.extractFieldFromTmdb('Country', tmdbData, 'movie'), 'US');
});
