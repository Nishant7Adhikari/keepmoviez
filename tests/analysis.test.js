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

test('calculateAllStatistics calculates series runtime using 3-layer episodes_per_season fallback', () => {
    const seriesData = [
        // Layer 1: runtime.episodes_per_season
        {
            id: 's1',
            Name: 'Series Layer 1',
            Status: 'Watched',
            Category: 'Series',
            runtime: { episode_run_time: 45, episodes_per_season: [10, 10, 10] },
            currentSeason: 3,
            currentEpisode: 10,
            watchHistory: [{ date: '2024-01-01' }]
        },
        // Layer 2: movie.episodesPerSeason
        {
            id: 's2',
            Name: 'Series Layer 2',
            Status: 'Watched',
            Category: 'Series',
            runtime: { episode_run_time: 50, episodes_per_season: [] },
            episodesPerSeason: [12, 12, 12, 12],
            currentSeason: 4,
            currentEpisode: 12,
            watchHistory: [{ date: '2024-02-01' }]
        },
        // Layer 3: movie.episodes_per_season (snake_case fallback for longSeriesCount)
        {
            id: 's3',
            Name: 'Series Layer 3',
            Status: 'Watched',
            Category: 'Series',
            runtime: null,
            episodes_per_season: [8, 8, 8, 8, 8],
            currentSeason: 5,
            currentEpisode: 8,
            watchHistory: [{ date: '2024-03-01' }]
        },
        // Documentary and Special category tracking
        {
            id: 'd1',
            Name: 'Planet Earth',
            Status: 'Watched',
            Category: 'Documentary',
            runtime: 60,
            overallRating: '5',
            watchHistory: [{ date: '2024-04-01', rating: '5' }]
        },
        {
            id: 'sp1',
            Name: 'Guardians Holiday Special',
            Status: 'Watched',
            Category: 'Special',
            runtime: 44,
            overallRating: '4.5',
            watchHistory: [{ date: '2024-05-01', rating: '4.5' }]
        }
    ];

    const stats = sandbox.calculateAllStatistics(seriesData);
    assert.equal(stats.totalEntries, 5);
    assert.equal(stats.achievementData.category_watched_count['Documentary'], 1);
    assert.equal(stats.achievementData.category_watched_count['Special'], 1);
    assert.equal(stats.achievementData.category_watched_count['Series'], 3);
    assert.ok(stats.achievementData.long_series_watched_count >= 3, `Expected at least 3 long series, got ${stats.achievementData.long_series_watched_count}`);
});

