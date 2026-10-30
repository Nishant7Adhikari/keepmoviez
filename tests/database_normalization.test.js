/**
 * Database Normalization Integration Test Suite
 * Tests normalized schema representations, view mapping, fallback resolution,
 * and batch RPC interaction for KeepMoviEZ v6.0.0.
 */

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
    generateUUID: () => 'uuid-wh-default',
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
sandbox.window = sandbox;

vm.createContext(sandbox);
const code = fs.readFileSync(path.join(__dirname, '../js/supabase.js'), 'utf8');
vm.runInContext(code, sandbox);

test('Database Normalization: view_movie_entries_complete maps all normalized fields cleanly', () => {
    const rawViewRow = {
        id: 'b1f41d01-e23a-44e2-897c-9b8893c52e61',
        user_id: 'a98b1c2d-3e4f-5a6b-7c8d-9e0f1a2b3c4d',
        name: 'Breaking Bad',
        category: 'Series',
        genre: 'Crime, Drama, Thriller',
        status: 'Watched',
        current_season: 5,
        current_episode: 16,
        recommendation: 'Must Watch',
        overall_rating: 10,
        personal_recommendation: 'Masterpiece storytelling',
        language: 'en',
        year: 2008,
        country: 'US',
        description: 'A chemistry teacher diagnosed with terminal lung cancer turns to manufacturing methamphetamine.',
        poster_url: 'https://image.tmdb.org/t/p/w500/ztkUQFLlC19CCMYHW9o1zWhJRNq.jpg',
        watch_history: [
            { id: 'wh-1', watchDate: '2023-01-10', rating: 10, notes: 'First complete watch' },
            { id: 'wh-2', watchDate: '2024-05-15', rating: 10, notes: 'Rewatch with friends' }
        ],
        related_entries: ['c2d3e4f5-a6b7-8c9d-0e1f-2a3b4c5d6e7f'],
        do_not_recommend_daily: false,
        last_modified_date: '2026-10-27T10:00:00.000Z',
        tmdb_id: 1396,
        imdb_id: 'tt0903747',
        tmdb_media_type: 'tv',
        tmdb_release_date: '2008-01-20',
        tmdb_vote_average: 9.3,
        tmdb_vote_count: 14500,
        runtime: {
            seasons: 5,
            totalEpisodes: 62,
            episodesPerSeason: [7, 13, 13, 13, 16],
            seriesStatus: 'Ended'
        },
        is_deleted: false
    };

    const localEntry = sandbox.supabaseEntryToLocalFormat(rawViewRow);

    assert.equal(localEntry.id, rawViewRow.id);
    assert.equal(localEntry.Name, 'Breaking Bad');
    assert.equal(localEntry.Category, 'Series');
    assert.equal(localEntry.currentSeason, 5);
    assert.equal(localEntry.currentEpisode, 16);
    assert.equal(localEntry.Year, '2008');
    assert.equal(localEntry.overallRating, '10');
    assert.equal(localEntry.poster_url, rawViewRow.poster_url);
    assert.equal(localEntry['Poster URL'], rawViewRow.poster_url);
    assert.equal(localEntry.tmdbId, '1396');
    assert.equal(localEntry.imdb_id, 'tt0903747');
    assert.equal(localEntry.watchHistory.length, 2);
    assert.equal(localEntry.relatedEntries.length, 1);
    assert.equal(localEntry.runtime.totalEpisodes, 62);
});

test('Database Normalization: Priority Fallback Resolution (custom fields over catalog defaults)', () => {
    // When custom fields exist in user_library, the view outputs them as the effective value
    const rowWithCustomOverrides = {
        id: 'uuid-entry-1',
        name: 'Alien (Director\'s Cut)', // custom_name override
        poster_url: 'https://mycustomposters.com/alien-alt.jpg', // custom_poster_url override
        description: 'My custom notes on Ridley Scott classic',
        year: 1979,
        category: 'Movie',
        status: 'Watched'
    };

    const localEntry = sandbox.supabaseEntryToLocalFormat(rowWithCustomOverrides);
    assert.equal(localEntry.Name, 'Alien (Director\'s Cut)');
    assert.equal(localEntry.poster_url, 'https://mycustomposters.com/alien-alt.jpg');
    assert.equal(localEntry.Description, 'My custom notes on Ridley Scott classic');
});

test('Database Normalization: uploadSupabaseBatch uses save_movie_entries_batch RPC with fallback to upsert', async () => {
    let rpcCalledWith = null;
    sandbox.window.supabaseClient = {
        rpc: (funcName, args) => {
            if (funcName === 'save_movie_entries_batch') {
                rpcCalledWith = args;
                return Promise.resolve({ data: { success: true, count: 2 }, error: null });
            }
            return Promise.resolve({ data: null, error: { message: 'Unknown RPC' } });
        }
    };

    const entriesToUpload = [
        { id: 'uuid-1', name: 'Movie 1', year: 2020, status: 'Watched', user_id: 'user_abc' },
        { id: 'uuid-2', name: 'Movie 2', year: 2021, status: 'To Watch', user_id: 'user_abc' }
    ];

    await assert.doesNotReject(async () => {
        await sandbox.uploadSupabaseBatch(entriesToUpload);
    });

    assert.ok(rpcCalledWith);
    assert.equal(rpcCalledWith.payloads.length, 2);
    assert.equal(rpcCalledWith.payloads[0].name, 'Movie 1');
    assert.equal(rpcCalledWith.payloads[0].user_id, 'user_abc');
    assert.equal(rpcCalledWith.payloads[1].name, 'Movie 2');
});

test('Database Normalization: uploadSupabaseBatch falls back to movie_entries upsert when RPC fails', async () => {
    let upsertCalledOn = null;
    let upsertedData = null;

    sandbox.window.supabaseClient = {
        rpc: () => Promise.resolve({ data: null, error: { message: 'function save_movie_entries_batch does not exist' } }),
        from: (table) => {
            upsertCalledOn = table;
            return {
                upsert: (data) => {
                    upsertedData = data;
                    return Promise.resolve({ data, error: null });
                }
            };
        }
    };

    const entries = [{ id: 'uuid-fallback', name: 'Fallback Movie', year: 2023, status: 'Watched', user_id: 'user_abc' }];
    await sandbox.uploadSupabaseBatch(entries);

    assert.equal(upsertCalledOn, 'movie_entries');
    assert.equal(upsertedData.length, 1);
    assert.equal(upsertedData[0].name, 'Fallback Movie');
});

test('Database Normalization: softDeleteSupabaseIds cascades soft-delete to user_library', async () => {
    const queriedTables = [];
    let updatedPayload = null;
    let filteredIn = null;

    sandbox.window.supabaseClient = {
        from: (table) => {
            queriedTables.push(table);
            return {
                update: (payload) => {
                    updatedPayload = payload;
                    return {
                        in: (col, ids) => {
                            filteredIn = { col, ids };
                            return {
                                eq: () => Promise.resolve({ data: null, error: null })
                            };
                        }
                    };
                }
            };
        }
    };

    const deleteIds = ['id-del-1', 'id-del-2'];
    await sandbox.softDeleteSupabaseIds(deleteIds, 'user_abc');

    assert.ok(queriedTables.includes('user_library'));
    assert.equal(updatedPayload.is_deleted, true);
    assert.deepEqual(filteredIn.ids, deleteIds);
});
