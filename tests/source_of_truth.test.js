/**
 * ============================================================================
 * SOURCE OF TRUTH CONTRACT TEST SUITE (source_of_truth.test.js)
 * ============================================================================
 *
 * This test suite defines and enforces the canonical Data Contract for KeepMoviEZ.
 * It prevents "Schema Drift" and ensures that changes to the database, TMDB extraction,
 * modal forms, backfill wizard, or import/export do not silently break other subsystems.
 *
 * ----------------------------------------------------------------------------
 * 📖 DEVELOPER GUIDE: HOW TO SAFELY ADD OR MODIFY A COLUMN IN KEEPMOVIEZ
 * ----------------------------------------------------------------------------
 * When adding, renaming, or modifying a database column / entity property:
 *
 *  [ ] STEP 1: Supabase Database
 *      - Add column to table in Supabase SQL Editor (or migration).
 *
 *  [ ] STEP 2: js/supabase.js
 *      - Update `localEntryToSupabaseFormat(entryToFormat, userId)` to map camelCase -> snake_case.
 *      - Update `supabaseEntryToLocalFormat(supabaseEntry)` to map snake_case -> camelCase.
 *
 *  [ ] STEP 3: js/tmdb.js (If fetched from TMDB)
 *      - Update `fetchAndProcessTmdbDetails(mediaType, id)` to extract & return the field.
 *      - Update `applyTmdbSelection(item, force)` to pass the field into `entryFormEl._tempTmdbData`.
 *
 *  [ ] STEP 4: js/ui.js & js/app.js (Modals & Form Submission)
 *      - In `prepareEditModal(id)`: Ensure the field is loaded into the form, or preserved
 *        inside `entryForm._tempTmdbData` if not directly editable by the user.
 *      - In `handleFormSubmit(event)`: Ensure the field is collected and saved into `entry`.
 *      - In `openDetailsModal(id)`: Ensure the field is rendered if user-facing.
 *
 *  [ ] STEP 5: js/backfill.js (If field can be backfilled)
 *      - In `BACKFILL_FIELDS`: Add field definition with the appropriate `inputType`.
 *      - In `extractFieldFromTmdb`: Add case to extract this field from TMDB payload.
 *      - In `isFieldMissing`: Add check if field requires special empty detection.
 *      - In `transformFieldValue`: Add transformation if format needs normalization.
 *
 *  [ ] STEP 6: js/input-output.js (Import & Export)
 *      - In `normalizeImportedRow`: Add field mapping and JSON parsing if it's an object/array.
 *      - In `backfillableFields`: Add field key if smart import can backfill it.
 *      - In `generateAndDownloadFile`: Ensure it is exported (and stringified for CSV).
 *
 *  [ ] STEP 7: tests/source_of_truth.test.js
 *      - Update the schema contracts in this file and run `node --test`.
 * ============================================================================
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// ----------------------------------------------------------------------------
// 1. CANONICAL CONTRACT DEFINITIONS (The Single Source of Truth)
// ----------------------------------------------------------------------------

/** All valid entity categories supported by KeepMoviEZ */
const CANONICAL_CATEGORIES = ['Movie', 'Series', 'Documentary'];
const VALID_CATEGORIES = CANONICAL_CATEGORIES;

/** All valid watch statuses */
const CANONICAL_STATUSES = ['To Watch', 'Watched', 'Continue', 'Unwatchable'];
const VALID_STATUSES = CANONICAL_STATUSES;

/** Core standard fields present on every local entry */
const CORE_FIELDS = [
    'id',
    'Name',
    'Category',
    'Genre',
    'Status',
    'Language',
    'Year',
    'Country',
    'Description',
    'Poster URL',
    'watchHistory',
    'relatedEntries',
    'lastModifiedDate'
];

/** Series-specific fields for tracking progress and seasons */
const SERIES_SPECIFIC_FIELDS = [
    'currentSeason',
    'currentEpisode',
    'seasonsCompleted',
    'currentSeasonEpisodesWatched',
    'episodesPerSeason',
    'episodes_per_season',
    'seriesStatus',
    'series_status'
];

/** Complex fields requiring structured JSON objects or arrays */
const COMPLEX_OBJECT_FIELDS = [
    'runtime',
    'director_info',
    'watchHistory',
    'full_cast',
    'keywords',
    'production_companies',
    'relatedEntries'
];

/**
 * Complete set of known Supabase columns (snake_case)
 */
const CANONICAL_SUPABASE_COLUMNS = [
    'id',
    'user_id',
    'name',
    'category',
    'genre',
    'status',
    'current_season',
    'current_episode',
    'recommendation',
    'overall_rating',
    'personal_recommendation',
    'language',
    'year',
    'country',
    'description',
    'poster_url',
    'watch_history',
    'related_entries',
    'do_not_recommend_daily',
    'last_modified_date',
    'tmdb_id',
    'tmdb_release_date',
    'tmdb_media_type',
    'keywords',
    'tmdb_collection_id',
    'tmdb_collection_name',
    'tmdb_collection_total_parts',
    'director_info',
    'full_cast',
    'production_companies',
    'tmdb_vote_average',
    'tmdb_vote_count',
    'runtime',
    'is_deleted',
    'imdb_id'
];

/**
 * Complete set of known Local Entry properties (PascalCase / camelCase)
 */
const CANONICAL_LOCAL_PROPERTIES = [
    'id',
    'Name',
    'Category',
    'Genre',
    'Status',
    'currentSeason',
    'currentEpisode',
    'seasonsCompleted',            // Backward compatibility alias
    'currentSeasonEpisodesWatched',// Backward compatibility alias
    'Recommendation',
    'overallRating',
    'personalRecommendation',
    'Language',
    'Year',
    'Country',
    'Description',
    'Poster URL',
    'watchHistory',
    'relatedEntries',
    'doNotRecommendDaily',
    'lastModifiedDate',
    'tmdbId',
    'tmdb_release_date',
    'tmdbMediaType',
    'keywords',
    'tmdb_collection_id',
    'tmdb_collection_name',
    'tmdb_collection_total_parts',
    'director_info',
    'full_cast',
    'production_companies',
    'tmdb_vote_average',
    'tmdb_vote_count',
    'runtime',
    'is_deleted',
    'imdb_id',
    'episodesPerSeason',
    'episodes_per_season',
    'seriesStatus',
    'series_status',
    '_sync_state'
];

/**
 * Complex / JSONB columns requiring object or array structure
 */
const COMPLEX_FIELD_TYPES = {
    runtime_series: 'object',
    director_info: 'object',
    watch_history: 'array',
    full_cast: 'array',
    keywords: 'array',
    production_companies: 'array',
    related_entries: 'array',
    episodes_per_season: 'array'
};

// ----------------------------------------------------------------------------
// TEST ENVIRONMENT SETUP (Load application modules in sandbox)
// ----------------------------------------------------------------------------

