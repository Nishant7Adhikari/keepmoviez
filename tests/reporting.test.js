const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const mockElement = {
    addEventListener: () => {},
    appendChild: () => {},
    remove: () => {},
    setAttribute: () => {},
    querySelector: () => mockElement,
    style: {},
    dataset: {},
    classList: { add: () => {}, remove: () => {} },
    getContext: () => ({ clearRect: () => {}, save: () => {}, restore: () => {}, translate: () => {}, rotate: () => {}, fillRect: () => {} })
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
    performance,
    setTimeout,
    clearTimeout,
    requestAnimationFrame: (cb) => cb(),
    $: () => ({ tooltip: () => {} }),
    window: { requestAnimationFrame: (cb) => cb(), addEventListener: () => {}, removeEventListener: () => {} },
    TMDB_IMAGE_BASE_URL: 'https://image.tmdb.org/t/p/',
    MAX_DAILY_SKIPS: 3,
    getDailyRecommendationModalState: () => ({ skipCount: 0 }),
    document: {
        getElementById: () => mockElement,
        querySelector: () => mockElement,
        querySelectorAll: () => [],
        head: { appendChild: () => {} },
        body: { classList: { contains: () => false } },
        createElement: () => mockElement
    }
};

vm.createContext(sandbox);
const utilsCode = fs.readFileSync(path.join(__dirname, '../js/utils.js'), 'utf8');
vm.runInContext(utilsCode, sandbox);
const code = fs.readFileSync(path.join(__dirname, '../js/reporting.js'), 'utf8');
vm.runInContext(code, sandbox);

test('generateColors produces requested quantity of color strings', () => {
    const colors = sandbox.generateColors(5, 0.8);
    assert.equal(colors.length, 5);
    assert.ok(typeof colors[0] === 'string');
});

test('calculateMatchScoreForRecommendation calculates score without crashing', () => {
    sandbox.favoriteGenresList = ['Sci-Fi', 'Action'];
    sandbox.favoriteDirectorsList = ['Christopher Nolan'];

    const itemFav = {
        Genres: 'Sci-Fi, Action',
        Director: 'Christopher Nolan',
        overallRating: '5',
        tmdb_vote_average: '8.8'
    };

    const scoreFav = sandbox.calculateMatchScoreForRecommendation(itemFav);
    assert.ok(typeof scoreFav === 'number');
});

test('shuffleDailyRecommendationMovies returns randomized array', () => {
    const list = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const shuffled = sandbox.shuffleDailyRecommendationMovies(list);
    assert.equal(shuffled.length, 10);
});

test('renderDailyRecommendationCard escapes HTML characters in movie details and includes context-specific aria-labels', () => {
    const card = {
        movie: {
            id: 'rec_1',
            Name: '<script>alert("xss")</script>',
            Category: '<b onmouseover="alert(1)">Movie</b>',
            Genre: 'Action, <img src=x onerror=alert(1)>',
            Year: '2025',
            Description: '<p>Dangerous</p>'
        },
        pickReason: 'Because you like <i>Sci-Fi</i>',
        remainingCards: [
            { movie: { id: 'rec_2', Name: 'Standby Movie' } }
        ]
    };

    const html = sandbox.renderDailyRecommendationCard(card, 0);
    assert.ok(html.includes('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'));
    assert.ok(!html.includes('<script>'));
    assert.ok(html.includes('&lt;b onmouseover=&quot;alert(1)&quot;&gt;Movie&lt;/b&gt;'));
    assert.ok(!html.includes('<b onmouseover'));
    assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'));
    assert.ok(!html.includes('<img src=x'));
    assert.ok(html.includes('aria-label="Close recommendation for &lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;"'));
    assert.ok(html.includes('aria-label="Skip recommendation for &lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;"'));
    assert.ok(html.includes('aria-label="View details for &lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;"'));
    assert.ok(html.includes('aria-label="Mark &lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt; as watched"'));
});

test('renderSuggestionCard sets item-specific aria-labels on quick action buttons', () => {
    const item = {
        id: 101,
        title: 'Inception',
        media_type: 'movie',
        poster_path: '/inception.jpg',
        release_date: '2010-07-16',
        vote_average: 8.8
    };

    const card = sandbox.renderSuggestionCard(item);
    assert.ok(card.innerHTML.includes('aria-label="Add Inception to Watchlist"'));
    assert.ok(card.innerHTML.includes('aria-label="Mark Inception as Watched"'));
});

test('_createAchievementBadgeElement escapes HTML in achievement name', () => {
    const ach = {
        name: '<script>alert("badge_xss")</script>',
        description: 'Test description',
        icon: 'fas fa-trophy',
        isAchieved: true,
        progress: 1,
        threshold: 1
    };
    const badge = sandbox._createAchievementBadgeElement(ach);
    assert.ok(badge.innerHTML.includes('&lt;script&gt;alert(&quot;badge_xss&quot;)&lt;/script&gt;'));
    assert.ok(!badge.innerHTML.includes('<script>'));
});

