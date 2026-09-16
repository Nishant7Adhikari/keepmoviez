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
            removeClass: function() { return $(selector); },
            addClass: function() { return $(selector); },
            toast: function() { return $(selector); },
            find: function() {
                return {
                    text: function() {},
                    attr: function() {},
                    each: function() {},
                    removeClass: function() { return $(selector); },
                    addClass: function() { return $(selector); },
                    toast: function() { return $(selector); }
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
    $.fn = { toast: function() {} };

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
        alert: function() {},
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
        loadingOverlay: {
            classList: { remove: function() {}, add: function() {} },
            querySelector: function() { return { textContent: '' }; },
            style: {}
        },
        watchInstanceFormFields: { date: {}, time: {}, rating: {}, notes: {} },
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

test('supabaseEntryToLocalFormat & localEntryToSupabaseFormat map episodes_per_season & series_status correctly via runtime JSON object', () => {
    const { sandbox } = createTestEnvironment();
    const supabaseData = {
        id: "test_series_123",
        name: "Breaking Bad",
        category: "Series",
        status: "Continue",
        current_season: 2,
        current_episode: 5,
        runtime: {
            seasons: 5,
            episodes: 62,
            episode_run_time: 47,
            episodes_per_season: [7, 13, 13, 13, 16],
            series_status: "Ended"
        }
    };

    const localFormat = sandbox.supabaseEntryToLocalFormat(supabaseData);
    assert.equal(localFormat.episodesPerSeason.length, 5);
    assert.equal(localFormat.episodesPerSeason[0], 7);
    assert.equal(localFormat.episodesPerSeason[4], 16);
    assert.equal(localFormat.seriesStatus, "Ended");

    const backToSupabase = sandbox.localEntryToSupabaseFormat(localFormat, "user_123");
    assert.equal(backToSupabase.episodes_per_season, undefined);
    assert.equal(backToSupabase.series_status, undefined);
    assert.equal(typeof backToSupabase.runtime, "object");
    assert.equal(backToSupabase.runtime.episodes_per_season.length, 5);
    assert.equal(backToSupabase.runtime.episodes_per_season[0], 7);
    assert.equal(backToSupabase.runtime.series_status, "Ended");
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

test('renderSeasonBreakdownCards includes accessible aria-labels on controls', () => {
    const { sandbox } = createTestEnvironment();
    const uiCode = fs.readFileSync(path.join(__dirname, '../js/ui.js'), 'utf8');
    vm.runInContext(uiCode, sandbox);

    let innerHTMLResult = '';
    const mockContainer = {
        set innerHTML(val) {
            innerHTMLResult = val;
        },
        get innerHTML() {
            return innerHTMLResult;
        }
    };

    sandbox.document.getElementById = function(id) {
        if (id === 'seasonBreakdownContainer') {
            return mockContainer;
        }
        return { style: {}, innerHTML: '', value: '' };
    };

    sandbox.renderSeasonBreakdownCards(2, [10, 8], 'seasonBreakdownContainer', 'calcTotalEpsBadge');

    assert.ok(innerHTMLResult.includes('aria-label="Set all seasons to 10 episodes"'));
    assert.ok(innerHTMLResult.includes('aria-label="Paste comma-separated episode counts"'));
    assert.ok(innerHTMLResult.includes('aria-label="Apply pasted episode counts"'));
    assert.ok(innerHTMLResult.includes('aria-label="Add season"'));
    assert.ok(innerHTMLResult.includes('aria-label="Remove last season"'));
    assert.ok(innerHTMLResult.includes('aria-label="Decrease Season 1 episode count"'));
    assert.ok(innerHTMLResult.includes('aria-label="Season 1 episode count"'));
    assert.ok(innerHTMLResult.includes('aria-label="Increase Season 1 episode count"'));
});

test('prepareEditModal preserves series_status, episodesPerSeason, and collection parts in _tempTmdbData', () => {
    const { sandbox } = createTestEnvironment();

    sandbox.UNIQUE_ALL_GENRES = [];
    sandbox.selectedGenres = [];
    sandbox.renderGenreTags = function() {};
    sandbox.populateGenreDropdown = function() {};
    sandbox.renderWatchHistoryUI = function() {};
    sandbox.closeWatchInstanceForm = function() {};
    sandbox.handlePosterUrlInput = function() {};
    sandbox.toggleConditionalFields = function() {};
    sandbox.renderSeasonBreakdownCards = function() {};

    sandbox.formFieldsGlob = {
        name: { value: '' },
        category: { value: '' },
        status: { value: '' },
        recommendation: { value: '' },
        overallRating: { value: '' },
        personalRecommendation: { value: '' },
        language: { value: '' },
        currentSeason: { value: '' },
        currentEpisode: { value: '' },
        year: { value: '' },
        country: { value: '' },
        description: { value: '' },
        posterUrl: { value: '', dataset: {} },
        tmdbSearchYear: { value: '' },
        runtimeMovie: { value: '' },
        runtimeSeriesSeasons: { value: '' },
        runtimeSeriesEpisodes: { value: '' },
        runtimeSeriesAvgEp: { value: '' },
        relatedEntriesNames: { value: '' },
        relatedEntriesSuggestions: { innerHTML: '', style: {} }
    };

    const entryFormObj = {
        reset: function() {},
        _tempTmdbData: {}
    };

    sandbox.document.getElementById = function(id) {
        if (id === 'entryForm') return entryFormObj;
        if (id === 'editEntryId') return { value: '' };
        if (id === 'tmdbId') return { value: '' };
        if (id === 'tmdbMediaType') return { value: '' };
        if (id === 'genreSearchInput') return { value: '' };
        if (id === 'currentWatchHistory') return { value: '' };
        if (id === 'genreItemsContainer') return { classList: { remove: function() {} } };
        if (id === 'tmdbSearchResults') return { innerHTML: '', style: {} };
        return { value: '', style: {}, innerHTML: '' };
    };

    const uiCode = fs.readFileSync(path.join(__dirname, '../js/ui.js'), 'utf8');
    vm.runInContext(uiCode, sandbox);

    const testSeries = {
        id: "series_from_123",
        Name: "FROM",
        Category: "Series",
        Status: "Continue",
        currentSeason: 2,
        currentEpisode: 3,
        tmdb_collection_total_parts: 3,
        tmdb_release_date: "2022-02-20",
        runtime: {
            seasons: 3,
            episodes: 30,
            episode_run_time: 52,
            episodes_per_season: [10, 10, 10],
            series_status: "Returning Series"
        }
    };

    sandbox.movieData = [testSeries];

    sandbox.prepareEditModal("series_from_123", false);

    const temp = entryFormObj._tempTmdbData;
    assert.ok(temp, "_tempTmdbData should exist on entryForm");
    assert.equal(temp.tmdb_collection_total_parts, 3);
    assert.equal(temp.tmdb_release_date, "2022-02-20");
    assert.deepEqual(temp.episodesPerSeason, [10, 10, 10]);
    assert.deepEqual(temp.episodes_per_season, [10, 10, 10]);
    assert.equal(temp.seriesStatus, "Returning Series");
    assert.equal(temp.series_status, "Returning Series");
    assert.equal(temp.runtime.series_status, "Returning Series");
});

test('handleFormSubmit saves series_status and episodes_per_season inside entry.runtime', async () => {
    const { sandbox } = createTestEnvironment();

    sandbox.DO_NOT_SHOW_AGAIN_KEYS = { ENTRY_ADDED: 'entry_added', ENTRY_UPDATED: 'entry_updated' };
    sandbox.logWatchlistActivity = function() {};
    sandbox.trackModification = function() {};
    sandbox.UNIQUE_ALL_GENRES = [];
    sandbox.selectedGenres = [];
    sandbox.countryCodeToNameMap = {};
    sandbox.currentSortColumn = "lastModifiedDate";
    sandbox.currentSortDirection = "desc";
    sandbox.renderMovieCards = function() {};
    sandbox.sortMovies = function() {};
    sandbox.recalculateAndApplyAllRelationships = function() {};
    sandbox.saveToIndexedDB = async function() {};
    sandbox.parseInputForAutocomplete = function() { return { finalized: [] }; };

    const entryFormObj = {
        _tempTmdbData: {
            episodesPerSeason: [10, 10, 10],
            seriesStatus: "Returning Series",
            runtime: {
                seasons: 3,
                episodes: 30,
                episode_run_time: 52,
                episodes_per_season: [10, 10, 10],
                series_status: "Returning Series"
            }
        }
    };

    sandbox.formFieldsGlob = {
        name: { value: 'FROM', focus: function() {} },
        category: { value: 'Series' },
        status: { value: 'Continue' },
        year: { value: '2022', focus: function() {} },
        country: { value: 'US' },
        language: { value: 'English' },
        description: { value: 'Sci-fi mystery series' },
        recommendation: { value: 'Recommended' },
        overallRating: { value: '9' },
        personalRecommendation: { value: '' },
        currentSeason: { value: '2' },
        currentEpisode: { value: '3' },
        posterUrl: { value: 'https://image.tmdb.org/poster.jpg', dataset: { source: 'tmdb' } },
        runtimeSeriesSeasons: { value: '3' },
        runtimeSeriesEpisodes: { value: '30' },
        runtimeSeriesAvgEp: { value: '52' },
        runtimeMovie: { value: '' },
        relatedEntriesNames: { value: '' }
    };

    sandbox.getSeasonEpisodesCountsFromUI = function() {
        return [10, 10, 10];
    };

    sandbox.document.getElementById = function(id) {
        if (id === 'entryForm') return entryFormObj;
        if (id === 'editEntryId') return { value: '' };
        if (id === 'tmdbId') return { value: '124364' };
        if (id === 'tmdbMediaType') return { value: 'tv' };
        if (id === 'currentWatchHistory') return { value: '[]' };
        return { value: '', style: {}, innerHTML: '' };
    };

    const appCode = fs.readFileSync(path.join(__dirname, '../js/app.js'), 'utf8');
    vm.runInContext(appCode, sandbox);

    const mockEvent = { preventDefault: function() {} };
    await sandbox.handleFormSubmit(mockEvent, "quickSave");

    assert.equal(sandbox.movieData.length, 1);
    const saved = sandbox.movieData[0];
    assert.equal(saved.Name, "FROM");
    assert.equal(saved.Category, "Series");
    assert.equal(typeof saved.runtime, "object");
    assert.equal(saved.runtime.series_status, "Returning Series");
    assert.deepEqual(saved.runtime.episodes_per_season, [10, 10, 10]);
    assert.equal(saved.runtime.seasons, 3);
    assert.equal(saved.runtime.episodes, 30);
    assert.equal(saved.seriesStatus, "Returning Series");
    assert.equal(saved.series_status, "Returning Series");
});