function setupSandbox() {
    function createInputElement(initialValue = '') {
        let _val = String(initialValue);
        return {
            get value() { return _val; },
            set value(v) { _val = v != null ? String(v) : ''; },
            dataset: {},
            focus: () => {},
            style: {},
            classList: { add: () => {}, remove: () => {}, contains: () => false },
            innerHTML: '',
            querySelector: () => createInputElement(''),
            querySelectorAll: () => [],
            addEventListener: () => {},
            appendChild: () => {},
            removeChild: () => {},
            remove: () => {}
        };
    }

    const domValues = {};
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
            is: () => false,
            toggle: () => $(selector),
            show: () => $(selector),
            hide: () => $(selector),
            modal: () => $(selector),
            removeClass: () => $(selector),
            addClass: () => $(selector),
            toast: () => $(selector),
            find: () => $(selector),
            each: function(cb) { return $(selector); },
            off: () => ({ on: () => {} }),
            on: () => $(selector),
            one: () => $(selector),
            empty: () => $(selector),
            append: () => $(selector),
            attr: () => $(selector),
            removeAttr: () => $(selector),
            data: () => null
        };
    };
    $.on = () => {};
    $.fn = { toast: () => {} };

    const entryFormEl = {
        reset: () => {},
        _tempTmdbData: {}
    };

    const domElements = {
        entryForm: entryFormEl,
        editEntryId: createInputElement(''),
        tmdbId: createInputElement(''),
        tmdbMediaType: createInputElement(''),
        currentWatchHistory: createInputElement('[]'),
        genreSearchInput: createInputElement(''),
        genreItemsContainer: createInputElement(''),
        advancedCollapse: createInputElement(''),
        advancedHeading: createInputElement(''),
        movieName: createInputElement(''),
        category: createInputElement('Movie'),
        status: createInputElement('To Watch'),
        recommendation: createInputElement(''),
        currentSeason: createInputElement(''),
        currentEpisode: createInputElement(''),
        seasonsCompleted: createInputElement(''),
        currentSeasonEpisodesWatched: createInputElement(''),
        runtimeMovie: createInputElement(''),
        runtimeSeriesSeasons: createInputElement(''),
        runtimeSeriesEpisodes: createInputElement(''),
        runtimeSeriesAvgEp: createInputElement(''),
        overallRating: createInputElement(''),
        personalRecommendation: createInputElement(''),
        description: createInputElement(''),
        language: createInputElement(''),
        year: createInputElement(''),
        country: createInputElement(''),
        editPosterUrl: createInputElement(''),
        editPosterPreview: createInputElement(''),
        editPosterPreviewContainer: createInputElement(''),
        lockedIndicator: createInputElement(''),
        tmdbSearchYear: createInputElement(''),
        relatedEntriesNames: createInputElement(''),
        relatedEntriesSuggestions: createInputElement(''),
        loadingOverlay: createInputElement(''),
        appContent: createInputElement(''),
        authContainer: createInputElement('')
    };

    const formFieldsGlob = {
        name: domElements.movieName,
        category: domElements.category,
        status: domElements.status,
        recommendation: domElements.recommendation,
        currentSeason: domElements.currentSeason,
        currentEpisode: domElements.currentEpisode,
        seasonsCompleted: domElements.seasonsCompleted,
        currentSeasonEpisodesWatched: domElements.currentSeasonEpisodesWatched,
        runtimeMovie: domElements.runtimeMovie,
        runtimeSeriesSeasons: domElements.runtimeSeriesSeasons,
        runtimeSeriesEpisodes: domElements.runtimeSeriesEpisodes,
        runtimeSeriesAvgEp: domElements.runtimeSeriesAvgEp,
        overallRating: domElements.overallRating,
        personalRecommendation: domElements.personalRecommendation,
        description: domElements.description,
        language: domElements.language,
        year: domElements.year,
        country: domElements.country,
        posterUrl: domElements.editPosterUrl,
        tmdbId: domElements.tmdbId,
        tmdbMediaType: domElements.tmdbMediaType,
        tmdbSearchYear: domElements.tmdbSearchYear,
        relatedEntriesNames: domElements.relatedEntriesNames,
        relatedEntriesSuggestions: domElements.relatedEntriesSuggestions
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
        encodeURIComponent,
        decodeURIComponent,
        JSON,
        Date,
        RegExp,
        Set,
        Map,
        $,
        window: {},
        document: {
            addEventListener: () => {},
            getElementById: (id) => {
                if (!domElements[id]) domElements[id] = createInputElement('');
                return domElements[id];
            },
            querySelector: () => createInputElement(''),
            querySelectorAll: () => [],
            createElement: () => createInputElement(''),
            body: { appendChild: () => {}, removeChild: () => {} },
            head: { appendChild: () => {} }
        },
        localStorage: {
            getItem: () => null,
            setItem: () => {},
            removeItem: () => {}
        },
        Papa: {
            unparse: (data) => JSON.stringify(data)
        },
        URL: { createObjectURL: () => 'blob:mock', revokeObjectURL: () => {} },
        Blob: class Blob {},
        IntersectionObserver: class IntersectionObserver {
            constructor() {}
            observe() {}
            unobserve() {}
            disconnect() {}
        },
        showToast: () => {},
        showLoading: () => {},
        hideLoading: () => {},
        generateUUID: () => '12345678-1234-4000-8000-123456789abc',
        supabase: { createClient: () => ({}) },
        movieData: [],
        selectedGenres: [],
        UNIQUE_ALL_GENRES: ['Action', 'Comedy', 'Drama', 'Documentary', 'Sci-Fi'],
        renderGenreTags: () => {},
        populateGenreDropdown: () => {},
        renderWatchHistoryUI: () => {},
        renderSeasonBreakdownCards: () => {},
        handlePosterUrlInput: () => {},
        updateEditSeriesPreview: () => {},
        getSeasonEpisodesCountsFromUI: () => [],
        isWatchRecordFormOpen: () => false,
        saveToIndexedDB: async () => {},
        trackModification: () => {},
        logWatchlistActivity: () => {},
        recalculateAndApplyAllRelationships: () => {},
        renderMovieCards: () => {},
        sortMovies: () => {},
        calculateAllStatistics: () => ({}),
        checkAndNotifyNewAchievements: () => {},
        parseInputForAutocomplete: (txt) => ({ finalized: [] }),
        countryCodeToNameMap: { US: 'United States', NP: 'Nepal', GB: 'United Kingdom' },
        DO_NOT_SHOW_AGAIN_KEYS: { ENTRY_ADDED: 'ea', ENTRY_UPDATED: 'eu' },
        currentSortColumn: 'lastModifiedDate',
        currentSortDirection: 'desc'
    };

    sandbox.window = sandbox;
    vm.createContext(sandbox);

    // Load dependencies in order
    const loadFile = (relPath) => {
        const fullPath = path.join(__dirname, '..', relPath);
        const code = fs.readFileSync(fullPath, 'utf8');
        vm.runInContext(code, sandbox);
    };

    loadFile('js/constant.js');
    loadFile('js/utils.js');
    loadFile('js/supabase.js');
    loadFile('js/tmdb.js');
    loadFile('js/backfill.js');
    loadFile('js/input-output.js');
    loadFile('js/ui.js');
    loadFile('js/app.js');

    // Attach active DOM form fields to lexical and global scopes
    sandbox.formFieldsGlob = formFieldsGlob;
    vm.runInContext('formFieldsGlob = window.formFieldsGlob;', sandbox);
    sandbox.domElements = domElements;
    sandbox.entryFormEl = entryFormEl;
    sandbox.renderMovieCards = () => {};
    sandbox.showToast = () => {};
    sandbox.calculateAllStatistics = () => ({});
    sandbox.checkAndNotifyNewAchievements = () => {};

    try {
        sandbox.BACKFILL_FIELDS = vm.runInContext('BACKFILL_FIELDS', sandbox);
    } catch (e) {
        sandbox.BACKFILL_FIELDS = null;
    }

    return sandbox;
}

// ----------------------------------------------------------------------------
// SECTION 1: SCHEMA DEFINITION SPECIFICATION CONTRACT
// ----------------------------------------------------------------------------

