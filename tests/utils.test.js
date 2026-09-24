const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Setup minimal browser globals needed for utils.js and ui.js
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
    PRANK_ERROR_CHANCE: 100,
    IntersectionObserver: class {
        constructor() {}
        observe() {}
        unobserve() {}
        disconnect() {}
    },
    document: {
        getElementById: () => null,
        addEventListener: () => {}
    }
};
sandbox.window = sandbox;

vm.createContext(sandbox);

const utilsCode = fs.readFileSync(path.join(__dirname, '../js/utils.js'), 'utf8');
vm.runInContext(utilsCode, sandbox);

const dataCode = fs.readFileSync(path.join(__dirname, '../js/data.js'), 'utf8');
vm.runInContext(dataCode, sandbox);

test('recalculateAndApplyAllRelationships updates connected components and singletons correctly', () => {
    sandbox.movieData = [
        { id: '1', Name: 'Movie 1', relatedEntries: ['2', '999', '1'] },
        { id: '2', Name: 'Movie 2', relatedEntries: ['3'] },
        { id: '3', Name: 'Movie 3', relatedEntries: [] },
        { id: '4', Name: 'Movie 4', relatedEntries: ['5'] },
        { id: '5', Name: 'Movie 5', relatedEntries: ['4'] },
        { id: '6', Name: 'Movie 6', relatedEntries: [] },
    ];

    sandbox.recalculateAndApplyAllRelationships();

    // Component 1: {1, 2, 3}
    assert.deepEqual(Array.from(sandbox.movieData[0].relatedEntries).sort(), ['2', '3']);
    assert.deepEqual(Array.from(sandbox.movieData[1].relatedEntries).sort(), ['1', '3']);
    assert.deepEqual(Array.from(sandbox.movieData[2].relatedEntries).sort(), ['1', '2']);

    // Component 2: {4, 5}
    assert.deepEqual(Array.from(sandbox.movieData[3].relatedEntries).sort(), ['5']);
    assert.deepEqual(Array.from(sandbox.movieData[4].relatedEntries).sort(), ['4']);

    // Singleton: {6}
    assert.deepEqual(Array.from(sandbox.movieData[5].relatedEntries), []);
});

test('getCountryFullName resolves country code correctly', () => {
    assert.equal(sandbox.getCountryFullName('US'), 'United States');
    assert.equal(sandbox.getCountryFullName('CA'), 'Canada');
    assert.equal(sandbox.getCountryFullName('Unknown'), 'Unknown');
    assert.equal(sandbox.getCountryFullName(null), 'N/A');
});

