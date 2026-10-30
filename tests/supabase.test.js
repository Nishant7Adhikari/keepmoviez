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

test('downloadRemoteEntriesByIds batches queries to prevent HTTP 400 URI Too Long', async () => {
    const requestedChunks = [];
    const sampleIds = Array.from({ length: 250 }, (_, i) => `uuid-${i}`);

    sandbox.window.supabaseClient = {
        from: (table) => {
            assert.ok(table === 'view_movie_entries_complete' || table === 'movie_entries', `Unexpected table name: ${table}`);
            return {
                select: (columns) => {
                    assert.equal(columns, '*');
                    return {
                        in: (col, chunk) => {
                            assert.equal(col, 'id');
                            requestedChunks.push(chunk);
                            return {
                                eq: (col2, val2) => ({
                                    eq: (col3, val3) => {
                                        // Return mock entries for this chunk
                                        const mockData = chunk.map(id => ({ id, name: `Movie ${id}` }));
                                        return Promise.resolve({ data: mockData, error: null });
                                    }
                                })
                            };
                        }
                    };
                }
            };
        }
    };

    let progressCalls = 0;
    const result = await sandbox.downloadRemoteEntriesByIds(
        sampleIds, 
        'user_123', 
        (downloaded, total) => {
            progressCalls++;
            assert.equal(total, 250);
        }
    );

    // 250 items with chunk size 30 should yield 9 chunks
    assert.equal(requestedChunks.length, 9);
    // Crucial: No request should exceed 30 IDs, preventing HTTP 400 Bad Request
    assert.equal(requestedChunks.every(c => c.length <= 30), true);
    assert.equal(requestedChunks[0].length, 30);
    assert.equal(requestedChunks[8].length, 10);

    // All 250 items downloaded
    assert.equal(result.length, 250);
    assert.equal(progressCalls > 0, true);
});

test('downloadRemoteEntriesByIds handles errors cleanly', async () => {
    sandbox.window.supabaseClient = {
        from: () => ({
            select: () => ({
                in: () => ({
                    eq: () => ({
                        eq: () => Promise.resolve({ data: null, error: { message: 'Network error' } })
                    })
                })
            })
        })
    };

    await assert.rejects(
        async () => {
            await sandbox.downloadRemoteEntriesByIds(['id-1'], 'user_1');
        },
        /Downloading remote entries failed: Network error/
    );
});

test('supabaseEntryToLocalFormat & localEntryToSupabaseFormat support both poster_url and Poster URL', () => {
    const localWithCamel = {
        id: 'uuid-1',
        Name: 'Test Movie',
        poster_url: 'https://example.com/poster.jpg'
    };
    const row = sandbox.localEntryToSupabaseFormat(localWithCamel, 'u1');
    assert.equal(row.poster_url, 'https://example.com/poster.jpg');

    const unpacked = sandbox.supabaseEntryToLocalFormat(row);
    assert.equal(unpacked.poster_url, 'https://example.com/poster.jpg');
    assert.equal(unpacked['Poster URL'], 'https://example.com/poster.jpg');
});

test('downloadRemoteEntriesByIds falls back from view_movie_entries_complete to movie_entries on error', async () => {
    let queriedTables = [];
    sandbox.window.supabaseClient = {
        from: (table) => {
            queriedTables.push(table);
            return {
                select: () => ({
                    in: () => ({
                        eq: () => ({
                            eq: () => {
                                if (table === 'view_movie_entries_complete') {
                                    return Promise.resolve({ data: null, error: { message: 'View not available' } });
                                }
                                return Promise.resolve({ data: [{ id: 'uuid-fb', name: 'Fallback Movie' }], error: null });
                            }
                        })
                    })
                })
            };
        }
    };

    const res = await sandbox.downloadRemoteEntriesByIds(['uuid-fb'], 'u1');
    assert.equal(res.length, 1);
    assert.equal(res[0].name, 'Fallback Movie');
    assert.deepEqual(queriedTables, ['view_movie_entries_complete', 'movie_entries']);
});