test('CONTRACT: Canonical Schema constants define complete KeepMoviEZ specification', () => {
    // 1. Categories
    assert.equal(VALID_CATEGORIES.length, 3);
    assert.ok(VALID_CATEGORIES.includes('Movie'));
    assert.ok(VALID_CATEGORIES.includes('Series'));
    assert.ok(VALID_CATEGORIES.includes('Documentary'));

    // 2. Statuses
    assert.equal(VALID_STATUSES.length, 4);
    assert.ok(VALID_STATUSES.includes('To Watch'));
    assert.ok(VALID_STATUSES.includes('Watched'));
    assert.ok(VALID_STATUSES.includes('Continue'));
    assert.ok(VALID_STATUSES.includes('Unwatchable'));

    // 3. Core fields
    for (const field of CORE_FIELDS) {
        assert.ok(CANONICAL_LOCAL_PROPERTIES.includes(field), `Core field "${field}" must be in CANONICAL_LOCAL_PROPERTIES`);
    }

    // 4. Series-specific fields
    for (const field of SERIES_SPECIFIC_FIELDS) {
        assert.ok(CANONICAL_LOCAL_PROPERTIES.includes(field), `Series-specific field "${field}" must be in CANONICAL_LOCAL_PROPERTIES`);
    }

    // 5. Complex JSONB columns in Supabase
    for (const field of COMPLEX_OBJECT_FIELDS) {
        const supabaseCol = field === 'watchHistory' ? 'watch_history' :
                            field === 'relatedEntries' ? 'related_entries' : field;
        assert.ok(CANONICAL_SUPABASE_COLUMNS.includes(supabaseCol), `Complex field "${supabaseCol}" must be in CANONICAL_SUPABASE_COLUMNS`);
    }
});

// ----------------------------------------------------------------------------
// SECTION 2: SUPABASE <-> LOCAL TWO-WAY TRANSLATION CONTRACT
// ----------------------------------------------------------------------------

test('CONTRACT: localEntryToSupabaseFormat maps all canonical columns without dropping fields', () => {
    const sandbox = setupSandbox();

    const sampleLocalEntry = {
        id: '12345678-1234-4000-8000-123456789abc',
        Name: 'Severance',
        Category: 'Series',
        Genre: 'Drama, Sci-Fi & Fantasy, Thriller',
        Status: 'Continue',
        currentSeason: 2,
        currentEpisode: 4,
        seasonsCompleted: 1,
        currentSeasonEpisodesWatched: 4,
        Recommendation: 'Must Watch',
        overallRating: '5',
        personalRecommendation: 'Mind blowing',
        Language: 'English',
        Year: '2022',
        Country: 'US',
        Description: 'Mark leads a team of office workers whose memories have been surgically divided.',
        'Poster URL': 'https://image.tmdb.org/t/p/w500/poster.jpg',
        watchHistory: [
            { watchId: '12345678-1234-4000-8000-111111111111', date: '2025-01-01', rating: '5', notes: 'S1' }
        ],
        relatedEntries: ['12345678-1234-4000-8000-999999999999'],
        doNotRecommendDaily: false,
        lastModifiedDate: '2025-01-01T00:00:00.000Z',
        tmdbId: '95396',
        tmdb_release_date: '2022-02-17',
        tmdbMediaType: 'tv',
        keywords: [{ id: 1, name: 'workplace' }],
        tmdb_collection_id: null,
        tmdb_collection_name: null,
        tmdb_collection_total_parts: null,
        director_info: {
            id: 10,
            name: 'Ben Stiller',
            job: 'Director',
            profile_path: '/stiller.jpg'
        },
        full_cast: [{ id: 20, name: 'Adam Scott', character: 'Mark Scout' }],
        production_companies: [{ id: 30, name: 'Red Hour Productions' }],
        tmdb_vote_average: 8.4,
        tmdb_vote_count: 1500,
        runtime: {
            seasons: 2,
            episodes: 19,
            episode_run_time: 55,
            episodes_per_season: [9, 10],
            series_status: 'Returning Series'
        },
        is_deleted: false,
        imdb_id: 'tt11280740',
        episodesPerSeason: [9, 10],
        episodes_per_season: [9, 10],
        seriesStatus: 'Returning Series',
        series_status: 'Returning Series'
    };

    const supabaseRow = sandbox.localEntryToSupabaseFormat(sampleLocalEntry, 'user_test_123');

    // 1. Verify user_id is assigned
    assert.equal(supabaseRow.user_id, 'user_test_123');

    // 2. Verify all known Supabase columns exist in the converted row
    for (const col of CANONICAL_SUPABASE_COLUMNS) {
        assert.ok(
            col in supabaseRow,
            `Missing column "${col}" in localEntryToSupabaseFormat output!`
        );
    }

    // 3. Verify specific column data mapping & types
    assert.equal(supabaseRow.id, sampleLocalEntry.id);
    assert.equal(supabaseRow.name, 'Severance');
    assert.equal(supabaseRow.category, 'Series');
    assert.equal(supabaseRow.status, 'Continue');
    assert.equal(supabaseRow.current_season, 2);
    assert.equal(supabaseRow.current_episode, 4);
    assert.equal(supabaseRow.year, 2022);
    assert.equal(supabaseRow.tmdb_id, 95396);
    assert.equal(supabaseRow.imdb_id, 'tt11280740');
    assert.equal(supabaseRow.overall_rating, 5);

    // 4. Verify Series runtime JSON packaging
    assert.equal(typeof supabaseRow.runtime, 'object');
    assert.deepEqual(Array.from(supabaseRow.runtime.episodes_per_season), [9, 10]);
    assert.equal(supabaseRow.runtime.series_status, 'Returning Series');

    // 5. Verify complex JSON objects
    assert.equal(supabaseRow.director_info.name, 'Ben Stiller');
    assert.equal(supabaseRow.full_cast.length, 1);
    assert.equal(supabaseRow.keywords.length, 1);
    assert.equal(supabaseRow.production_companies.length, 1);
    assert.equal(supabaseRow.watch_history.length, 1);
    assert.equal(supabaseRow.related_entries.length, 1);
});

test('CONTRACT: supabaseEntryToLocalFormat unpacks all columns accurately into local entry', () => {
    const sandbox = setupSandbox();

    const sampleSupabaseRow = {
        id: '12345678-1234-4000-8000-123456789abc',
        user_id: 'user_test_123',
        name: 'Inception',
        category: 'Movie',
        genre: 'Action, Sci-Fi',
        status: 'Watched',
        current_season: null,
        current_episode: null,
        recommendation: 'Must Watch',
        overall_rating: 5,
        personal_recommendation: 'Masterpiece',
        language: 'English',
        year: 2010,
        country: 'US',
        description: 'A thief steals corporate secrets through dream-sharing.',
        poster_url: 'https://image.tmdb.org/t/p/w500/inception.jpg',
        watch_history: [
            { watchId: '12345678-1234-4000-8000-222222222222', date: '2024-05-01', rating: '5', notes: 'First watch' }
        ],
        related_entries: ['12345678-1234-4000-8000-888888888888'],
        do_not_recommend_daily: false,
        last_modified_date: '2025-01-01T00:00:00Z',
        tmdb_id: 27205,
        tmdb_release_date: '2010-07-15',
        tmdb_media_type: 'movie',
        keywords: [{ id: 1, name: 'dream' }],
        tmdb_collection_id: null,
        tmdb_collection_name: null,
        tmdb_collection_total_parts: null,
        director_info: { id: 525, name: 'Christopher Nolan', job: 'Director' },
        full_cast: [{ id: 6193, name: 'Leonardo DiCaprio', character: 'Cobb' }],
        production_companies: [{ id: 923, name: 'Legendary Pictures' }],
        tmdb_vote_average: 8.364,
        tmdb_vote_count: 36000,
        runtime: 148,
        is_deleted: false,
        imdb_id: 'tt1375666'
    };

    const localEntry = sandbox.supabaseEntryToLocalFormat(sampleSupabaseRow);

    assert.ok(localEntry !== null);

    // Verify key fields match local conventions
    assert.equal(localEntry.id, sampleSupabaseRow.id);
    assert.equal(localEntry.Name, 'Inception');
    assert.equal(localEntry.Category, 'Movie');
    assert.equal(localEntry.Status, 'Watched');
    assert.equal(localEntry.overallRating, '5'); // Local rating stored as string for input compatibility
    assert.equal(localEntry.Year, '2010');        // Local year stored as string for input compatibility
    assert.equal(localEntry.tmdbId, '27205');     // Local tmdbId stored as string
    assert.equal(localEntry.runtime, 148);        // Movie runtime is a number
    assert.equal(localEntry.imdb_id, 'tt1375666');
    assert.equal(localEntry.director_info.name, 'Christopher Nolan');
    assert.equal(localEntry.full_cast.length, 1);
    assert.equal(localEntry.watchHistory.length, 1);
    assert.equal(localEntry._sync_state, 'synced');
});

