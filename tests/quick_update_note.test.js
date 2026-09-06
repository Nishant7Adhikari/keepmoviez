const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Setup mock DOM and jQuery environment for vm context
function createTestEnvironment() {
    const domValues = {
        quickUpdateSeasons: "1",
        quickUpdateEpisodes: "0",
        quickUpdateNotes: "",
        quickUpdateFinishedToggle: false,
    };

    const listeners = [];

    const $ = function(selector) {
        return {
            val: function(newVal) {
                const key = selector.replace('#', '');
                if (newVal !== undefined) {
                    domValues[key] = String(newVal);
                    return $(selector);
                }
                return domValues[key] || "";
            },
            is: function(pseudo) {
                if (pseudo === ":checked") {
                    const key = selector.replace('#', '');
                    return !!domValues[key];
                }
                return false;
            },
            text: function(txt) {
                const key = selector.replace('#', '');
                if (txt !== undefined) {
                    domValues[key] = String(txt);
                    return $(selector);
                }
                return domValues[key] || "";
            },
            toggle: function() { return $(selector); },
            show: function() { return $(selector); },
            hide: function() { return $(selector); },
            modal: function() { return $(selector); },
            find: function() {
                return {
                    text: function() {},
                    attr: function() {}
                };
            }
        };
    };

    $.on = function(event, selector, handler) {
        listeners.push({ event, selector, handler });
    };

    class MockIntersectionObserver {
        constructor() {}
        observe() {}
        unobserve() {}
        disconnect() {}
    }

    const sandbox = {
        console,
        Math,
        String,
        parseInt,
        Array,
        Object,
        $,
        IntersectionObserver: MockIntersectionObserver,
        document: {
            getElementById: function(id) {
                return {
                    reset: function() {},
                    value: domValues[id] || "",
                    focus: function() {}
                };
            },
            addEventListener: function() {}
        },
        movieData: [],
        showToast: function() {},
        getLatestWatchInstance: function(history) {
            if (!Array.isArray(history) || history.length === 0) return null;
            return [...history].sort((a, b) => new Date(b.date) - new Date(a.date))[0];
        }
    };
    sandbox.window = sandbox;

    vm.createContext(sandbox);

    // Read and run utils.js and ui.js in sandbox
    const utilsCode = fs.readFileSync(path.join(__dirname, '../js/utils.js'), 'utf8');
    vm.runInContext(utilsCode, sandbox);

    const uiCode = fs.readFileSync(path.join(__dirname, '../js/ui.js'), 'utf8');
    vm.runInContext(uiCode, sandbox);

    return { sandbox, domValues, listeners };
}

test('Single Episode Watch (E5 to E6 yields S1E6 - S1E6)', () => {
    const { sandbox, domValues } = createTestEnvironment();
    sandbox.movieData = [{
        id: "series_1",
        Name: "Test Series",
        Category: "Series",
        Status: "Continue",
        currentSeason: 1,
        currentEpisode: 5
    }];

    sandbox.prepareQuickUpdateModal("series_1");
    // Update episode input to 6
    domValues.quickUpdateEpisodes = "6";
    sandbox.updateQuickUpdateAutoNote();

    assert.equal(domValues.quickUpdateNotes, "S1E6 - S1E6");
});

test('Multi-Episode Watch (E5 to E8 yields S1E6 - S1E8)', () => {
    const { sandbox, domValues } = createTestEnvironment();
    sandbox.movieData = [{
        id: "series_1",
        Name: "Test Series",
        Category: "Series",
        Status: "Continue",
        currentSeason: 1,
        currentEpisode: 5
    }];

    sandbox.prepareQuickUpdateModal("series_1");
    domValues.quickUpdateEpisodes = "8";
    sandbox.updateQuickUpdateAutoNote();

    assert.equal(domValues.quickUpdateNotes, "S1E6 - S1E8");
});

test('Season Boundary Transition in New Session (S1E12 to S2E5 yields S2E1 - S2E5)', () => {
    const { sandbox, domValues } = createTestEnvironment();
    sandbox.movieData = [{
        id: "series_1",
        Name: "Test Series",
        Category: "Series",
        Status: "Continue",
        currentSeason: 1,
        currentEpisode: 12
    }];

    sandbox.prepareQuickUpdateModal("series_1");
    domValues.quickUpdateSeasons = "2";
    domValues.quickUpdateEpisodes = "5";
    sandbox.updateQuickUpdateAutoNote();

    assert.equal(domValues.quickUpdateNotes, "S2E1 - S2E5");
});

