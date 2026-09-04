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
    Date,
    ACHIEVEMENTS: [],
    localStorage: {
        getItem: () => '[]',
        setItem: () => {}
    },
    getRatingTextLabel: (r) => `${r} Stars`,
    window: {
        location: { reload: () => {} }
    },
    document: {
        getElementById: () => mockElement,
        querySelector: () => mockElement,
        querySelectorAll: () => []
    }
};

vm.createContext(sandbox);
const code = fs.readFileSync(path.join(__dirname, '../js/analysis.js'), 'utf8');
vm.runInContext(code, sandbox);

test('calculateAllStatistics calculates metrics correctly', () => {
    const sampleData = [
        { id: '1', Name: 'Movie A', Status: 'Watched', Category: 'Movie', overallRating: '5', runtime: 120, Genre: 'Action, Sci-Fi', watchHistory: [{ date: '2023-01-01', rating: '5' }] },
        { id: '2', Name: 'Movie B', Status: 'To Watch', Category: 'Movie', overallRating: '4', runtime: 90, Genre: 'Action', watchHistory: [] }
    ];

    const stats = sandbox.calculateAllStatistics(sampleData);
    assert.equal(stats.totalEntries, 2);
    assert.ok(stats.avgOverallRating);
    assert.equal(stats.watchlistGrowthChartData.labels.length, 30);
    assert.equal(stats.watchlistGrowthChartData.data.length, 30);
    assert.equal(stats.genreCombinations.length, 1);
    assert.equal(stats.genreCombinations[0].label, 'Action, Sci-Fi');
    assert.equal(stats.genreCombinations[0].value, 1);
});

test('calculateAllStatistics handles empty arrays safely', () => {
    const stats = sandbox.calculateAllStatistics([]);
    assert.equal(Object.keys(stats).length, 0);
});

test('checkAchievement validates unlock rules accurately', () => {
    const mockStats = {
        watchedCount: 50,
        fiveStarCount: 10,
        uniqueCountriesCount: 12,
        watchedCountByCategory: { Movie: 50 },
        watchesByMonth: []
    };

    const ach1 = { criteriaType: 'watched_count', threshold: 50 };
    const res1 = sandbox.checkAchievement(ach1, mockStats);
    assert.ok(res1);
});