test('CONTRACT: Round-trip fidelity (local -> supabase -> local) preserves all data without mutation', () => {
    const sandbox = setupSandbox();

    const originalSeriesEntry = {
        id: '12345678-1234-4000-8000-123456789abc',
        Name: 'Breaking Bad',
        Category: 'Series',
        Genre: 'Crime, Drama, Thriller',
        Status: 'Watched',
        currentSeason: 5,
        currentEpisode: 16,
        Recommendation: 'Must Watch',
        overallRating: '5',
        personalRecommendation: 'Best show ever',
        Language: 'English',
        Year: '2008',
        Country: 'US',
        Description: 'A high school chemistry teacher diagnosed with terminal lung cancer.',
        'Poster URL': 'https://image.tmdb.org/t/p/w500/bb.jpg',
        watchHistory: [
            { watchId: '12345678-1234-4000-8000-333333333333', date: '2023-01-01', rating: '5', notes: 'Complete series' }
        ],
        relatedEntries: ['12345678-1234-4000-8000-444444444444'],
        doNotRecommendDaily: true,
        lastModifiedDate: '2025-01-01T00:00:00.000Z',
        tmdbId: '1396',
        tmdb_release_date: '2008-01-20',
        tmdbMediaType: 'tv',
        keywords: [{ id: 1, name: 'meth' }],
        tmdb_collection_id: null,
        tmdb_collection_name: null,
        tmdb_collection_total_parts: null,
        director_info: { id: 66633, name: 'Vince Gilligan', job: 'Creator' },
        full_cast: [{ id: 17419, name: 'Bryan Cranston', character: 'Walter White' }],
        production_companies: [{ id: 11073, name: 'Sony Pictures Television' }],
        tmdb_vote_average: 8.9,
        tmdb_vote_count: 14000,
        runtime: {
            seasons: 5,
            episodes: 62,
            episode_run_time: 47,
            episodes_per_season: [7, 13, 13, 13, 16],
            series_status: 'Ended'
        },
        is_deleted: false,
        imdb_id: 'tt0903747',
        episodesPerSeason: [7, 13, 13, 13, 16],
        episodes_per_season: [7, 13, 13, 13, 16],
        seriesStatus: 'Ended',
        series_status: 'Ended'
    };

    // Convert local -> supabase
    const supabaseRow = sandbox.localEntryToSupabaseFormat(originalSeriesEntry, 'user_roundtrip');

    // Convert supabase -> local
    const roundTripEntry = sandbox.supabaseEntryToLocalFormat(supabaseRow);

    // Assert zero loss of critical properties
    assert.equal(roundTripEntry.id, originalSeriesEntry.id);
    assert.equal(roundTripEntry.Name, originalSeriesEntry.Name);
    assert.equal(roundTripEntry.Category, originalSeriesEntry.Category);
    assert.equal(roundTripEntry.Status, originalSeriesEntry.Status);
    assert.equal(roundTripEntry.Year, originalSeriesEntry.Year);
    assert.equal(roundTripEntry.Country, originalSeriesEntry.Country);
    assert.equal(roundTripEntry.overallRating, originalSeriesEntry.overallRating);
    assert.equal(roundTripEntry.tmdbId, originalSeriesEntry.tmdbId);
    assert.equal(roundTripEntry.imdb_id, originalSeriesEntry.imdb_id);
    assert.equal(roundTripEntry.doNotRecommendDaily, true);
    assert.equal(roundTripEntry.director_info.name, 'Vince Gilligan');
    assert.deepEqual(Array.from(roundTripEntry.episodesPerSeason), [7, 13, 13, 13, 16]);
    assert.equal(roundTripEntry.seriesStatus, 'Ended');
    assert.equal(roundTripEntry.runtime.episode_run_time, 47);
});

test('CONTRACT: Translation Contract handles nulls, empty values, and legacy fallbacks safely', () => {
    const sandbox = setupSandbox();

    // 1. Legacy fallback: seasonsCompleted -> current_season
    const legacyLocalEntry = {
        id: 'legacy-id-1',
        Name: 'Legacy Show',
        Category: 'Series',
        Status: 'Continue',
        seasonsCompleted: 2, // seasonsCompleted = 2 implies currently watching Season 3
        currentSeasonEpisodesWatched: 5,
        Year: '',            // Empty string should become null in Supabase
        overallRating: '',   // Empty string should become null in Supabase
        tmdbId: ''
    };

    const supabaseRow = sandbox.localEntryToSupabaseFormat(legacyLocalEntry, 'user_legacy');
    assert.equal(supabaseRow.current_season, 3, 'seasonsCompleted: 2 must map to current_season: 3');
    assert.equal(supabaseRow.current_episode, 5, 'currentSeasonEpisodesWatched: 5 must map to current_episode: 5');
    assert.equal(supabaseRow.year, null, 'Empty year string must convert to null for SQL numeric type safety');
    assert.equal(supabaseRow.overall_rating, null, 'Empty rating string must convert to null for SQL numeric type safety');
    assert.equal(supabaseRow.tmdb_id, null, 'Empty tmdbId must convert to null for SQL numeric type safety');

    // 2. Reverse legacy unpacking: current_season: 4 -> currentSeason: 4, seasonsCompleted: 3
    const legacySupabaseRow = {
        id: 'legacy-id-2',
        name: 'Unpacked Show',
        category: 'Series',
        status: 'Continue',
        current_season: 4,
        current_episode: 7,
        watch_history: null,       // Null in Supabase should unpack to [] locally
        keywords: null,
        related_entries: null,
        full_cast: null,
        production_companies: null
    };

    const localUnpacked = sandbox.supabaseEntryToLocalFormat(legacySupabaseRow);
    assert.equal(localUnpacked.currentSeason, 4);
    assert.equal(localUnpacked.seasonsCompleted, 3);
    assert.equal(localUnpacked.currentEpisode, 7);
    assert.equal(localUnpacked.currentSeasonEpisodesWatched, 7);
    assert.ok(Array.isArray(localUnpacked.watchHistory), 'null watch_history must become empty array');
    assert.ok(Array.isArray(localUnpacked.keywords), 'null keywords must become empty array');
    assert.ok(Array.isArray(localUnpacked.relatedEntries), 'null related_entries must become empty array');
    assert.ok(Array.isArray(localUnpacked.full_cast), 'null full_cast must become empty array');
    assert.ok(Array.isArray(localUnpacked.production_companies), 'null production_companies must become empty array');
});

// ----------------------------------------------------------------------------
// SECTION 3: TMDB EXTRACTION & INGESTION CONTRACT
// ----------------------------------------------------------------------------