test('celebrateAchievementUnlock escapes HTML in achievement title and description', () => {
    let createdHtml = '';
    const originalCreateElement = sandbox.document.createElement;
    sandbox.document.createElement = () => ({
        className: '',
        dataset: {},
        classList: { add: () => {}, remove: () => {} },
        set innerHTML(val) { createdHtml = val; },
        get innerHTML() { return createdHtml; },
        querySelector: () => mockElement,
        addEventListener: () => {}
    });
    sandbox.document.body = { appendChild: () => {}, classList: { contains: () => false } };

    const ach = {
        name: '<img src=x onerror=alert(1)>',
        description: '<svg onload=alert(2)>',
        icon: 'fas fa-trophy'
    };

    sandbox.window.celebrateAchievementUnlock(ach);
    sandbox.document.createElement = originalCreateElement;

    assert.ok(createdHtml.includes('&lt;img src=x onerror=alert(1)&gt;'));
    assert.ok(!createdHtml.includes('<img src=x'));
    assert.ok(createdHtml.includes('&lt;svg onload=alert(2)&gt;'));
    assert.ok(!createdHtml.includes('<svg onload'));
});

test('findNextBestSeedMovie sorts candidates by rating then lastModifiedDate efficiently', () => {
    sandbox.movieData = [
        { id: '1', Name: 'Movie A', Status: 'Watched', tmdbId: 10, overallRating: '4', lastModifiedDate: '2025-01-01T10:00:00Z' },
        { id: '2', Name: 'Movie B', Status: 'Watched', tmdbId: 20, overallRating: '5', lastModifiedDate: '2025-01-02T10:00:00Z' },
        { id: '3', Name: 'Movie C', Status: 'Watched', tmdbId: 30, overallRating: '5', lastModifiedDate: '2025-01-03T10:00:00Z' }
    ];
    sandbox.suggestionEngineState = { lastUsedSeedIndex: -1 };

    const result = sandbox.findNextBestSeedMovie();
    assert.equal(result.seed.id, '3'); // Highest rating (5) and latest lastModifiedDate (Jan 3)
    assert.equal(result.nextIndex, 0);
});

test('renderRatingReleaseYearScatter formats scatter data using getLatestWatchInstance', () => {
    let chartConfig = null;
    sandbox.Chart = function(ctx, config) {
        chartConfig = config;
    };
    sandbox.getComputedStyle = () => ({ getPropertyValue: () => '#333' });
    sandbox.getLatestWatchInstance = (history) => {
        if (!history || history.length === 0) return null;
        return history[history.length - 1]; // Mock latest
    };

    sandbox.movieData = [
        {
            id: 'm1',
            Name: 'Inception',
            Year: '2010',
            overallRating: '5',
            watchHistory: [
                { date: '2024-01-01T00:00:00' },
                { date: '2024-06-15T00:00:00' }
            ]
        }
    ];
    sandbox.window.movieData = sandbox.movieData;

    const chartInstanceObj = {};
    sandbox.renderRatingReleaseYearScatter('testCanvas', chartInstanceObj);

    assert.ok(chartConfig);
    assert.equal(chartConfig.data.datasets[0].data.length, 1);
    const point = chartConfig.data.datasets[0].data[0];
    assert.equal(point.x, 2010);
    assert.equal(point.y, 5);
    assert.equal(point._title, 'Inception');
    assert.ok(point._date !== 'N/A');
test('getDailyRecommendationPickReason escapes dynamic genre and director inputs', () => {
    sandbox.window.globalStatsData = {
        topRatedGenresOverall: [{ label: '<script>alert(1)</script>', value: '4.8' }],
        mostWatchedDirectors: [{ label: '<b onmouseover=alert(2)>Director</b>' }]
    };

    const movieGenreXss = { Genre: '<script>alert(1)</script>' };
    const pickReasonGenre = sandbox.getDailyRecommendationPickReason(movieGenreXss);
    assert.ok(pickReasonGenre.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
    assert.ok(!pickReasonGenre.includes('<script>'));
    assert.ok(pickReasonGenre.includes('<strong>&lt;script&gt;alert(1)&lt;/script&gt;</strong>'));

    const movieDirectorXss = { Genre: 'Sci-Fi', director_info: { name: '<b onmouseover=alert(2)>Director</b>' } };
    const pickReasonDirector = sandbox.getDailyRecommendationPickReason(movieDirectorXss);
    assert.ok(pickReasonDirector.includes('&lt;b onmouseover=alert(2)&gt;Director&lt;/b&gt;'));
    assert.ok(!pickReasonDirector.includes('<b onmouseover'));
    assert.ok(pickReasonDirector.includes('<strong>&lt;b onmouseover=alert(2)&gt;Director&lt;/b&gt;</strong>'));
});
