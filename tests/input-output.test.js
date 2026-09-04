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
    generateUUID: () => '12345678-1234-4xxx-yxxx-123456789abc',
    document: {
        createElement: () => ({ click: () => {}, setAttribute: () => {} }),
        body: { appendChild: () => {}, removeChild: () => {} }
    },
    URL: { createObjectURL: () => 'blob:mock', revokeObjectURL: () => {} },
    Blob: class Blob {}
};

vm.createContext(sandbox);
const code = fs.readFileSync(path.join(__dirname, '../js/input-output.js'), 'utf8');
vm.runInContext(code, sandbox);

test('normalizeImportedRow handles standard fields cleanly', () => {
    const raw = {
        Name: ' Inception ',
        Year: '2010',
        Status: 'Watched',
        Category: 'Movie',
        overallRating: '5'
    };
    const normalized = sandbox.normalizeImportedRow(raw);
    assert.equal(normalized.Name, 'Inception');
    assert.equal(normalized.Year, '2010');
    assert.equal(normalized.Status, 'Watched');
    assert.equal(normalized.Category, 'Movie');
    assert.equal(normalized.overallRating, '5');
});

test('normalizeImportedRow handles missing/empty columns safely', () => {
    const raw = {};
    const normalized = sandbox.normalizeImportedRow(raw);
    assert.ok(normalized.id);
    assert.equal(normalized.Status, 'To Watch');
    assert.equal(normalized.Category, 'Movie');
});

test('normalizeImportedRow handles unknown field variations gracefully', () => {
    const raw = {
        title: ' Interstellar ',
        release_year: 2014,
        rating: 4,
        type: 'Film'
    };
    const normalized = sandbox.normalizeImportedRow(raw);
    assert.ok(normalized.id);
});

test('generateAndDownloadFile executes without crashing', () => {
    sandbox.movieData = [{ id: '1', Name: 'Matrix', Year: '1999', Status: 'Watched' }];
    assert.doesNotThrow(() => {
        sandbox.generateAndDownloadFile('json');
    });
});