test('CONTRACT: fetchAndProcessTmdbDetails extracts Movie and TV schemas accurately (including TV creator)', async () => {
    const sandbox = setupSandbox();

    // 1. Test Movie Extraction
    sandbox.callTmdbApiDirect = async (endpoint) => {
        if (endpoint.includes('/movie/')) {
            return {
                title: 'Oppenheimer',
                release_date: '2023-07-21',
                runtime: 180,
                genres: [{ id: 18, name: 'Drama' }, { id: 36, name: 'History' }],
                production_countries: [{ iso_3166_1: 'US', name: 'United States' }],
                spoken_languages: [{ iso_639_1: 'en', english_name: 'English' }],
                original_language: 'en',
                overview: 'The story of J. Robert Oppenheimer.',
                poster_path: '/oppenheimer.jpg',
                credits: {
                    cast: [{ id: 1, name: 'Cillian Murphy', character: 'J. Robert Oppenheimer', profile_path: '/cm.jpg', order: 0 }],
                    crew: [{ id: 525, name: 'Christopher Nolan', job: 'Director', profile_path: '/cn.jpg' }]
                },
                keywords: { keywords: [{ id: 10, name: 'atomic bomb' }] },
                production_companies: [{ id: 33, name: 'Universal Pictures', logo_path: '/u.png', origin_country: 'US' }],
                vote_average: 8.1,
                vote_count: 9000,
                external_ids: { imdb_id: 'tt15398776' }
            };
        } else if (endpoint.includes('/tv/')) {
            return {
                name: 'The Last of Us',
                first_air_date: '2023-01-15',
                status: 'Returning Series',
                number_of_seasons: 1,
                number_of_episodes: 9,
                episode_run_time: [50],
                genres: [{ id: 18, name: 'Drama' }, { id: 10765, name: 'Sci-Fi & Fantasy' }],
                production_countries: [{ iso_3166_1: 'US' }],
                spoken_languages: [{ iso_639_1: 'en', english_name: 'English' }],
                original_language: 'en',
                overview: 'Post-apocalyptic drama.',
                poster_path: '/tlou.jpg',
                seasons: [
                    { season_number: 0, episode_count: 2 }, // Specials - must be excluded
                    { season_number: 1, episode_count: 9 }
                ],
                created_by: [{ id: 80, name: 'Craig Mazin', profile_path: '/mazin.jpg' }],
                credits: {
                    cast: [{ id: 2, name: 'Pedro Pascal', character: 'Joel Miller', profile_path: '/pp.jpg', order: 0 }],
                    crew: [] // No Director in crew - must extract Craig Mazin as Creator!
                },
                keywords: { results: [{ id: 20, name: 'fungus' }] },
                production_companies: [{ id: 40, name: 'HBO', logo_path: '/hbo.png', origin_country: 'US' }],
                vote_average: 8.6,
                vote_count: 5000,
                external_ids: { imdb_id: 'tt3581920' }
            };
        }
        return null;
    };

    // Execute Movie processing
    const movieResult = await sandbox.fetchAndProcessTmdbDetails('movie', 872585);
    assert.equal(movieResult.Name, 'Oppenheimer');
    assert.equal(movieResult.Category, 'Movie');
    assert.equal(movieResult.Year, '2023');
    assert.equal(movieResult.Country, 'US');
    assert.equal(movieResult.Language, 'English');
    assert.equal(movieResult.runtime, 180, 'Movie runtime must be a numeric value in minutes');
    assert.equal(movieResult.director_info.name, 'Christopher Nolan');
    assert.equal(movieResult.director_info.job, 'Director');
    assert.equal(movieResult.imdb_id, 'tt15398776');
    assert.equal(movieResult.full_cast.length, 1);
    assert.equal(movieResult.keywords.length, 1);

    // Execute TV Series processing
    const tvResult = await sandbox.fetchAndProcessTmdbDetails('tv', 100088);
    assert.equal(tvResult.Name, 'The Last of Us');
    assert.equal(tvResult.Category, 'Series');
    assert.equal(tvResult.Year, '2023');
    assert.equal(typeof tvResult.runtime, 'object', 'TV runtime must be an object structure');
    assert.equal(tvResult.runtime.seasons, 1);
    assert.equal(tvResult.runtime.episodes, 9);
    assert.equal(tvResult.runtime.episode_run_time, 50);
    assert.deepEqual(Array.from(tvResult.runtime.episodes_per_season), [9], 'Specials season 0 must be filtered out');
    assert.equal(tvResult.director_info.name, 'Craig Mazin');
    assert.equal(tvResult.director_info.job, 'Creator', 'TV shows with created_by must extract Creator into director_info');
    assert.equal(tvResult.seriesStatus, 'Returning Series');
    assert.equal(tvResult.imdb_id, 'tt3581920');
});

test('CONTRACT: applyTmdbSelection ingests TMDB metadata into _tempTmdbData and form fields', async () => {
    const sandbox = setupSandbox();

    sandbox.callTmdbApiDirect = async () => ({
        title: 'Dune: Part Two',
        release_date: '2024-03-01',
        runtime: 166,
        genres: [{ id: 878, name: 'Science Fiction' }],
        production_countries: [{ iso_3166_1: 'US' }],
        spoken_languages: [{ iso_639_1: 'en', english_name: 'English' }],
        original_language: 'en',
        overview: 'Paul Atreides unites with Chani.',
        poster_path: '/dune2.jpg',
        credits: {
            cast: [{ id: 1, name: 'Timothée Chalamet', character: 'Paul Atreides', profile_path: '/tc.jpg', order: 0 }],
            crew: [{ id: 137427, name: 'Denis Villeneuve', job: 'Director', profile_path: '/dv.jpg' }]
        },
        keywords: { keywords: [{ id: 1, name: 'desert' }] },
        production_companies: [{ id: 923, name: 'Legendary', logo_path: '/l.png', origin_country: 'US' }],
        belongs_to_collection: { id: 726871, name: 'Dune Collection' },
        vote_average: 8.2,
        vote_count: 6000,
        external_ids: { imdb_id: 'tt15239678' }
    });

    const item = { id: 693134, media_type: 'movie', title: 'Dune: Part Two' };
    await sandbox.applyTmdbSelection(item, true);

    // Verify form fields populated
    assert.equal(sandbox.formFieldsGlob.name.value, 'Dune: Part Two');
    assert.equal(sandbox.formFieldsGlob.year.value, '2024');
    assert.equal(sandbox.formFieldsGlob.country.value, 'US');
    assert.equal(sandbox.formFieldsGlob.language.value, 'English');
    assert.equal(sandbox.formFieldsGlob.runtimeMovie.value, '166');

    // Verify _tempTmdbData captured uneditable metadata
    const temp = sandbox.entryFormEl._tempTmdbData;
    assert.ok(temp, '_tempTmdbData must be populated on entryForm');
    assert.equal(temp.director_info.name, 'Denis Villeneuve');
    assert.equal(temp.full_cast[0].name, 'Timothée Chalamet');
    assert.equal(temp.keywords[0].name, 'desert');
    assert.equal(temp.production_companies[0].name, 'Legendary');
    assert.equal(temp.imdb_id, 'tt15239678');
    assert.equal(temp.runtime, 166);
});

// ----------------------------------------------------------------------------
// SECTION 4: ADD / EDIT FORM INTEGRITY CONTRACT
// ----------------------------------------------------------------------------

