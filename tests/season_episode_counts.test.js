const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function createTestEnvironment() {
    const domValues = {};
    const listeners = [];
    const storage = {};

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
            html: function(h) {
                const key = selector.replace('#', '');
                if (h !== undefined) {
                    domValues[key] = String(h);
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
            },
            each: function(cb) { return $(selector); },
            attr: function() { return ""; },
            removeAttr: function() { return $(selector); }
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

    const mockLocalStorage = {
        getItem: function(key) { return storage[key] || null; },
        setItem: function(key, val) { storage[key] = String(val); },
        removeItem: function(key) { delete storage[key]; }
    };

    const sandbox = {
        console,
        Math,
        String,
        parseInt,
        parseFloat,
        Array,
        Object,
        $,
        IntersectionObserver: MockIntersectionObserver,
        localStorage: mockLocalStorage,
        document: {
            getElementById: function(id) {
                return {
                    reset: function() {},
                    value: domValues[id] || "",
                    focus: function() {},
                    style: {},
                    innerHTML: ""
                };
            },
            addEventListener: function() {},
            querySelectorAll: function() { return []; }
        },
        movieData: [],
        ACHIEVEMENTS: [],
        showToast: function() {},
        getLatestWatchInstance: function(history) {
            if (!Array.isArray(history) || history.length === 0) return null;
            return [...history].sort((a, b) => new Date(b.date) - new Date(a.date))[0];
        }
    };
    sandbox.window = sandbox;

    vm.createContext(sandbox);

    const utilsCode = fs.readFileSync(path.join(__dirname, '../js/utils.js'), 'utf8');
    vm.runInContext(utilsCode, sandbox);

    const supabaseCode = fs.readFileSync(path.join(__dirname, '../js/supabase.js'), 'utf8');
    vm.runInContext(supabaseCode, sandbox);

    const ioCode = fs.readFileSync(path.join(__dirname, '../js/input-output.js'), 'utf8');
    vm.runInContext(ioCode, sandbox);

    const analysisCode = fs.readFileSync(path.join(__dirname, '../js/analysis.js'), 'utf8');
    vm.runInContext(analysisCode, sandbox);

    return { sandbox, domValues, listeners };
}

test('supabaseEntryToLocalFormat & localEntryToSupabaseFormat map episodes_per_season & series_status correctly', () => {
    const { sandbox } = createTestEnvironment();
    const supabaseData = {
        id: "test_series_123",
        name: "Breaking Bad",
        category: "Series",
        status: "Continue",
        current_season: 2,
        current_episode: 5,
        episodes_per_season: [7, 13, 13, 13, 16],
        series_status: "Ended"
    };

    const localFormat = sandbox.supabaseEntryToLocalFormat(supabaseData);
    assert.equal(localFormat.episodesPerSeason.length, 5);
    assert.equal(localFormat.episodesPerSeason[0], 7);
    assert.equal(localFormat.episodesPerSeason[4], 16);
    assert.equal(localFormat.seriesStatus, "Ended");

    const backToSupabase = sandbox.localEntryToSupabaseFormat(localFormat, "user_123");
    assert.equal(backToSupabase.episodes_per_season.length, 5);
    assert.equal(backToSupabase.episodes_per_season[0], 7);
    assert.equal(backToSupabase.series_status, "Ended");
});

test('normalizeImportedRow handles episodesPerSeason safely', () => {
    const { sandbox } = createTestEnvironment();
    const importedRow = {
        Name: "Stranger Things",
        Category: "Series",
        episodesPerSeason: "[8, 9, 8, 9]",
        seriesStatus: "Returning Series"
    };

    const normalized = sandbox.normalizeImportedRow(importedRow);
    assert.equal(normalized.episodesPerSeason.length, 4);
    assert.equal(normalized.episodesPerSeason[0], 8);
    assert.equal(normalized.episodesPerSeason[1], 9);
    assert.equal(normalized.seriesStatus, "Returning Series");
});

test('calculateAllStatistics calculates exact watch time using episodesPerSeason', () => {
    const { sandbox } = createTestEnvironment();
    sandbox.currentMovieData = [{
        id: "series_1",
        Name: "Test Show",
        Category: "Series",
        Status: "Continue",
        currentSeason: 3,
        currentEpisode: 4,
        episodesPerSeason: [10, 12, 10],
        runtime: { episode_run_time: 30 }
    }];

    const stats = sandbox.calculateAllStatistics(sandbox.currentMovieData);
    assert.equal(stats.totalWatchTimeMinutes, 780);
});