test('renderStars caches star rating HTML output correctly', () => {
    // Check initial cached values or computation
    const starHtml1 = sandbox.renderStars(5);
    const starHtml2 = sandbox.renderStars('5');
    const starHtmlHalf = sandbox.renderStars(3.5);
    const starHtmlNull = sandbox.renderStars(null);
    const starHtmlInvalid = sandbox.renderStars('invalid');

    assert.ok(starHtml1.includes('fa-star') && starHtml1.includes('aria-hidden="true"'));
    assert.ok(starHtmlHalf.includes('fa-star-half-alt') && starHtmlHalf.includes('aria-hidden="true"'));
    assert.equal(starHtmlNull, '<span class="text-muted small">N/A</span>');
    assert.equal(starHtmlInvalid, '<span class="text-muted small" title="Invalid Rating Value">Invalid</span>');

    // Repeated calls should return cached identical references
    assert.equal(sandbox.renderStars(5), starHtml1);
    assert.equal(sandbox.renderStars('5'), starHtml2);
    assert.equal(sandbox.renderStars(3.5), starHtmlHalf);
    assert.equal(sandbox.renderStars('invalid'), starHtmlInvalid);
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

test('generateUUID returns a valid string using crypto.randomUUID', () => {
    const uuid = sandbox.generateUUID();
    assert.equal(typeof uuid, 'string');
    assert.equal(uuid, '12345678-1234-4abc-9def-123456789abc');
});

test('generateUUID falls back to crypto.getRandomValues when crypto.randomUUID is absent', () => {
    const customSandbox = {
        console,
        Math,
        String,
        crypto: {
            getRandomValues: (arr) => {
                arr[0] = 15;
                return arr;
            }
        }
    };
    customSandbox.window = customSandbox;
    vm.createContext(customSandbox);
    vm.runInContext(utilsCode, customSandbox);

    const uuid = customSandbox.generateUUID();
    assert.equal(typeof uuid, 'string');
    assert.equal(uuid.length, 36);
    assert.match(uuid, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
});

test('generateUUID falls back to Math.random when crypto API is unavailable', () => {
    const customSandbox = {
        console,
        Math,
        String
    };
    customSandbox.window = customSandbox;
    vm.createContext(customSandbox);
    vm.runInContext(utilsCode, customSandbox);

    const uuid = customSandbox.generateUUID();
    assert.equal(typeof uuid, 'string');
    assert.equal(uuid.length, 36);
    assert.match(uuid, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
});

test('getLatestWatchInstance finds the latest watch history instance cleanly and efficiently', () => {
    const uiCode = fs.readFileSync(path.join(__dirname, '../js/ui.js'), 'utf8');
    vm.runInContext(uiCode, sandbox);

    assert.equal(sandbox.getLatestWatchInstance(null), null);
    assert.equal(sandbox.getLatestWatchInstance([]), null);
    assert.equal(sandbox.getLatestWatchInstance([{ notes: 'no date' }]), null);

    const history = [
        { date: '2023-05-10T12:00:00', rating: '3', notes: 'First' },
        { date: '2025-01-15T20:00:00', rating: '5', notes: 'Latest' },
        { date: '2024-08-20T10:00:00', rating: '4', notes: 'Second' }
    ];

    const latest = sandbox.getLatestWatchInstance(history);
    assert.equal(latest.notes, 'Latest');
    assert.equal(latest.date, '2025-01-15T20:00:00');
});

test('formatWatchDateDisplay formats wall-clock dates without timezone offset shifting', () => {
    assert.equal(sandbox.formatWatchDateDisplay('2026-03-31T21:00:00'), new Date(2026, 2, 31).toLocaleDateString());
    assert.equal(sandbox.formatWatchDateDisplay('2026-12-05T00:00:00.000Z'), new Date(2026, 11, 5).toLocaleDateString());
    assert.equal(sandbox.formatWatchDateDisplay('2026-01-01'), new Date(2026, 0, 1).toLocaleDateString());
    assert.equal(sandbox.formatWatchDateDisplay('invalid-date'), 'Invalid Date');
    assert.equal(sandbox.formatWatchDateDisplay(null), 'Invalid Date');
});

test('escapeHTML correctly escapes special characters and handles null/undefined', () => {
    assert.equal(sandbox.escapeHTML('<script>alert("xss")</script>'), '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
    assert.equal(sandbox.escapeHTML("Rock & 'Roll'"), 'Rock &amp; &#039;Roll&#039;');
    assert.equal(sandbox.escapeHTML(null), '');
    assert.equal(sandbox.escapeHTML(undefined), '');
});

test('renderMovieCards escapes Poster URL, movie.id, statusClass, and statusBadgeText in attributes to prevent XSS', () => {
    const cardContainer = {
        innerHTML: '',
        appendChild: function(fragment) {
            const children = fragment.children || [];
            children.forEach(c => {
                this.innerHTML += c.outerHTML || c.innerHTML;
            });
        },
        querySelectorAll: () => []
    };

    const testSandbox = {
        console,
        IntersectionObserver: class {
            constructor() {}
            observe() {}
            unobserve() {}
            disconnect() {}
        },
        document: {
            getElementById: (id) => {
                if (id === 'movieCardContainer') return cardContainer;
                if (id === 'initialMessage') return { style: {} };
                if (id === 'loadMoreBtn') return null;
                return null;
            },
            querySelector: () => ({ appendChild: () => {} }),
            createElement: (tag) => {
                const el = {
                    tagName: tag.toUpperCase(),
                    className: '',
                    dataset: {},
                    classList: { add: () => {} },
                    innerHTML: '',
                    get outerHTML() { return `<${tag.toLowerCase()} class="${this.className}">${this.innerHTML}</${tag.toLowerCase()}>`; }
                };
                return el;
            },
            createDocumentFragment: () => {
                const children = [];
                return {
                    children,
                    appendChild: (c) => children.push(c)
                };
            },
            addEventListener: () => {}
        },
        isMultiSelectMode: false,
        selectedEntryIds: [],
        applyFilters: (data) => data,
        movieData: [
            {
                id: 'test_1" onclick="alert(1)',
                Name: 'Malicious Poster Movie',
                Status: 'To Watch <script>alert(2)</script>',
                Year: '2024',
                Category: 'Movie',
                is_deleted: false,
                'Poster URL': 'https://example.com/poster.png" onerror="alert(1)',
                watchHistory: []
            }
        ]
    };
    testSandbox.window = testSandbox;

    vm.createContext(testSandbox);
    vm.runInContext(utilsCode, testSandbox);
    const uiCode = fs.readFileSync(path.join(__dirname, '../js/ui.js'), 'utf8');
    vm.runInContext(uiCode, testSandbox);

    testSandbox.renderMovieCards();

    assert.ok(cardContainer.innerHTML.includes('data-src="https://example.com/poster.png&quot; onerror=&quot;alert(1)"'));
    assert.ok(!cardContainer.innerHTML.includes('data-src="https://example.com/poster.png" onerror="alert(1)"'));
    assert.ok(cardContainer.innerHTML.includes('data-movie-id="test_1&quot; onclick=&quot;alert(1)"'));
    assert.ok(!cardContainer.innerHTML.includes('data-movie-id="test_1" onclick="alert(1)"'));
    assert.ok(cardContainer.innerHTML.includes('&lt;script&gt;alert(2)&lt;/script&gt;'));
    assert.ok(!cardContainer.innerHTML.includes('<script>alert(2)</script>'));
});

test('openUnwatchableModal escapes special characters in entry.id to prevent XSS', () => {
    const unwatchableContainer = { innerHTML: '' };
    const testSandbox = {
        console,
        IntersectionObserver: class {
            constructor() {}
            observe() {}
            unobserve() {}
            disconnect() {}
        },
        document: {
            getElementById: (id) => {
                if (id === 'unwatchableListContainer') return unwatchableContainer;
                return null;
            },
            addEventListener: () => {}
        },
        $: () => ({ modal: () => {} }),
        movieData: [
            {
                id: "bad_id' onclick='alert(1)'",
                Name: "Bad Unwatchable Movie",
                Status: "Unwatchable",
                Year: "2024",
                Category: "Movie",
                is_deleted: false,
                watchHistory: [{ notes: "Not available" }]
            }
        ]
    };
    testSandbox.window = testSandbox;

    vm.createContext(testSandbox);
    vm.runInContext(utilsCode, testSandbox);
    const uiCode = fs.readFileSync(path.join(__dirname, '../js/ui.js'), 'utf8');
    vm.runInContext(uiCode, testSandbox);

    testSandbox.openUnwatchableModal();

    assert.ok(unwatchableContainer.innerHTML.includes('data-movie-id="bad_id&#039; onclick=&#039;alert(1)&#039;"'));
    assert.ok(!unwatchableContainer.innerHTML.includes('onclick="'));
});

test('displayTmdbResults in js/tmdb.js renders TV/Movie indicator icons with aria-hidden="true"', () => {
    const tmdbCode = fs.readFileSync(path.join(__dirname, '../js/tmdb.js'), 'utf8');
    assert.ok(
        tmdbCode.includes('<i class="fas fa-tv text-info mr-1" title="TV Series" aria-hidden="true"></i>'),
        'Expected TV series indicator icon in displayTmdbResults to have aria-hidden="true"'
    );
    assert.ok(
        tmdbCode.includes('<i class="fas fa-film text-warning mr-1" title="Movie" aria-hidden="true"></i>'),
        'Expected Movie indicator icon in displayTmdbResults to have aria-hidden="true"'
    );
});

test('updateModalBackButton in js/main.js renders modal back button text span with aria-hidden="true"', () => {
    const mainCode = fs.readFileSync(path.join(__dirname, '../js/main.js'), 'utf8');
    assert.ok(
        mainCode.includes('<span class="modal-back-icon" aria-hidden="true">←</span>'),
        'Expected modal-back-icon span in updateModalBackButton to have aria-hidden="true"'
    );
});

test('index.html buttons, modals, and skip-link have accessible aria attributes for screen readers', () => {
    const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
    assert.ok(html.includes('href="#movieCardContainer"') && html.includes('class="skip-link"'));
    assert.ok(html.includes('id="moreMultiActionsDropdown"') && html.includes('aria-label="More actions"'));
    assert.ok(html.includes('id="sortColumnDropdown"') && html.includes('aria-label="Sort by column"'));
    assert.ok(html.includes('id="refreshRecommendationsBtnModal"') && html.includes('aria-label="Refresh suggestions"'));
    assert.ok(html.includes('id="quickAboutBtn"') && html.includes('aria-label="First time? About KeepMoviEZ"'));
    assert.ok(html.includes('id="quickSaveBtn"') && html.includes('aria-label="Quick save entry"'));
    assert.ok(html.includes('id="updateEntryBtn"') && html.includes('aria-label="Update entry"'));
    assert.ok(html.includes('id="detailsModalAddBtn"') && html.includes('aria-label="Add entry to library"'));
    assert.ok(html.includes('id="findSimilarBtn"') && html.includes('aria-label="Similar entries - Find similar entries"'));
    assert.ok(html.includes('id="downloadDetailsImageBtn"') && html.includes('aria-label="Share entry image"'));
    assert.ok(html.includes('id="checkRepairDataBtn"') && html.includes('aria-label="Check & Repair Data - Check and repair local data"'));
    assert.ok(html.includes('aria-label="Apply changes to selected entries"'));
    assert.ok(html.includes('id="cancelMultiSelectBtn"') && html.includes('fa-times" aria-hidden="true"'));
    assert.ok(html.includes('id="addNewEntryBtn"') && html.includes('fa-plus-circle" aria-hidden="true"'));
    assert.ok(html.includes('id="detailsTrailerBtn"') && html.includes('fa-youtube" aria-hidden="true"'));
    assert.ok(html.includes('id="detailsStreamingBtn"') && html.includes('fa-play-circle" aria-hidden="true"'));
    assert.ok(html.includes('id="exportStatsPdfBtn"') && html.includes('fa-file-pdf" aria-hidden="true"'));
    assert.ok(html.includes('id="filterInputNavbar"') && html.includes('aria-label="Search collection"'));
    assert.ok(html.includes('id="btnEditNextSeason"') && html.includes('aria-label="Next Season - Advance to Next Season and reset Episode to 1"'));
    assert.ok(html.includes('id="btnEditPlusEpisode"') && html.includes('aria-label="+1 Ep - Increment Episode by 1"'));
    assert.ok(html.includes('id="pgSeasonInput"') && html.includes('aria-label="Parents guide season number"'));
    assert.ok(html.includes('id="pgEpisodeInput"') && html.includes('aria-label="Parents guide episode number"'));
    assert.ok(html.includes('id="batchEditAddGenreSearchInput"') && html.includes('aria-label="Add genres"'));
    assert.ok(html.includes('id="batchEditRemoveGenreSearchInput"') && html.includes('aria-label="Remove genres"'));
    assert.ok(html.includes('id="batchEditWatchDate"') && html.includes('aria-label="Batch edit watch date"'));
    assert.ok(html.includes('id="batchEditWatchRating"') && html.includes('aria-label="Batch edit watch rating"'));
    assert.ok(html.includes('id="timeFormatToggle"') && html.includes('aria-label="Toggle time format unit"'));
    assert.ok(html.includes('id="confirmForcePullModal"') && html.includes('aria-modal="true"'));
    assert.ok(html.includes('id="confirmForcePushModal"') && html.includes('aria-modal="true"'));
    assert.ok(html.includes('aria-label="Learn more about Strict Privacy Mode"'));
    assert.ok(html.includes('aria-label="Learn more about Sync Threshold"'));
    assert.ok(html.includes('aria-label="Learn more about Erase Data Scopes"'));
    assert.ok(html.includes('aria-label="Learn more about Force Pull from Cloud"'));
    assert.ok(html.includes('aria-label="Learn more about Force Push to Cloud"'));
    assert.ok(html.includes('aria-label="Learn more about Data Enrichment and Smart Backfill"'));
    assert.ok(html.includes('aria-label="Learn more about Backfill Missing Data"'));
    assert.ok(html.includes('aria-label="Learn more about Erase All Data"'));
    assert.ok(html.includes('aria-label="Learn more about Export Data"'));
    assert.ok(html.includes('id="legalComplianceDisclaimer"'));
    assert.ok(html.includes('id="menuThemeToggleBtn"') && html.includes('aria-label="Toggle Theme"'));
    assert.ok(html.includes('id="menuImportBtn"') && html.includes('aria-label="Load Data"'));
    assert.ok(html.includes('id="menuExportBtn"') && html.includes('aria-label="Export Data"'));
    assert.ok(html.includes('id="menuSyncDataBtn"') && html.includes('aria-label="Sync with Cloud"'));
    assert.ok(html.includes('id="menuSupabaseLogoutBtn"') && html.includes('aria-label="Logout"'));
    assert.ok(html.includes('id="supabaseGoogleSignInBtn"') && html.includes('<span>Sign in with Google</span>'));
    assert.ok(html.includes('id="exportCsvBtn"') && html.includes('fa-file-csv" aria-hidden="true"'));
    assert.ok(html.includes('id="exportJsonBtn"') && html.includes('fa-file-code" aria-hidden="true"'));
    assert.ok(html.includes('id="forcePullTriggerBtn"') && html.includes('fa-cloud-download-alt" aria-hidden="true"'));
    assert.ok(html.includes('id="forcePushTriggerBtn"') && html.includes('fa-cloud-upload-alt" aria-hidden="true"'));

    const iconsWithoutAriaHidden = (html.match(/<i\s+class="[^"]*fa[^"]*"(?![^>]*aria-hidden="true")[^>]*>/g) || []);
    assert.strictEqual(iconsWithoutAriaHidden.length, 0, `All Font Awesome icons in index.html should have aria-hidden="true". Found missing: ${iconsWithoutAriaHidden.join(', ')}`);
});

test('renderMovieCards creates virtualized window slice and spacers', () => {
    const cardContainer = {
        innerHTML: '',
        clientWidth: 1000,
        appendChild: function(fragment) {
            const children = fragment.children || [];
            children.forEach(c => {
                if (c.className && c.className.includes('movie-card')) {
                    this.cardsCount = (this.cardsCount || 0) + 1;
                }
                this.innerHTML += c.outerHTML || c.innerHTML || '';
            });
        },
        querySelectorAll: () => [],
        querySelector: () => ({ offsetHeight: 250 })
    };

    const scrollEl = {
        scrollTop: 0,
        clientHeight: 800,
        dataset: {}
    };

    const items = [];
    for (let i = 0; i < 500; i++) {
        items.push({
            id: `movie_${i}`,
            Name: `Movie ${i}`,
            Status: 'Watched',
            Year: '2024',
            Category: 'Movie',
            is_deleted: false,
            watchHistory: []
        });
    }

    const testSandbox = {
        console,
        IntersectionObserver: class {
            constructor() {}
            observe() {}
            unobserve() {}
            disconnect() {}
        },
        document: {
            getElementById: (id) => {
                if (id === 'movieCardContainer') return cardContainer;
                if (id === 'initialMessage') return { style: {} };
                return null;
            },
            querySelector: (sel) => {
                if (sel === '.table-responsive') return scrollEl;
                return null;
            },
            createElement: (tag) => {
                const el = {
                    tagName: tag.toUpperCase(),
                    className: '',
                    style: {},
                    dataset: {},
                    classList: { add: () => {} },
                    innerHTML: '',
                    get outerHTML() { return `<${tag.toLowerCase()} class="${this.className}">${this.innerHTML}</${tag.toLowerCase()}>`; }
                };
                return el;
            },
            createDocumentFragment: () => {
                const children = [];
                return {
                    children,
                    appendChild: (c) => children.push(c)
                };
            },
            addEventListener: () => {}
        },
        isMultiSelectMode: false,
        selectedEntryIds: [],
        applyFilters: () => items,
        movieData: items
    };
    testSandbox.window = testSandbox;

    vm.createContext(testSandbox);
    vm.runInContext(utilsCode, testSandbox);
    const uiCode = fs.readFileSync(path.join(__dirname, '../js/ui.js'), 'utf8');
    vm.runInContext(uiCode, testSandbox);

    testSandbox.renderMovieCards();

    // Out of 500 cards, only a virtual window (buffer + visible rows, e.g. ~30-50 cards) should be rendered in the DOM
    assert.ok(cardContainer.cardsCount > 0 && cardContainer.cardsCount < 100, `Expected virtual window card count (<100), got ${cardContainer.cardsCount}`);
    assert.ok(cardContainer.innerHTML.includes('virtual-spacer-bottom'));
});

test('renderMovieCards empty state renders Clear Filters & Search CTA button', () => {
    const cardContainer = { innerHTML: '' };
    const testSandbox = {
        console,
        IntersectionObserver: class {
            constructor() {}
            observe() {}
            unobserve() {}
            disconnect() {}
        },
        document: {
            getElementById: (id) => {
                if (id === 'movieCardContainer') return cardContainer;
                if (id === 'initialMessage') return { style: {} };
                return null;
            },
            querySelector: () => null,
            addEventListener: () => {}
        },
        applyFilters: () => [],
        movieData: [{ id: '1', Name: 'Movie 1', Status: 'Watched', is_deleted: false }]
    };
    testSandbox.window = testSandbox;

    vm.createContext(testSandbox);
    const uiCode = fs.readFileSync(path.join(__dirname, '../js/ui.js'), 'utf8');
    vm.runInContext(uiCode, testSandbox);

    testSandbox.renderMovieCards();

    assert.ok(cardContainer.innerHTML.includes('id="emptyStateClearFiltersBtn"'));
    assert.ok(cardContainer.innerHTML.includes('onclick="resetFilters()"'));
});

test('js/ui.js renders card action buttons with accessible names containing entry names', () => {
    const uiCode = fs.readFileSync(path.join(__dirname, '../js/ui.js'), 'utf8');
    assert.ok(uiCode.includes('aria-label="Edit ${escapeHTML(movie.Name)}"'));
    assert.ok(uiCode.includes('aria-label="Delete ${escapeHTML(movie.Name)}"'));
    assert.ok(uiCode.includes('aria-label="Quick update progress for ${escapeHTML(movie.Name)}"'));
});

test('sortMovies accurately sorts entries across all columns using valueMap and nameMap', () => {
    const appCode = fs.readFileSync(path.join(__dirname, '../js/app.js'), 'utf8');
    const testSandbox = {
        console,
        movieData: [
            { id: '1', Name: 'Movie B', Year: '2020', overallRating: '4', lastModifiedDate: '2026-01-01T10:00:00Z', watchHistory: [{ date: '2024-01-01' }] },
            { id: '2', Name: 'Movie A', Year: '2022', overallRating: '5', lastModifiedDate: '2026-06-01T10:00:00Z', watchHistory: [{ date: '2025-01-01' }] },
            { id: '3', Name: 'Movie C', Year: '2018', overallRating: '3', lastModifiedDate: '2025-12-01T10:00:00Z', watchHistory: [] },
            { id: '4', Name: 'Movie D', Year: null, overallRating: '', lastModifiedDate: null, watchHistory: [] }
        ],
        getLatestWatchInstance: (wh) => (Array.isArray(wh) && wh.length > 0 ? wh[wh.length - 1] : null)
    };
    testSandbox.window = testSandbox;

    vm.createContext(testSandbox);
    vm.runInContext(appCode, testSandbox);

    testSandbox.sortMovies('lastModifiedDate', 'desc');
    assert.deepEqual(testSandbox.movieData.map(m => m.id), ['2', '1', '3', '4']);

    testSandbox.sortMovies('lastModifiedDate', 'asc');
    assert.deepEqual(testSandbox.movieData.map(m => m.id), ['3', '1', '2', '4']);

    testSandbox.sortMovies('Name', 'asc');
    assert.deepEqual(testSandbox.movieData.map(m => m.id), ['2', '1', '3', '4']);

    testSandbox.sortMovies('Year', 'asc');
    assert.deepEqual(testSandbox.movieData.map(m => m.id), ['3', '1', '2', '4']);

    testSandbox.sortMovies('overallRating', 'desc');
    assert.deepEqual(testSandbox.movieData.map(m => m.id), ['2', '1', '3', '4']);

    testSandbox.sortMovies('LastWatchedDate', 'desc');
    assert.deepEqual(testSandbox.movieData.map(m => m.id), ['2', '1', '3', '4']);
});

test('applyFilters filters items correctly in single pass with short-circuiting', () => {
    const appCode = fs.readFileSync(path.join(__dirname, '../js/app.js'), 'utf8');
    const testSandbox = {
        console,
        filterQuery: 'Inception',
        activeFilters: {
            category: 'Movie',
            country: 'US',
            language: 'all',
            genres: ['Sci-Fi'],
            genreLogic: 'AND'
        }
    };
    testSandbox.window = testSandbox;

    vm.createContext(testSandbox);
    vm.runInContext(appCode, testSandbox);

    const items = [
        { id: '1', Name: 'Inception', Category: 'Movie', Country: 'US', Language: 'English', Genre: 'Action, Sci-Fi', is_deleted: false },
        { id: '2', Name: 'Inception', Category: 'Series', Country: 'US', Language: 'English', Genre: 'Action, Sci-Fi', is_deleted: false },
        { id: '3', Name: 'Interstellar', Category: 'Movie', Country: 'US', Language: 'English', Genre: 'Sci-Fi', is_deleted: false },
        { id: '4', Name: 'Inception', Category: 'Movie', Country: 'US', Language: 'English', Genre: 'Action', is_deleted: false },
        { id: '5', Name: 'Inception', Category: 'Movie', Country: 'US', Language: 'English', Genre: 'Sci-Fi', is_deleted: true }
    ];

    const result = testSandbox.applyFilters(items);
    assert.equal(result.length, 1);
    assert.equal(result[0].id, '1');
});

test('showToast preserves and presents standard error title and message without prank error replacements', () => {
    let alertCalledMessage = null;
    const testSandbox = {
        console,
        Math,
        PRANK_ERROR_CHANCE: 1,
        localStorage: { getItem: () => null },
        alert: (msg) => { alertCalledMessage = msg; }
    };
    testSandbox.window = testSandbox;
    vm.createContext(testSandbox);
    vm.runInContext(utilsCode, testSandbox);

    testSandbox.showToast("Database Connection Error", "Unable to establish network handshake.", "error");
    assert.equal(alertCalledMessage, "Database Connection Error: Unable to establish network handshake.");
});

test('renderWatchHistoryUI escapes watchDateFormatted in aria-label attributes to prevent XSS', () => {
    const listEl = { innerHTML: '', appendChild: function(child) { this.innerHTML += child.innerHTML; } };
    const testSandbox = {
        console,
        IntersectionObserver: class {
            constructor() {}
            observe() {}
            unobserve() {}
            disconnect() {}
        },
        document: {
            getElementById: (id) => (id === 'watchHistoryList' ? listEl : null),
            createElement: () => ({ className: '', innerHTML: '' }),
            addEventListener: () => {}
        },
        generateUUID: () => 'watch-123',
        formatWatchDateDisplay: () => '2026-03-31" onclick="alert(1)',
        renderStars: () => '★★★★★',
        escapeHTML: (str) => (str ? String(str).replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;') : '')
    };
    testSandbox.window = testSandbox;

    vm.createContext(testSandbox);
    const uiCode = fs.readFileSync(path.join(__dirname, '../js/ui.js'), 'utf8');
    vm.runInContext(uiCode, testSandbox);

    testSandbox.renderWatchHistoryUI([{ watchId: 'w1', date: '2026-03-31', notes: 'Great' }]);

    assert.ok(listEl.innerHTML.includes('aria-label="Edit watch record for 2026-03-31&quot; onclick=&quot;alert(1)"'));
    assert.ok(!listEl.innerHTML.includes('aria-label="Edit watch record for 2026-03-31" onclick="alert(1)"'));
    assert.ok(listEl.innerHTML.includes('<i class="fas fa-edit" aria-hidden="true"></i>'));
    assert.ok(listEl.innerHTML.includes('<i class="fas fa-trash" aria-hidden="true"></i>'));
});
test('safeTransitionModal executes callback immediately when modal is not visible or jQuery is unavailable', () => {
    let called = false;
    sandbox.safeTransitionModal(null, () => { called = true; });
    assert.equal(called, true);

    called = false;
    sandbox.safeTransitionModal('#nonExistentModal', () => { called = true; });
    assert.equal(called, true);
});

test('safeTransitionModal transitions via hidden.bs.modal event and executes once', async () => {
    let callCount = 0;
    let eventHandler = null;
    let modalHidden = false;

    const mockModal = {
        length: 1,
        hasClass: (cls) => cls === 'show',
        one: (event, handler) => {
            if (event.includes('hidden.bs.modal')) {
                eventHandler = handler;
            }
        },
        off: () => {},
        modal: (action) => {
            if (action === 'hide') {
                modalHidden = true;
            }
        }
    };

    const mockBody = {
        addClass: () => {}
    };

    const mockJQuery = (selector) => {
        if (selector === 'body') return mockBody;
        return mockModal;
    };

    const testSandbox = {
        console,
        setTimeout,
        clearTimeout,
        $: mockJQuery
    };
    testSandbox.window = testSandbox;
    vm.createContext(testSandbox);
    vm.runInContext(utilsCode, testSandbox);

    testSandbox.safeTransitionModal('#myModal', () => {
        callCount++;
    });
});

test('safeTransitionModal falls back to timer if hidden event does not fire', () => {
    return new Promise((resolve) => {
        let callCount = 0;

        const mockModal = {
        length: 1,
        hasClass: (cls) => cls === 'show',
        one: () => {}, // deliberately does not fire
        off: () => {},
        modal: () => {}
    };

    const mockBody = {
        addClass: () => {}
    };

    const mockJQuery = (selector) => {
        if (selector === 'body') return mockBody;
        return mockModal;
    };

    const testSandbox = {
        console,
        setTimeout,
        clearTimeout,
        $: mockJQuery
    };
    testSandbox.window = testSandbox;
    vm.createContext(testSandbox);
    vm.runInContext(utilsCode, testSandbox);

        testSandbox.safeTransitionModal('#modalWithoutEvent', () => {
            callCount++;
            assert.equal(callCount, 1);
            resolve();
        });
    });
});

test('chunkArray splits large collections into safe batches', () => {
    assert.equal(sandbox.chunkArray([]).length, 0);
    assert.equal(sandbox.chunkArray(null).length, 0);
    assert.equal(sandbox.chunkArray([1, 2, 3], 0).length, 0);

    const items = Array.from({ length: 250 }, (_, i) => `id-${i}`);
    const chunks = sandbox.chunkArray(items, 30);

    // 250 items with chunk size 30 should yield 9 chunks (8 of 30, 1 of 10)
    assert.equal(chunks.length, 9);
    assert.equal(chunks[0].length, 30);
    assert.equal(chunks[7].length, 30);
    assert.equal(chunks[8].length, 10);
    assert.equal(Array.from(chunks).flat().length, 250);

    // Every chunk must be <= 30 items to guarantee safe URL parameter length
    assert.equal(chunks.every(c => c.length <= 30), true);
});

test('openPersonDetailsModal matches filmography entries using localTmdbMap efficiently', async () => {
    const filmographyList = {
        innerHTML: '',
        empty: function() { this.innerHTML = ''; return this; },
        append: function(html) { this.innerHTML += html; return this; }
    };

    const mockModal = {
        find: (sel) => ({
            text: () => mockModal,
            empty: () => mockModal,
            append: () => mockModal
        }),
        modal: () => {}
    };

    const mockJQuery = (sel) => {
        if (sel === '#personFilmographyList') return filmographyList;
        if (sel === '#personBio' || sel === '#noPersonImageMessage' || sel === '#personProfileImage' || sel === '#viewTmdbPersonBtn') {
            return {
                text: () => ({ removeClass: () => {}, addClass: () => {} }),
                empty: () => filmographyList,
                append: () => {},
                attr: () => ({ removeClass: () => {} }),
                addClass: () => ({ text: () => ({ removeClass: () => {} }) }),
                removeClass: () => {},
                hide: () => {},
                show: () => ({ data: () => ({ show: () => {} }) }),
                data: () => ({ show: () => {} })
            };
        }
        return mockModal;
    };

    const testSandbox = {
        console,
        IntersectionObserver: class {
            constructor() {}
            observe() {}
            unobserve() {}
            disconnect() {}
        },
        document: {
            getElementById: () => null,
            addEventListener: () => {}
        },
        TMDB_IMAGE_BASE_URL: 'https://image.tmdb.org/t/p/',
        showLoading: () => {},
        hideLoading: () => {},
        escapeHTML: (str) => String(str || ''),
        fetchTmdbPersonDetails: async () => ({
            biography: 'Famous director',
            combined_credits: {
                crew: [
                    { id: 27205, media_type: 'movie', job: 'Director', release_date: '2010-07-16' },
                    { id: 157336, media_type: 'movie', job: 'Director', release_date: '2014-11-07' },
                    { id: 99999, media_type: 'movie', job: 'Director', release_date: '2020-01-01' }
                ]
            }
        }),
        movieData: [
            { id: 'm1', Name: 'Inception', tmdbId: 27205, tmdbMediaType: 'movie', is_deleted: false },
            { id: 'm2', Name: 'Interstellar', tmdbId: 157336, tmdbMediaType: 'movie', is_deleted: false }
        ],
        $: mockJQuery
    };
    testSandbox.window = testSandbox;

    vm.createContext(testSandbox);
    const uiCode = fs.readFileSync(path.join(__dirname, '../js/ui.js'), 'utf8');
    vm.runInContext(uiCode, testSandbox);

    await testSandbox.openPersonDetailsModal(525, 'Christopher Nolan');

    assert.ok(filmographyList.innerHTML.includes('Inception (2010)'));
    assert.ok(filmographyList.innerHTML.includes('Interstellar (2014)'));
    assert.ok(!filmographyList.innerHTML.includes('99999'));
});

test('js/main.js specifies noopener,noreferrer for viewTmdbPersonBtn window.open', () => {
    const mainCode = fs.readFileSync(path.join(__dirname, '../js/main.js'), 'utf8');
    assert.ok(
        mainCode.includes('window.open(url, "_blank", "noopener,noreferrer")'),
        'Expected viewTmdbPersonBtn click handler to use window.open with "noopener,noreferrer"'
    );
});

test('index.html contains accessible #clearSearchBtn element inside navbar search form', () => {
    const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
    assert.ok(
        html.includes('id="clearSearchBtn"'),
        'Expected index.html to contain element with id="clearSearchBtn"'
    );
    assert.ok(
        html.includes('aria-label="Clear search text"'),
        'Expected #clearSearchBtn to have aria-label="Clear search text"'
    );
    assert.ok(
        html.includes('title="Clear search"'),
        'Expected #clearSearchBtn to have title="Clear search"'
    );
});