test('CONTRACT: prepareEditModal loads editable fields and preserves uneditable metadata in _tempTmdbData', () => {
    const sandbox = setupSandbox();

    const sampleSeries = {
        id: 'series-edit-uuid',
        Name: 'Succession',
        Category: 'Series',
        Status: 'Continue',
        currentSeason: 4,
        currentEpisode: 3,
        Recommendation: 'Must Watch',
        overallRating: '5',
        personalRecommendation: 'Brilliant dialogue',
        Language: 'English',
        Year: '2018',
        Country: 'US',
        Description: 'The Roy family controls Waystar RoyCo.',
        'Poster URL': 'https://image.tmdb.org/succession.jpg',
        watchHistory: [{ watchId: 'w1', date: '2023-04-01', rating: '5' }],
        relatedEntries: [],
        lastModifiedDate: '2024-01-01T00:00:00.000Z',
        tmdbId: '76331',
        tmdbMediaType: 'tv',
        keywords: [{ id: 1, name: 'media tycoon' }],
        director_info: { id: 10, name: 'Jesse Armstrong', job: 'Creator' },
        full_cast: [{ id: 20, name: 'Brian Cox', character: 'Logan Roy' }],
        production_companies: [{ id: 30, name: 'Gary Sanchez Productions' }],
        tmdb_vote_average: 8.9,
        tmdb_vote_count: 2500,
        runtime: {
            seasons: 4,
            episodes: 39,
            episode_run_time: 60,
            episodes_per_season: [10, 10, 9, 10],
            series_status: 'Ended'
        },
        episodesPerSeason: [10, 10, 9, 10],
        seriesStatus: 'Ended',
        imdb_id: 'tt7660850'
    };

    sandbox.movieData = [sampleSeries];
    sandbox.prepareEditModal('series-edit-uuid', false);

    // 1. Verify editable fields populated into form
    assert.equal(sandbox.formFieldsGlob.name.value, 'Succession');
    assert.equal(sandbox.formFieldsGlob.category.value, 'Series');
    assert.equal(sandbox.formFieldsGlob.status.value, 'Continue');
    assert.equal(sandbox.formFieldsGlob.currentSeason.value, '4');
    assert.equal(sandbox.formFieldsGlob.currentEpisode.value, '3');
    assert.equal(sandbox.formFieldsGlob.year.value, '2018');
    assert.equal(sandbox.formFieldsGlob.country.value, 'US');
    assert.equal(sandbox.formFieldsGlob.runtimeSeriesSeasons.value, '4');
    assert.equal(sandbox.formFieldsGlob.runtimeSeriesEpisodes.value, '39');
    assert.equal(sandbox.formFieldsGlob.runtimeSeriesAvgEp.value, '60');

    // 2. Verify uneditable fields preserved inside _tempTmdbData
    const temp = sandbox.entryFormEl._tempTmdbData;
    assert.ok(temp, '_tempTmdbData must be created on entryForm');
    assert.equal(temp.director_info.name, 'Jesse Armstrong');
    assert.equal(temp.director_info.job, 'Creator');
    assert.equal(temp.full_cast[0].name, 'Brian Cox');
    assert.equal(temp.keywords[0].name, 'media tycoon');
    assert.equal(temp.production_companies[0].name, 'Gary Sanchez Productions');
    assert.equal(temp.imdb_id, 'tt7660850');
    assert.equal(temp.seriesStatus, 'Ended');
    assert.deepEqual(Array.from(temp.episodesPerSeason), [10, 10, 9, 10]);
});

test('CONTRACT: handleFormSubmit constructs canonical entry satisfying the Source of Truth schema', async () => {
    const sandbox = setupSandbox();

    // 1. Submit a new Movie
    sandbox.movieData = [];
    sandbox.domElements.editEntryId.value = '';
    sandbox.domElements.tmdbId.value = '550';
    sandbox.domElements.tmdbMediaType.value = 'movie';

    sandbox.formFieldsGlob.name.value = 'Fight Club';
    sandbox.formFieldsGlob.category.value = 'Movie';
    sandbox.formFieldsGlob.status.value = 'Watched';
    sandbox.formFieldsGlob.recommendation.value = 'Must Watch';
    sandbox.formFieldsGlob.overallRating.value = '5';
    sandbox.formFieldsGlob.year.value = '1999';
    sandbox.formFieldsGlob.country.value = 'US';
    sandbox.formFieldsGlob.language.value = 'English';
    sandbox.formFieldsGlob.description.value = 'An insomniac office worker...';
    sandbox.formFieldsGlob.posterUrl.value = 'https://image.tmdb.org/fc.jpg';
    sandbox.formFieldsGlob.posterUrl.dataset = { source: 'tmdb' };
    sandbox.formFieldsGlob.runtimeMovie.value = '139';

    sandbox.entryFormEl._tempTmdbData = {
        keywords: [{ id: 1, name: 'soap' }],
        full_cast: [{ id: 2, name: 'Brad Pitt' }],
        director_info: { id: 3, name: 'David Fincher', job: 'Director' },
        production_companies: [{ id: 4, name: 'Fox 2000' }],
        imdb_id: 'tt0137523'
    };

    const mockEvent = { preventDefault: () => {} };
    await sandbox.handleFormSubmit(mockEvent, 'quickSave');

    const savedMovie = sandbox.movieData[0];
    assert.ok(savedMovie, 'Entry must be saved into movieData');
    assert.equal(savedMovie.Name, 'Fight Club');
    assert.equal(savedMovie.Category, 'Movie');
    assert.equal(savedMovie.Status, 'Watched');
    assert.equal(savedMovie.runtime, 139, 'Movie runtime must be numeric');
    assert.equal(savedMovie.director_info.name, 'David Fincher');
    assert.equal(savedMovie._sync_state, 'new', 'New entry must have _sync_state "new"');
    assert.ok(savedMovie.lastModifiedDate, 'lastModifiedDate must be populated');

    // Verify all properties on the saved entry belong to the canonical schema
    for (const key of Object.keys(savedMovie)) {
        assert.ok(
            CANONICAL_LOCAL_PROPERTIES.includes(key),
            `handleFormSubmit produced stray/unexpected property "${key}" not in CANONICAL_LOCAL_PROPERTIES!`
        );
    }
});

// ----------------------------------------------------------------------------
// SECTION 5: BACKFILL SYSTEM ALIGNMENT CONTRACT
// ----------------------------------------------------------------------------

test('CONTRACT: Backfill field configurations align with entity data types', () => {
    const sandbox = setupSandbox();

    assert.ok(Array.isArray(sandbox.BACKFILL_FIELDS), 'BACKFILL_FIELDS must be an array');

    const backfillKeys = sandbox.BACKFILL_FIELDS.map(f => f.key);

    // 1. Critical fields must exist in Backfill
    const requiredBackfillFields = [
        'runtime',
        'episodes_per_season',
        'currentSeason',
        'currentEpisode',
        'Year',
        'Country',
        'Language',
        'Status',
        'Genre',
        'tmdb_release_date',
        'director_info',
        'Description',
        'Poster URL',
        'imdb_id'
    ];

    for (const key of requiredBackfillFields) {
        assert.ok(
            backfillKeys.includes(key),
            `Field "${key}" is missing from BACKFILL_FIELDS configuration in backfill.js!`
        );
    }

    // 2. Data type contracts for specialized fields
    const directorField = sandbox.BACKFILL_FIELDS.find(f => f.key === 'director_info');
    assert.equal(
        directorField.inputType,
        'director-chips',
        'director_info in backfill must use "director-chips" inputType to preserve object structure, not plain text!'
    );
    assert.equal(
        directorField.saveFormat,
        'tmdb-json',
        'director_info in backfill must specify saveFormat "tmdb-json"'
    );

    const episodesField = sandbox.BACKFILL_FIELDS.find(f => f.key === 'episodes_per_season');
    assert.equal(
        episodesField.inputType,
        'season-episodes',
        'episodes_per_season in backfill must use "season-episodes" inputType!'
    );
    assert.deepEqual(
        Array.from(episodesField.onlyFor),
        ['Series'],
        'episodes_per_season must be restricted to Series category only'
    );
});

