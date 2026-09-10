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

test('generateUUID returns a valid string', () => {
    const uuid = sandbox.generateUUID();
    assert.equal(typeof uuid, 'string');
    assert.ok(uuid.length > 0);
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

test('renderMovieCards escapes Poster URL in data-src attribute to prevent XSS', () => {
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
                id: 'test_1',
                Name: 'Malicious Poster Movie',
                Status: 'To Watch',
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

    assert.ok(unwatchableContainer.innerHTML.includes("prepareEditModal('bad_id&#039; onclick=&#039;alert(1)&#039;')"));
    assert.ok(!unwatchableContainer.innerHTML.includes("prepareEditModal('bad_id' onclick='alert(1)')"));
});

test('index.html buttons and search input have accessible aria-labels for screen readers', () => {
    const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
    assert.ok(html.includes('id="moreMultiActionsDropdown"') && html.includes('aria-label="More actions"'));
    assert.ok(html.includes('id="sortColumnDropdown"') && html.includes('aria-label="Sort by column"'));
    assert.ok(html.includes('id="refreshRecommendationsBtnModal"') && html.includes('aria-label="Refresh suggestions"'));
    assert.ok(html.includes('id="quickAboutBtn"') && html.includes('aria-label="About KeepMoviEZ"'));
    assert.ok(html.includes('id="quickSaveBtn"') && html.includes('aria-label="Quick save entry"'));
    assert.ok(html.includes('id="updateEntryBtn"') && html.includes('aria-label="Update entry"'));
    assert.ok(html.includes('id="filterInputNavbar"') && html.includes('aria-label="Search collection"'));
    assert.ok(html.includes('id="btnEditNextSeason"') && html.includes('aria-label="Advance to Next Season and reset Episode to 1"'));
    assert.ok(html.includes('id="btnEditPlusEpisode"') && html.includes('aria-label="Increment Episode by 1"'));
    assert.ok(html.includes('id="timeFormatToggle"') && html.includes('aria-label="Toggle time format unit"'));
});

test('js/ui.js renders card action buttons with accessible names containing entry names', () => {
    const uiCode = fs.readFileSync(path.join(__dirname, '../js/ui.js'), 'utf8');
    assert.ok(uiCode.includes('aria-label="Edit ${escapeHTML(movie.Name)}"'));
    assert.ok(uiCode.includes('aria-label="Delete ${escapeHTML(movie.Name)}"'));
    assert.ok(uiCode.includes('aria-label="Quick update progress for ${escapeHTML(movie.Name)}"'));
});
