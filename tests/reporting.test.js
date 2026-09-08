const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const mockElement = {
    addEventListener: () => {},
    appendChild: () => {},
    remove: () => {},
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
    window: { requestAnimationFrame: (cb) => cb(), addEventListener: () => {}, removeEventListener: () => {} },
    MAX_DAILY_SKIPS: 3,
    getDailyRecommendationModalState: () => ({ skipCount: 0 }),
    document: {
        getElementById: () => mockElement,
        querySelector: () => mockElement,
        querySelectorAll: () => [],
        head: { appendChild: () => {} },
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

test('renderDailyRecommendationCard escapes HTML characters in movie details', () => {
    const card = {
        movie: {
            Name: '<script>alert("xss")</script>',
            Category: '<b onmouseover="alert(1)">Movie</b>',
            Genre: 'Action, <img src=x onerror=alert(1)>',
            Year: '2025',
            Description: '<p>Dangerous</p>'
        },
        pickReason: 'Because you like <i>Sci-Fi</i>',
        remainingCards: []
    };

    const html = sandbox.renderDailyRecommendationCard(card, 0);
    assert.ok(html.includes('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'));
    assert.ok(!html.includes('<script>'));
    assert.ok(html.includes('&lt;b onmouseover=&quot;alert(1)&quot;&gt;Movie&lt;/b&gt;'));
    assert.ok(!html.includes('<b onmouseover'));
    assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'));
    assert.ok(!html.includes('<img src=x'));
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
    sandbox.document.body = { appendChild: () => {} };

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