test('CONTRACT: Backfill extractFieldFromTmdb correctly parses both Movie and TV payloads', () => {
    const sandbox = setupSandbox();

    // Mock TMDB Movie response
    const movieData = {
        runtime: 148,
        release_date: '2010-07-16',
        production_countries: [{ iso_3166_1: 'US', name: 'United States' }],
        spoken_languages: [{ iso_639_1: 'en', english_name: 'English' }],
        original_language: 'en',
        overview: 'Inception synopsis',
        poster_path: '/inception.jpg',
        credits: {
            crew: [{ job: 'Director', name: 'Christopher Nolan', id: 525, profile_path: '/path.jpg' }]
        },
        external_ids: { imdb_id: 'tt1375666' }
    };

    assert.equal(sandbox.extractFieldFromTmdb('runtime', movieData, 'movie'), 148);
    assert.equal(sandbox.extractFieldFromTmdb('Year', movieData, 'movie'), 2010);
    assert.equal(sandbox.extractFieldFromTmdb('Country', movieData, 'movie'), 'US');
    assert.equal(sandbox.extractFieldFromTmdb('Language', movieData, 'movie'), 'English');
    assert.equal(sandbox.extractFieldFromTmdb('imdb_id', movieData, 'movie'), 'tt1375666');
    const movieDirs = sandbox.extractFieldFromTmdb('director_info', movieData, 'movie');
    assert.equal(movieDirs[0].name, 'Christopher Nolan');
    assert.equal(movieDirs[0].job, 'Director');

    // Mock TMDB TV response
    const tvData = {
        number_of_seasons: 2,
        number_of_episodes: 16,
        first_air_date: '2020-01-01',
        episode_run_time: [45],
        seasons: [
            { season_number: 0, episode_count: 1 }, // Specials should be excluded
            { season_number: 1, episode_count: 8 },
            { season_number: 2, episode_count: 8 }
        ],
        created_by: [{ id: 99, name: 'Show Creator', profile_path: '/c.jpg' }],
        credits: { crew: [] },
        external_ids: { imdb_id: 'tt9999999' }
    };

    assert.equal(sandbox.extractFieldFromTmdb('runtime', tvData, 'tv'), 45);
    assert.deepEqual(Array.from(sandbox.extractFieldFromTmdb('episodes_per_season', tvData, 'tv')), [8, 8]);
    const tvDirs = sandbox.extractFieldFromTmdb('director_info', tvData, 'tv');
    assert.equal(tvDirs[0].name, 'Show Creator');
    assert.equal(tvDirs[0].job, 'Creator');
});

test('CONTRACT: Backfill isFieldMissing accurately detects missing states across all supported field types', () => {
    const sandbox = setupSandbox();

    // 1. episodes_per_season
    assert.equal(sandbox.isFieldMissing({ Category: 'Movie' }, 'episodes_per_season'), false, 'episodes_per_season is never missing for Movie');
    assert.equal(sandbox.isFieldMissing({ Category: 'Series', runtime: { episodes_per_season: [] } }, 'episodes_per_season'), true);
    assert.equal(sandbox.isFieldMissing({ Category: 'Series', runtime: { episodes_per_season: [8, 8] } }, 'episodes_per_season'), false);

    // 2. runtime
    assert.equal(sandbox.isFieldMissing({ Category: 'Movie', runtime: null }, 'runtime'), true);
    assert.equal(sandbox.isFieldMissing({ Category: 'Movie', runtime: 120 }, 'runtime'), false);
    assert.equal(sandbox.isFieldMissing({ Category: 'Series', runtime: { episode_run_time: null } }, 'runtime'), true);
    assert.equal(sandbox.isFieldMissing({ Category: 'Series', runtime: { episode_run_time: 45 } }, 'runtime'), false);

    // 3. director_info
    assert.equal(sandbox.isFieldMissing({ director_info: null }, 'director_info'), true);
    assert.equal(sandbox.isFieldMissing({ director_info: '' }, 'director_info'), true);
    assert.equal(sandbox.isFieldMissing({ director_info: [] }, 'director_info'), true);
    assert.equal(sandbox.isFieldMissing({ director_info: { id: 1, name: '' } }, 'director_info'), true);
    assert.equal(sandbox.isFieldMissing({ director_info: { id: 1, name: 'James Cameron' } }, 'director_info'), false);

    // 4. Numeric Progress fields (0 is valid for currentEpisode, not missing!)
    assert.equal(sandbox.isFieldMissing({ currentEpisode: 0 }, 'currentEpisode'), false, 'Episode 0 is valid progress, not missing');
    assert.equal(sandbox.isFieldMissing({ currentEpisode: null }, 'currentEpisode'), true);
    assert.equal(sandbox.isFieldMissing({ currentEpisode: '' }, 'currentEpisode'), true);
});

test('CONTRACT: Backfill transformFieldValue normalizes values according to target data contract', () => {
    const sandbox = setupSandbox();

    // 1. episodes_per_season from string or array
    assert.deepEqual(Array.from(sandbox.transformFieldValue('episodes_per_season', '8, 10, 12', {}, {})), [8, 10, 12]);
    assert.deepEqual(Array.from(sandbox.transformFieldValue('episodes_per_season', ['8', '10', '12'], {}, {})), [8, 10, 12]);

    // 2. director_info normalization into { id, name, job, directors }
    const inputDirectors = [{ id: 1, name: 'The Wachowskis', job: 'Director' }, { id: 2, name: 'Lilly Wachowski', job: 'Director' }];
    const transformedDir = sandbox.transformFieldValue('director_info', inputDirectors, {}, {});
    assert.equal(transformedDir.id, 1);
    assert.ok(transformedDir.name.includes('The Wachowskis'));
    assert.ok(Array.isArray(transformedDir.directors));

    // 3. runtime Series object vs Movie numeric
    const seriesEntry = { Category: 'Series', runtime: { seasons: 2, episodes: 16 } };
    const transformedSeriesRuntime = sandbox.transformFieldValue('runtime', '45', {}, seriesEntry);
    assert.equal(typeof transformedSeriesRuntime, 'object');
    assert.equal(transformedSeriesRuntime.episode_run_time, 45);

    const movieEntry = { Category: 'Movie' };
    const transformedMovieRuntime = sandbox.transformFieldValue('runtime', '120', {}, movieEntry);
    assert.equal(transformedMovieRuntime, 120);
});

// ----------------------------------------------------------------------------
// SECTION 6: IMPORT & EXPORT CONTRACT
// ----------------------------------------------------------------------------

test('CONTRACT: Import normalizer (normalizeImportedRow) safely handles stringified JSON and aliases', () => {
    const sandbox = setupSandbox();

    const rawExportRow = {
        id: '12345678-1234-4000-8000-123456789abc',
        Name: 'Ted Lasso',
        Category: 'Series',
        Status: 'Continue',
        currentSeason: 3,
        currentEpisode: 6,
        Year: '2020',
        runtime: JSON.stringify({ seasons: 3, episodes: 34, episode_run_time: 40 }),
        keywords: JSON.stringify([{ id: 1, name: 'football' }]),
        director_info: JSON.stringify({ name: 'Bill Lawrence', job: 'Creator' }),
        full_cast: JSON.stringify([{ name: 'Jason Sudeikis', character: 'Ted Lasso' }]),
        production_companies: JSON.stringify([{ name: 'Ruby\'s Tuna' }]),
        episodes_per_season: JSON.stringify([10, 12, 12]),
        series_status: 'Ended',
        watchHistory: JSON.stringify([
            { watchId: '12345678-1234-4000-8000-555555555555', date: '2024-01-01', rating: '5' }
        ])
    };

    const normalized = sandbox.normalizeImportedRow(rawExportRow);

    // Verify all JSON strings are parsed back into objects/arrays
    assert.equal(typeof normalized.runtime, 'object');
    assert.equal(normalized.runtime.episodes, 34);
    assert.ok(Array.isArray(normalized.keywords));
    assert.equal(normalized.keywords[0].name, 'football');
    assert.equal(normalized.director_info.name, 'Bill Lawrence');
    assert.ok(Array.isArray(normalized.full_cast));
    assert.ok(Array.isArray(normalized.production_companies));
    assert.ok(Array.isArray(normalized.watchHistory));
    assert.deepEqual(Array.from(normalized.episodes_per_season), [10, 12, 12]);
    assert.equal(normalized.series_status, 'Ended');
});

