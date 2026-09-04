const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const mockElement = {
    addEventListener: () => {},
    appendChild: () => {},
    style: {},
    classList: { add: () => {}, remove: () => {} }
};

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
    window: {},
    document: {
        getElementById: () => mockElement,
        querySelector: () => mockElement,
        querySelectorAll: () => [],
        head: { appendChild: () => {} },
        createElement: () => mockElement
    },
    parseNumeric: (val) => (val ? Number(val) : null),
    formatNumericToString: (val) => (val !== null && val !== undefined ? String(val) : "")
};

vm.createContext(sandbox);
const code = fs.readFileSync(path.join(__dirname, '../js/supabase.js'), 'utf8');
vm.runInContext(code, sandbox);

test('localEntryToSupabaseFormat maps camelCase to snake_case correctly', () => {
    const local = {
        id: '123',
        Name: 'The Dark Knight',
        Year: '2008',
        Status: 'Watched',
        overallRating: '5'
    };

    const supabase = sandbox.localEntryToSupabaseFormat(local, 'user_1');
    assert.equal(supabase.id, '123');
    assert.equal(supabase.name, 'The Dark Knight');
    assert.equal(supabase.year, 2008);
    assert.equal(supabase.status, 'Watched');
    assert.equal(supabase.user_id, 'user_1');
});

test('supabaseEntryToLocalFormat maps snake_case back to local camelCase', () => {
    const supabase = {
        id: '123',
        name: 'The Dark Knight',
        year: 2008,
        status: 'Watched',
        overall_rating: 5
    };

    const local = sandbox.supabaseEntryToLocalFormat(supabase);
    assert.equal(local.id, '123');
    assert.equal(local.Name, 'The Dark Knight');
    assert.equal(local.Year, '2008');
    assert.equal(local.Status, 'Watched');
    assert.equal(local.overallRating, '5');
});

test('validateAuthForm validates credentials accurately', () => {
    assert.equal(sandbox.validateAuthForm('test@example.com', '123456', false), true);
    assert.equal(sandbox.validateAuthForm('invalid-email', '123456', false), false);
    assert.equal(sandbox.validateAuthForm('test@example.com', '123', true), false);
});