test('Continuous Cross-Season Watching (Same Session)', () => {
    const { sandbox, domValues } = createTestEnvironment();
    sandbox.movieData = [{
        id: "series_1",
        Name: "Test Series",
        Category: "Series",
        Status: "Continue",
        currentSeason: 1,
        currentEpisode: 9
    }];

    sandbox.prepareQuickUpdateModal("series_1");
    domValues.quickUpdateEpisodes = "12";
    sandbox.updateQuickUpdateAutoNote();
    assert.equal(domValues.quickUpdateNotes, "S1E10 - S1E12");

    // Click Next Season
    const state = sandbox._quickUpdateState;
    const segment = `S1E10 - S1E12, Season 1 completed`;
    state.seasonHistory.push(segment);
    domValues.quickUpdateSeasons = "2";
    domValues.quickUpdateEpisodes = "4";
    sandbox.updateQuickUpdateAutoNote();

    assert.equal(domValues.quickUpdateNotes, "S1E10 - S1E12, Season 1 completed : S2E1 - S2E4");
});

test('Subsequent Session Resume via Primary Entry Data', () => {
    const { sandbox, domValues } = createTestEnvironment();
    sandbox.movieData = [{
        id: "series_1",
        Name: "Test Series",
        Category: "Series",
        Status: "Continue",
        currentSeason: 2,
        currentEpisode: 4,
        watchHistory: [{
            date: "2026-03-31T20:00:00",
            notes: "S1E10 - S1E12, Season 1 completed : S2E1 - S2E4"
        }]
    }];

    sandbox.prepareQuickUpdateModal("series_1");
    domValues.quickUpdateEpisodes = "8";
    sandbox.updateQuickUpdateAutoNote();

    assert.equal(domValues.quickUpdateNotes, "S2E5 - S2E8");
});

test('Fallback Note Parsing for Multi-Segment Note', () => {
    const { sandbox, domValues } = createTestEnvironment();
    sandbox.movieData = [{
        id: "series_1",
        Name: "Test Series",
        Category: "Series",
        Status: "Continue",
        currentSeason: null,
        currentEpisode: null,
        watchHistory: [{
            date: "2026-03-31T20:00:00",
            notes: "S1E10 - S1E12, Season 1 completed : S2E1 - S2E4"
        }]
    }];

    sandbox.prepareQuickUpdateModal("series_1");
    assert.equal(sandbox._quickUpdateState.initialSeason, 2);
    assert.equal(sandbox._quickUpdateState.initialEpisode, 4);

    domValues.quickUpdateEpisodes = "8";
    sandbox.updateQuickUpdateAutoNote();

    assert.equal(domValues.quickUpdateNotes, "S2E5 - S2E8");
});

test('Episode Decrementing Safeguard (startEp=6, user sets E3 -> S1E3 - S1E3)', () => {
    const { sandbox, domValues } = createTestEnvironment();
    sandbox.movieData = [{
        id: "series_1",
        Name: "Test Series",
        Category: "Series",
        Status: "Continue",
        currentSeason: 1,
        currentEpisode: 5
    }];

    sandbox.prepareQuickUpdateModal("series_1");
    domValues.quickUpdateEpisodes = "3";
    sandbox.updateQuickUpdateAutoNote();

    assert.equal(domValues.quickUpdateNotes, "S1E3 - S1E3");
});

test('Series Finished Toggle Appends ", Series completed"', () => {
    const { sandbox, domValues } = createTestEnvironment();
    sandbox.movieData = [{
        id: "series_1",
        Name: "Test Series",
        Category: "Series",
        Status: "Continue",
        currentSeason: 1,
        currentEpisode: 5
    }];

    sandbox.prepareQuickUpdateModal("series_1");
    domValues.quickUpdateEpisodes = "8";
    domValues.quickUpdateFinishedToggle = true;
    sandbox.updateQuickUpdateAutoNote();

    assert.equal(domValues.quickUpdateNotes, "S1E6 - S1E8, Series completed");
});

test('State Re-initialization Prevents Stale Modal Leakage', () => {
    const { sandbox, domValues } = createTestEnvironment();
    sandbox.movieData = [{
        id: "series_1",
        Name: "Test Series 1",
        Category: "Series",
        Status: "Continue",
        currentSeason: 1,
        currentEpisode: 5
    }, {
        id: "series_2",
        Name: "Test Series 2",
        Category: "Series",
        Status: "Continue",
        currentSeason: 3,
        currentEpisode: 10
    }];

    sandbox.prepareQuickUpdateModal("series_1");
    domValues.quickUpdateEpisodes = "8";
    sandbox.updateQuickUpdateAutoNote();
    assert.equal(domValues.quickUpdateNotes, "S1E6 - S1E8");

    // Close/re-open with second series
    sandbox.prepareQuickUpdateModal("series_2");
    assert.equal(sandbox._quickUpdateState.initialSeason, 3);
    assert.equal(sandbox._quickUpdateState.initialEpisode, 10);
    assert.equal(sandbox._quickUpdateState.startEp, 11);
    assert.equal(sandbox._quickUpdateState.seasonHistory.length, 0);

    domValues.quickUpdateEpisodes = "12";
    sandbox.updateQuickUpdateAutoNote();
    assert.equal(domValues.quickUpdateNotes, "S3E11 - S3E12");
});