test('CONTRACT: Export CSV formula sanitizer prepends single quote to formula trigger characters', () => {
    const sandbox = setupSandbox();

    sandbox.movieData = [
        {
            id: '12345678-1234-4000-8000-123456789abc',
            Name: '=cmd|\' /C calc\'!A0',
            Category: '+1800EXPLOIT',
            Genre: '-2+3',
            Status: '@SUM(A1:A10)',
            Recommendation: '\ttab_trigger',
            _sync_state: 'synced',
            is_deleted: false,
            Year: '2023'
        }
    ];

    let downloadedContent = null;
    let downloadedFileName = null;

    sandbox.document.createElement = (tag) => {
        if (tag === 'a') {
            return {
                set href(val) {},
                set download(name) { downloadedFileName = name; },
                click: () => {}
            };
        }
        return { click: () => {}, setAttribute: () => {}, style: {} };
    };

    sandbox.Blob = class MockBlob {
        constructor(parts) {
            downloadedContent = parts[0];
        }
    };

    sandbox.generateAndDownloadFile('csv');

    assert.ok(downloadedContent !== null, 'CSV export content must be generated');
    assert.equal(downloadedFileName, 'keepmoviez_log.csv');

    assert.ok(downloadedContent.includes("'=cmd|' /C calc'!A0"), 'Name formula trigger must be escaped with leading quote');
    assert.ok(downloadedContent.includes("'+1800EXPLOIT"), 'Category plus formula trigger must be escaped with leading quote');
    assert.ok(downloadedContent.includes("'-2+3"), 'Genre minus formula trigger must be escaped with leading quote');
    assert.ok(downloadedContent.includes("'@SUM(A1:A10)"), 'Status at formula trigger must be escaped with leading quote');
});

test('CONTRACT: Export data sanitizer strips internal flags and preserves columns', () => {
    const sandbox = setupSandbox();

    sandbox.movieData = [
        {
            id: '12345678-1234-4000-8000-123456789abc',
            Name: 'Interstellar',
            Category: 'Movie',
            Status: 'Watched',
            _sync_state: 'synced',
            is_deleted: false,
            runtime: 169,
            director_info: { name: 'Christopher Nolan' }
        },
        {
            id: '12345678-1234-4000-8000-999999999999',
            Name: 'Soft Deleted Movie',
            is_deleted: true
        }
    ];

    let downloadedContent = null;
    let downloadedFileName = null;

    sandbox.document.createElement = (tag) => {
        if (tag === 'a') {
            return {
                set href(val) {},
                set download(name) { downloadedFileName = name; },
                click: () => {}
            };
        }
        return { click: () => {}, setAttribute: () => {}, style: {} };
    };

    // Override Blob to capture serialized payload
    sandbox.Blob = class MockBlob {
        constructor(parts) {
            downloadedContent = parts[0];
        }
    };

    sandbox.generateAndDownloadFile('json');

    assert.ok(downloadedContent !== null, 'Export content must be generated');
    assert.equal(downloadedFileName, 'keepmoviez_log.json');

    const parsedExport = JSON.parse(downloadedContent);

    // 1. Must exclude soft-deleted entries
    assert.equal(parsedExport.length, 1);
    assert.equal(parsedExport[0].Name, 'Interstellar');

    // 2. Must not leak internal transient state
    assert.equal(parsedExport[0]._sync_state, undefined);
    assert.equal(parsedExport[0].is_deleted, undefined);

    // 3. Must preserve user data
    assert.equal(parsedExport[0].runtime, 169);
    assert.equal(parsedExport[0].director_info.name, 'Christopher Nolan');
});

test('CONTRACT: Smart Import backfillableFields contains all backfill columns', () => {
    // Read input-output.js to inspect backfillableFields array
    const ioCode = fs.readFileSync(path.join(__dirname, '../js/input-output.js'), 'utf8');
    const match = ioCode.match(/const\s+backfillableFields\s*=\s*\[([\s\S]*?)\];/);

    assert.ok(match, 'backfillableFields array must be defined in input-output.js');

    const declaredFields = match[1]
        .split(',')
        .map(s => s.replace(/['"\s]/g, ''))
        .filter(Boolean);

    // Verify key fields are backfillable on import
    const expectedBackfillable = [
        'runtime',
        'keywords',
        'director_info',
        'full_cast',
        'production_companies',
        'tmdb_vote_average',
        'tmdb_vote_count',
        'Genre',
        'Country',
        'Language'
    ];

    for (const field of expectedBackfillable) {
        assert.ok(
            declaredFields.includes(field),
            `Field "${field}" is missing from backfillableFields in input-output.js!`
        );
    }
});

// ----------------------------------------------------------------------------
// SECTION 7: SCHEMA DRIFT GUARD CONTRACT
// ----------------------------------------------------------------------------

test('CONTRACT: Schema Drift Guard detects unregistered columns and enforces bidirectional mapping', () => {
    const sandbox = setupSandbox();

    // 1. Ensure all BACKFILL_FIELDS map to recognized local canonical properties
    for (const field of sandbox.BACKFILL_FIELDS) {
        assert.ok(
            CANONICAL_LOCAL_PROPERTIES.includes(field.key),
            `DRIFT ERROR: Field "${field.key}" in BACKFILL_FIELDS does not exist in CANONICAL_LOCAL_PROPERTIES! Check Step 5 & Step 7 of Developer Guide.`
        );
    }

    // 2. Test Supabase column drift detection
    // Build a dummy row with every single Supabase column
    const dummySupabaseRow = {};
    for (const col of CANONICAL_SUPABASE_COLUMNS) {
        dummySupabaseRow[col] = col === 'runtime' ? 120 :
                                col === 'year' ? 2024 :
                                col === 'overall_rating' ? 5 :
                                col === 'tmdb_id' ? 123 :
                                col === 'is_deleted' ? false :
                                col.includes('_history') || col.includes('keywords') || col.includes('_entries') || col.includes('_cast') || col.includes('companies') ? [] :
                                col === 'director_info' ? { name: 'Test' } :
                                col === 'last_modified_date' ? '2025-01-01T00:00:00Z' :
                                'test';
    }

    const unpackedLocal = sandbox.supabaseEntryToLocalFormat(dummySupabaseRow);
    assert.ok(unpackedLocal !== null, 'supabaseEntryToLocalFormat must successfully unpack complete schema');

    // 3. Ensure no unmapped columns in localEntryToSupabaseFormat
    const dummyLocalEntry = {
        id: '123',
        Name: 'Test',
        Category: 'Movie',
        Genre: 'Action',
        Status: 'Watched',
        runtime: 120,
        year: 2024,
        overallRating: '5',
        watchHistory: [],
        relatedEntries: []
    };

    const packedSupabase = sandbox.localEntryToSupabaseFormat(dummyLocalEntry, 'u1');
    for (const col of Object.keys(packedSupabase)) {
        assert.ok(
            CANONICAL_SUPABASE_COLUMNS.includes(col),
            `DRIFT ERROR: localEntryToSupabaseFormat returned unknown Supabase column "${col}"! Add to CANONICAL_SUPABASE_COLUMNS and run migrations.`
        );
    }
});
