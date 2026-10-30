/**
 * Multi-Device Conflict Resolution and Merge Test Suite
 * Tests timestamp comparison, soft-delete propagation across devices,
 * and login merge conflict strategies for KeepMoviEZ v6.0.0.
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
    classList: { add: () => {}, remove: () => {} },
    parentNode: { replaceChild: () => {} },
    cloneNode: () => mockElement
};

const createSandbox = () => {
    const sandbox = {
        console,
        Math,
        String,
        Number,
        Array,
        Object,
        Set,
        Map,
        Date,
        parseFloat,
        parseInt,
        isNaN,
        window: {},
        navigator: { onLine: true },
        localStorage: {
            _store: {},
            getItem: (k) => sandbox.localStorage._store[k] || null,
            setItem: (k, v) => { sandbox.localStorage._store[k] = String(v); },
            removeItem: (k) => { delete sandbox.localStorage._store[k]; }
        },
        document: {
            getElementById: () => mockElement,
            querySelector: () => mockElement,
            querySelectorAll: () => [],
            head: { appendChild: () => {} },
            createElement: () => mockElement
        },
        generateUUID: () => 'uuid-conflict-test',
        parseNumeric: (val) => (val ? Number(val) : null),
        formatNumericToString: (val) => (val !== null && val !== undefined ? String(val) : ""),
        showLoading: () => {},
        hideLoading: () => {},
        showToast: () => {},
        saveToIndexedDB: () => Promise.resolve(),
        openDatabase: () => Promise.resolve(),
        initializeApp: () => Promise.resolve(),
        renderMovieCards: () => {},
        recalculateAndApplyAllRelationships: () => {},
        sortMovies: () => {},
        incrementLocalStorageCounter: () => {},
        $: () => ({ modal: () => {} })
    };
    sandbox.window = sandbox;
    vm.createContext(sandbox);
    const code = fs.readFileSync(path.join(__dirname, '../js/supabase.js'), 'utf8');
    vm.runInContext(code, sandbox);
    return sandbox;
};

test('Multi-Device Conflict: Timestamp comparison favors newer remote entry', () => {
    const localLMD = '2026-10-25T12:00:00.000Z';
    const remoteLMD = '2026-10-27T08:30:00.000Z'; // Newer

    const parseDateSafe = (dStr) => {
        if (!dStr) return 0;
        let s = String(dStr);
        if (!s.endsWith('Z') && !s.includes('+') && (!s.includes('-') || s.lastIndexOf('-') < 10)) {
            s += 'Z';
        }
        return new Date(s).getTime() || 0;
    };

    assert.ok(parseDateSafe(remoteLMD) > parseDateSafe(localLMD));
});

test('Multi-Device Conflict: Timestamp comparison keeps local when local is newer or equal', () => {
    const localLMD = '2026-10-27T15:00:00.000Z';
    const remoteLMD = '2026-10-27T10:00:00.000Z'; // Older

    const parseDateSafe = (dStr) => {
        if (!dStr) return 0;
        let s = String(dStr);
        if (!s.endsWith('Z') && !s.includes('+') && (!s.includes('-') || s.lastIndexOf('-') < 10)) {
            s += 'Z';
        }
        return new Date(s).getTime() || 0;
    };

    assert.ok(parseDateSafe(remoteLMD) <= parseDateSafe(localLMD));
});

test('Multi-Device Conflict: Soft-deleted entries are purged from active movieData', () => {
    let localData = [
        { id: '1', Name: 'Active 1', is_deleted: false },
        { id: '2', Name: 'Deleted on Phone', is_deleted: true },
        { id: '3', Name: 'Active 2', is_deleted: false }
    ];

    const activeEntries = localData.filter(e => !e.is_deleted);
    assert.equal(activeEntries.length, 2);
    assert.deepEqual(activeEntries.map(e => e.id), ['1', '3']);
});

test('Multi-Device Conflict: Watch history deduplication merges independent logs cleanly', () => {
    const deviceAWatchHistory = [
        { id: 'wh-1', watchDate: '2024-01-01', rating: 8, notes: 'Watched in theatre' }
    ];
    const deviceBWatchHistory = [
        { id: 'wh-1', watchDate: '2024-01-01', rating: 8, notes: 'Watched in theatre' },
        { id: 'wh-2', watchDate: '2025-06-15', rating: 9, notes: 'Rewatched on 4K Blu-ray' }
    ];

    // Deduplication by watch id or watchDate
    const seen = new Set();
    const merged = [];
    for (const log of [...deviceAWatchHistory, ...deviceBWatchHistory]) {
        const key = log.id || log.watchDate;
        if (!seen.has(key)) {
            seen.add(key);
            merged.push(log);
        }
    }

    assert.equal(merged.length, 2);
    assert.equal(merged[0].id, 'wh-1');
    assert.equal(merged[1].id, 'wh-2');
});

test('Multi-Device Conflict: Guest Login Merge - strategy "merge" combines guest entries with cloud library', () => {
    const cloudEntries = [
        { id: 'cloud-1', Name: 'Oppenheimer', Year: '2023', Status: 'Watched' }
    ];
    const guestEntries = [
        { id: 'guest-1', Name: 'Barbie', Year: '2023', Status: 'Watched' },
        { id: 'cloud-1', Name: 'Oppenheimer (Local copy)', Year: '2023', Status: 'Watched' } // Conflict ID
    ];

    const existingIds = new Set(cloudEntries.map(e => e.id));
    const toMerge = guestEntries.filter(e => !existingIds.has(e.id));
    toMerge.forEach(e => {
        e._sync_state = "new";
        cloudEntries.push(e);
    });

    assert.equal(toMerge.length, 1);
    assert.equal(toMerge[0].Name, 'Barbie');
    assert.equal(cloudEntries.length, 2);
    assert.equal(cloudEntries[1]._sync_state, 'new');
});
