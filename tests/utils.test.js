const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Setup minimal browser globals needed for utils.js
const sandbox = {
    console,
    Math,
    String,
    parseFloat,
    isNaN,
    localStorage: {
        getItem: () => null,
        setItem: () => {},
    },
    crypto: {
        randomUUID: () => '12345678-1234-4abc-9def-123456789abc'
    },
    countryCodeToNameMap: {
        'US': 'United States',
        'CA': 'Canada'
    },
    PRANK_ERROR_CHANCE: 100
};

vm.createContext(sandbox);

const utilsCode = fs.readFileSync(path.join(__dirname, '../js/utils.js'), 'utf8');
vm.runInContext(utilsCode, sandbox);

test('getCountryFullName resolves country code correctly', () => {
    assert.equal(sandbox.getCountryFullName('US'), 'United States');
    assert.equal(sandbox.getCountryFullName('CA'), 'Canada');
    assert.equal(sandbox.getCountryFullName('Unknown'), 'Unknown');
    assert.equal(sandbox.getCountryFullName(null), 'N/A');
});

test('getRatingTextLabel formats ratings correctly', () => {
    assert.equal(sandbox.getRatingTextLabel(5), '5 Stars');
    assert.equal(sandbox.getRatingTextLabel(1), '1 Star');
    assert.equal(sandbox.getRatingTextLabel(4.5), '4.5 Stars');
    assert.equal(sandbox.getRatingTextLabel('invalid'), 'Invalid Rating');
    assert.equal(sandbox.getRatingTextLabel(null), 'Not Rated');
});

test('formatDuration formats total minutes into readable text', () => {
    assert.equal(sandbox.formatDuration(150), '2h 30m');
    assert.equal(sandbox.formatDuration(1440), '1d');
    assert.equal(sandbox.formatDuration(1500), '1d 1h');
    assert.equal(sandbox.formatDuration(null), 'N/A');
});

test('parseInputForAutocomplete parses search queries accurately', () => {
    const result1 = sandbox.parseInputForAutocomplete('Inception, Matrix, ');
    assert.deepEqual(Array.from(result1.finalized), ['Inception', 'Matrix']);
    assert.equal(result1.current, '');

    const result2 = sandbox.parseInputForAutocomplete('Inception, Mat');
    assert.deepEqual(Array.from(result2.finalized), ['Inception']);
    assert.equal(result2.current, 'Mat');
});

test('generateUUID returns a valid string', () => {
    const uuid = sandbox.generateUUID();
    assert.equal(typeof uuid, 'string');
    assert.ok(uuid.length > 0);
});

test('formatWatchDateDisplay formats wall-clock dates without timezone offset shifting', () => {
    assert.equal(sandbox.formatWatchDateDisplay('2026-03-31T21:00:00'), new Date(2026, 2, 31).toLocaleDateString());
    assert.equal(sandbox.formatWatchDateDisplay('2026-12-05T00:00:00.000Z'), new Date(2026, 11, 5).toLocaleDateString());
    assert.equal(sandbox.formatWatchDateDisplay('2026-01-01'), new Date(2026, 0, 1).toLocaleDateString());
    assert.equal(sandbox.formatWatchDateDisplay('invalid-date'), 'Invalid Date');
    assert.equal(sandbox.formatWatchDateDisplay(null), 'Invalid Date');
});
