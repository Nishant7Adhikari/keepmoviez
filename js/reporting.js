/* reporting.js */
function generateColors(count, alpha = 0.7) {
    const colors = [];
    const baseHues = [200, 30, 260, 60, 150, 330, 90, 0, 230, 180, 45, 280, 120, 20, 300, 100];
    const saturation = 70;
    const lightness = 55;
    for (let i = 0; i < count; i++) {
        const hue = (baseHues[i % baseHues.length] + (Math.floor(i / baseHues.length) * 13)) % 360;
        colors.push(`hsla(${hue}, ${saturation}%, ${lightness}%, ${alpha})`);
    }
    return colors;
}

function destroyCharts(chartInstanceObject = chartInstances) {
    for (const chartId in chartInstanceObject) {
        if (chartInstanceObject[chartId] && typeof chartInstanceObject[chartId].destroy === 'function') {
            chartInstanceObject[chartId].destroy();
        }
        delete chartInstanceObject[chartId];
    }
}

// --- UI Display Functions for Modals ---

async function displayDailyRecommendationModal() {
    const modalBody = document.getElementById('dailyRecommendationModalBody');
    if (!modalBody) { console.warn("Daily recommendation modal body not found."); return; }
    modalBody.innerHTML = '<p class="text-center text-muted p-3"><i class="fas fa-spinner fa-spin"></i> Finding your daily pick...</p>';

    const { message: dailyRecMsg, movie: dailyRecMovie, dailyRecSkipCount } = getDailyRecommendationMovie();

    if (dailyRecMovie) {
        modalBody.innerHTML = `
            <h5 class="mt-1">Your Daily Pick! <small class="text-muted">(Skips left: ${MAX_DAILY_SKIPS - dailyRecSkipCount})</small></h5>
            <div class="recommendation-item daily-pick list-group-item p-3 shadow-sm rounded">
                <div class="d-flex w-100 justify-content-between">
                     <h6 class="mb-1">${dailyRecMovie.Name} <small class="text-muted">(${dailyRecMovie.Year || 'N/A'})</small></h6>
                     ${dailyRecMovie.tmdb_vote_average ? `<small class="text-info" title="TMDB Rating">TMDB: ${dailyRecMovie.tmdb_vote_average.toFixed(1)} <i class="fas fa-star text-warning"></i></small>` : ''}
                </div>
                <p class="mb-1 text-muted small"><strong>Category:</strong> ${dailyRecMovie.Category || 'N/A'} | <strong>Genre:</strong> ${dailyRecMovie.Genre || 'N/A'}</p>
                <p class="mb-2 text-muted small">${(dailyRecMovie.Description || 'No description available.').substring(0, 150)}${dailyRecMovie.Description && dailyRecMovie.Description.length > 150 ? '...' : ''}</p>
                <div class="text-right mt-2">
                    <button class="btn btn-sm btn-warning skip-daily-rec-modal mr-2" data-movie-id="${dailyRecMovie.id}" title="Skip this pick for today"><i class="fas fa-forward"></i> Skip</button>
                    <button class="btn btn-sm btn-info view-btn-modal mr-2" data-movie-id="${dailyRecMovie.id}" title="View Details"><i class="fas fa-eye"></i> View</button>
                    <button class="btn btn-sm btn-success mark-completed-daily-rec-modal" data-movie-id="${dailyRecMovie.id}" title="Mark as Watched"><i class="fas fa-check-circle"></i> Watched It!</button>
                </div>
            </div>`;

        modalBody.querySelector('.view-btn-modal').addEventListener('click', function () {
            $('#dailyRecommendationModal').modal('hide');
            $('#dailyRecommendationModal').one('hidden.bs.modal', () => openDetailsModal(this.dataset.movieId));
        });
        modalBody.querySelector('.mark-completed-daily-rec-modal').addEventListener('click', async function (event) {
            await window.markDailyRecCompleted(event);
            $('#dailyRecommendationModal').modal('hide');
        });
        modalBody.querySelector('.skip-daily-rec-modal').addEventListener('click', window.markDailyRecSkipped);

    } else {
        modalBody.innerHTML = `<p class="text-center text-muted p-3">${dailyRecMsg}</p>`;
    }
}


// <<-- REIMAGINED SUGGESTION ENGINE START -->>

// Global state for the suggestion engine to remember the last used seed
let suggestionEngineState = {
    lastUsedSeedIndex: -1
};

// Main function to display the new "Suggestion Hub" modal
async function displayPersonalizedSuggestionsModal(sourceMovieId = null) {
    const modalBody = document.getElementById('personalizedSuggestionsModalBody');
    const listEl = document.getElementById('recommendationsListModal');
    const titleEl = document.getElementById('recommendationsListTitleModal');
    const refreshBtn = document.getElementById('refreshRecommendationsBtnModal');

    if (!modalBody || !listEl || !titleEl || !refreshBtn) return;

    // Reset UI for loading state
    titleEl.textContent = 'Engine Suggestions';
    listEl.innerHTML = '<div class="text-center p-4"><i class="fas fa-spinner fa-spin fa-2x"></i><p class="mt-2">Building your suggestion hub...</p></div>';
    
    let seedMovie;

    if (sourceMovieId) {
        // A specific movie ID was passed (from "Find Similar"), so we MUST use it as the seed.
        seedMovie = movieData.find(m => m.id === sourceMovieId);
        // The refresh button will now re-run suggestions for THIS specific movie.
        $(refreshBtn).off('click').on('click', () => displayPersonalizedSuggestionsModal(sourceMovieId));
    } else {
        // No specific movie was passed, so we use the automatic "best seed" logic.
        const { seed, nextIndex } = findNextBestSeedMovie();
        seedMovie = seed;
        suggestionEngineState.lastUsedSeedIndex = nextIndex;
        // The refresh button will find the NEXT best seed.
        $(refreshBtn).off('click').on('click', () => displayPersonalizedSuggestionsModal(null));
    }

    if (!seedMovie) {
        listEl.innerHTML = '<div class="list-group-item text-muted small p-3">Could not generate suggestions. Try rating more movies highly, or adding TMDB info to your favorites.</div>';
        titleEl.textContent = 'Engine Suggestions';
        return;
    }
    
    titleEl.textContent = `Suggestions based on "${seedMovie.Name}"`;
    
    const carousels = await fetchSuggestionCarousels(seedMovie);

    if (carousels.length === 0) {
        listEl.innerHTML = '<div class="list-group-item text-muted small p-3">No new suggestions found based on this movie. Try refreshing for a new seed!</div>';
        return;
    }
    
    listEl.innerHTML = ''; // Clear loading spinner
    carousels.forEach(carousel => {
        if (carousel.items.length > 0) {
            listEl.appendChild(renderSuggestionCarousel(carousel.title, carousel.items));
        }
    });
}

// Intelligent seed movie finder
function findNextBestSeedMovie() {
    // Find all potential candidates: Watched, have a good rating, and have a TMDB ID
    const candidates = movieData.filter(m => 
        m.Status === 'Watched' &&
        m.tmdbId &&
        (parseFloat(m.overallRating) >= 4 || m.Recommendation === 'Highly Recommended')
    ).sort((a,b) => {
        // Prioritize by rating, then by how recently they were modified/watched
        const ratingA = parseFloat(a.overallRating) || 0;
        const ratingB = parseFloat(b.overallRating) || 0;
        if (ratingB !== ratingA) return ratingB - ratingA;
        return new Date(b.lastModifiedDate) - new Date(a.lastModifiedDate);
    });

    if (candidates.length === 0) return { seed: null, nextIndex: -1 };

    // Cycle through the best candidates
    const nextIndex = (suggestionEngineState.lastUsedSeedIndex + 1) % candidates.length;
    return { seed: candidates[nextIndex], nextIndex: nextIndex };
}

// Fetches data for all the different suggestion categories based on a seed movie
async function fetchSuggestionCarousels(seedMovie) {
    if (!seedMovie || !seedMovie.tmdbId) return [];

    const carousels = [];
    const loggedTmdbIds = new Set(movieData.map(m => m.tmdbId).filter(Boolean));
    
    // 1. "Because You Liked..." carousel
    try {
        const data = await callTmdbApiDirect(`/${seedMovie.tmdbMediaType || 'movie'}/${seedMovie.tmdbId}/recommendations`);
        const items = (data.results || []).filter(rec => !loggedTmdbIds.has(String(rec.id))).slice(0, 10);
        if(items.length > 0) carousels.push({ title: `Because you liked "${seedMovie.Name}"`, items });
    } catch (e) { console.warn("Could not fetch TMDB recommendations:", e); }
    
    // 2. "More from Director..." carousel
    if (seedMovie.director_info && seedMovie.director_info.id) {
        try {
            const data = await callTmdbApiDirect(`/person/${seedMovie.director_info.id}/combined_credits`);
            const items = (data.cast || []).concat(data.crew || [])
                .filter(c => c.id !== parseInt(seedMovie.tmdbId) && (c.media_type === 'movie' || c.media_type === 'tv') && !loggedTmdbIds.has(String(c.id)))
                .sort((a,b) => b.popularity - a.popularity)
                .slice(0, 10);
            if(items.length > 0) carousels.push({ title: `More from ${seedMovie.director_info.name}`, items });
        } catch (e) { console.warn(`Could not fetch director credits for ${seedMovie.director_info.name}:`, e); }
    }
    
    // 3. "Complete the Collection" carousel
    if (seedMovie.tmdb_collection_id) {
         try {
            const data = await callTmdbApiDirect(`/collection/${seedMovie.tmdb_collection_id}`);
            const items = (data.parts || []).filter(rec => !loggedTmdbIds.has(String(rec.id))).slice(0, 10);
            if(items.length > 0) carousels.push({ title: `Complete the "${seedMovie.tmdb_collection_name}"`, items });
        } catch (e) { console.warn("Could not fetch collection details:", e); }
    }
    
    // 4. Fallback: Popular Movies in the same Genre
    const primaryGenre = (seedMovie.Genre || '').split(',')[0].trim();
    const genreObject = GENRE_MAP.find(g => g.name === primaryGenre);
    if(carousels.length < 2 && genreObject) {
        try {
            const data = await callTmdbApiDirect(`/discover/movie`, { with_genres: genreObject.id, sort_by: 'popularity.desc' });
            const items = (data.results || []).filter(rec => !loggedTmdbIds.has(String(rec.id))).slice(0, 10);
            if(items.length > 0) carousels.push({ title: `Popular in ${primaryGenre}`, items });
        } catch (e) { console.warn("Could not fetch popular by genre:", e); }
    }

    return carousels;
}

// Renders a single carousel (title + cards)
function renderSuggestionCarousel(title, items) {
    const carouselWrapper = document.createElement('div');
    carouselWrapper.className = 'suggestion-carousel-wrapper mb-4';

    const carouselTitle = document.createElement('h6');
    carouselTitle.className = 'pl-2';
    carouselTitle.textContent = title;

    const cardContainer = document.createElement('div');
    cardContainer.className = 'd-flex flex-nowrap overflow-auto py-2';
    
    items.forEach(item => {
        cardContainer.appendChild(renderSuggestionCard(item));
    });

    carouselWrapper.appendChild(carouselTitle);
    carouselWrapper.appendChild(cardContainer);
    return carouselWrapper;
}

// Renders a single suggestion card for the carousel
function renderSuggestionCard(item) {
    const card = document.createElement('div');
    card.className = 'suggestion-card';

    const posterPath = item.poster_path ? `${TMDB_IMAGE_BASE_URL}w342${item.poster_path}` : 'icons/placeholder-poster.png';
    const name = item.title || item.name;
    const year = (item.release_date || item.first_air_date || '').substring(0, 4);

    card.innerHTML = `
        <img src="${posterPath}" alt="Poster for ${name}" loading="lazy">
        <div class="suggestion-card-info">
            <strong>${name}</strong>
            <small class="text-muted">${year || 'N/A'}</small>
        </div>
    `;

    // Add tooltip with more info
    const voteAvg = item.vote_average ? item.vote_average.toFixed(1) : 'N/A';
    card.setAttribute('title', `${name} (${year || 'N/A'}) - TMDB Rating: ${voteAvg}/10`);
    $(card).tooltip({ boundary: 'window', trigger: 'hover' });

    card.addEventListener('click', () => {
        $('#personalizedSuggestionsModal').modal('hide');
        $('#personalizedSuggestionsModal').one('hidden.bs.modal', () => {
            openDetailsModal(null, item);
        });
    });

    return card;
}

// A simple map for TMDB genre IDs. In a real app, this would be fetched from the API.
const GENRE_MAP = [
    {id: 28, name: "Action"}, {id: 12, name: "Adventure"}, {id: 16, name: "Animation"}, {id: 35, name: "Comedy"},
    {id: 80, name: "Crime"}, {id: 99, name: "Documentary"}, {id: 18, name: "Drama"}, {id: 10751, name: "Family"},
    {id: 14, name: "Fantasy"}, {id: 36, name: "History"}, {id: 27, name: "Horror"}, {id: 10402, name: "Music"},
    {id: 9648, name: "Mystery"}, {id: 10749, name: "Romance"}, {id: 878, name: "Science Fiction"},
    {id: 10770, name: "TV Movie"}, {id: 53, name: "Thriller"}, {id: 10752, name: "War"}, {id: 37, name: "Western"}
];

// Add some CSS to style.css for the new suggestion hub
if (!document.getElementById('suggestion-hub-styles')) {
    const suggestionHubCSS = `
        .suggestion-carousel-wrapper .overflow-auto { -ms-overflow-style: none; scrollbar-width: none; }
        .suggestion-carousel-wrapper .overflow-auto::-webkit-scrollbar { display: none; }
        .suggestion-card {
            flex: 0 0 auto;
            width: 140px;
            margin: 0 8px;
            cursor: pointer;
            transition: transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out;
            border-radius: 8px;
            overflow: hidden;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            background: var(--table-header-bg);
        }
        .suggestion-card:hover {
            transform: scale(1.05);
            box-shadow: 0 4px 15px rgba(0,0,0,0.2);
        }
        .suggestion-card img { width: 100%; height: 210px; object-fit: cover; display: block; }
        .suggestion-card-info {
            padding: 8px;
            background: var(--card-bg);
            color: var(--body-text-color);
            font-size: 0.8rem;
        }
        .suggestion-card-info strong {
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
            text-overflow: ellipsis;
            min-height: 2.4em; /* Approx 2 lines */
        }
    `;
    const styleSheet = document.createElement("style");
    styleSheet.id = 'suggestion-hub-styles';
    styleSheet.innerText = suggestionHubCSS;
    document.head.appendChild(styleSheet);
}

// <<-- REIMAGINED SUGGESTION ENGINE END -->>

function displayAchievementsModal() {
    const badgesContainer = document.getElementById('achievementBadgesModal');
    if (!badgesContainer) { console.warn("Achievements modal badges container not found."); return; }
    badgesContainer.innerHTML = '<p class="text-center text-muted p-3"><i class="fas fa-spinner fa-spin"></i> Calculating achievements...</p>';

    const statsForAchievements = calculateAllStatistics(movieData);
    generateBadgesAndAchievements(statsForAchievements, badgesContainer);
}

const chartsModalChartInstances = {};
async function displayChartsModal() {
    const modalBody = document.getElementById('chartsModalBody');
    if (!modalBody) { console.warn("Charts modal body not found."); return; }

    destroyCharts(chartsModalChartInstances);

    if (Object.keys(globalStatsData).length === 0 || globalStatsData.totalEntries === 0) {
        globalStatsData = calculateAllStatistics(movieData);
    }

    if (Object.keys(globalStatsData).length === 0 || globalStatsData.totalEntries === 0) {
        modalBody.innerHTML = '<div class="col-12"><p class="text-center text-muted p-3">No data for charts. Add some entries first!</p></div>';
        return;
    }

    renderChartsForModal(globalStatsData, chartsModalChartInstances);
}

async function displayDetailedStatsModal() {
    const modal = document.getElementById('detailedStatsModal');
    if (!modal) { console.warn("Detailed stats modal not found."); return; }

    modal.querySelectorAll('#detailedStatsTabContent ul, #detailedStatsTabContent ol, #detailedStatsModal table tbody').forEach(el => el.innerHTML = '');
    modal.querySelectorAll('#detailedStatsTabContent p span').forEach(el => el.textContent = 'N/A');

    if (Object.keys(globalStatsData).length === 0 || globalStatsData.totalEntries === 0) {
        globalStatsData = calculateAllStatistics(movieData);
    }

    if (Object.keys(globalStatsData).length === 0 || globalStatsData.totalEntries === 0) {
        modal.querySelector('#stats-summary-detailed').innerHTML = '<p class="text-center text-muted p-3">No data available.</p>';
        if (typeof $ !== 'undefined') $('#detailedStatsTab a[href="#stats-summary-detailed"]').tab('show');
        return;
    }

    const stats = globalStatsData;
    const timeFormatToggle = document.getElementById('timeFormatToggle');
    const preferredFormat = localStorage.getItem('preferredTimeFormat') || 'days';
    timeFormatToggle.checked = preferredFormat === 'hours';

    const updateDetailedStatsTimeFormat = () => {
        const currentFormat = timeFormatToggle.checked ? 'hours' : 'days';
        localStorage.setItem('preferredTimeFormat', currentFormat);

        const totalWatchTimeEl = document.getElementById('statsTotalWatchTime');
        if (totalWatchTimeEl) totalWatchTimeEl.textContent = formatDuration(globalStatsData.totalWatchTimeMinutes, currentFormat);
        
        const estimatedCompletionEl = document.getElementById('estimatedCompletionTime');
        if (estimatedCompletionEl) estimatedCompletionEl.textContent = formatDuration(globalStatsData.estimatedCompletionTimeMinutes, currentFormat);

        const pred30El = document.getElementById('completionPrediction30');
        if (pred30El) pred30El.textContent = formatDays(globalStatsData.completionPredictionDays30, currentFormat);

        const pred90El = document.getElementById('completionPrediction90');
        if (pred90El) pred90El.textContent = formatDays(globalStatsData.completionPredictionDays90, currentFormat);

        const pred365El = document.getElementById('completionPrediction365');
        if (pred365El) pred365El.textContent = formatDays(globalStatsData.completionPredictionDays365, currentFormat);
    };

    timeFormatToggle.removeEventListener('change', updateDetailedStatsTimeFormat);
    timeFormatToggle.addEventListener('change', updateDetailedStatsTimeFormat);

    const populateList = (elementId, dataArray, maxItems = 0) => {
        const listEl = document.getElementById(elementId);
        if (!listEl) return;
        listEl.innerHTML = '';
        const itemsToShow = maxItems > 0 ? dataArray.slice(0, maxItems) : dataArray;
        if (itemsToShow.length === 0) { listEl.innerHTML = `<li class="list-group-item text-muted small">N/A</li>`; return; }
        itemsToShow.forEach(item => {
            const li = document.createElement('li');
            li.className = 'list-group-item d-flex justify-content-between align-items-center';
            li.innerHTML = `${item.label} <span class="badge badge-primary badge-pill">${item.value}</span>`;
            listEl.appendChild(li);
        });
    };

    const populateTable = (tableId, dataRows, columnDefs) => {
        const table = document.getElementById(tableId);
        if (!table) return;
        const tbody = table.querySelector('tbody');
        if (!tbody) return;
        tbody.innerHTML = '';
        if (dataRows.length === 0) {
            const cols = columnDefs.length;
            tbody.innerHTML = `<tr><td colspan="${cols}" class="text-center text-muted small">N/A</td></tr>`;
            return;
        }
        dataRows.forEach(row => {
            const tr = document.createElement('tr');
            columnDefs.forEach(def => {
                const td = document.createElement('td');
                td.setAttribute('data-label', def.label);
                td.innerHTML = row[def.key] !== undefined && row[def.key] !== null ? row[def.key] : 'N/A';
                tr.appendChild(td);
            });
            tbody.appendChild(tr);
        });
    };

    // Summary Tab
    document.getElementById('statsTotalEntries').textContent = stats.totalEntries;
    document.getElementById('statsTotalTitlesWatched').textContent = stats.totalTitlesWatched;
    document.getElementById('statsTotalWatchInstances').textContent = stats.totalWatchInstances;
    document.getElementById('statsAvgOverallRating').innerHTML = `${renderStars(stats.avgOverallRating)} (${stats.avgOverallRating})`;
    populateList('statsByCategory', stats.categories);
    populateList('statsByStatus', stats.statuses);
    populateList('statsTopRatedGenresOverall', stats.topRatedGenresOverall.map(g => ({ label: g.label, value: `${g.value} avg (${g.count})` })), 5);

    // Progress Tab
    const toWatchCount = stats.statuses.find(s => s.label === 'To Watch')?.value || 0;
    const watchedCount = stats.statuses.find(s => s.label === 'Watched')?.value || 0;
    const totalForProgress = toWatchCount + watchedCount;
    const progressPercent = totalForProgress > 0 ? ((watchedCount / totalForProgress) * 100).toFixed(1) : 0;
    document.getElementById('statsToWatchCompletion').textContent = `${progressPercent}%`;
    document.getElementById('toWatchProgressBar').style.width = `${progressPercent}%`;
    document.getElementById('toWatchProgressBar').setAttribute('aria-valuenow', progressPercent);
    document.getElementById('watchedCountProgress').textContent = watchedCount;
    document.getElementById('totalRelevantCountProgress').textContent = totalForProgress;
    
    document.getElementById('watchlistGrowth30').textContent = stats.watchlistGrowth30 || 'N/A';

    // Temporal Tab
    populateTable('statsWatchesByYear', stats.watchesByYear, [{ key: 'year', label: 'Year' }, { key: 'instances', label: 'Instances' }, { key: 'unique_titles', label: 'Unique Titles' }, { key: 'avg_rating', label: 'Avg. Rating' }]);
    populateTable('statsWatchesByMonth', stats.watchesByMonth.slice(0, 12), [{ key: 'month_year_label', label: 'Month' }, { key: 'instances', label: 'Instances' }, { key: 'unique_titles', label: 'Unique Titles' }]);

    // Genre Tab
    populateList('statsTopSingleGenres', stats.topSingleGenres.slice(0, 10));
    populateList('statsAvgRatingByGenre', stats.topRatedGenresOverall.slice(0, 10).map(g => ({ label: g.label, value: `${g.value} avg (${g.count})` })), 10);
    populateList('genreCombinations', stats.genreCombinations);

    // Ratings Tab
    populateList('statsByOverallRating', stats.overallRatingDistributionData);
    populateList('statsByWatchInstanceRating', stats.watchInstanceRatingDistributionData);
    populateList('statsAvgOverallRatingByCategory', stats.avgOverallRatingByCategory);

    // People & Production Tab
    populateList('statsMostWatchedActors', stats.mostWatchedActors, 10);
    populateList('statsMostWatchedDirectors', stats.mostWatchedDirectors, 10);
    populateList('statsMostFrequentProductionCompanies', stats.mostFrequentProductionCompanies, 10);
    populateList('statsAvgRatingByStudio', stats.avgRatingByStudio.map(s => ({ label: s.label, value: `${s.value} avg (${s.count})` })), 5);

    // Country & Language Tab
    populateList('statsTopCountries', stats.topCountries, 10);
    populateList('statsTopLanguages', stats.topLanguages, 10);

    updateDetailedStatsTimeFormat();

    if (typeof $ !== 'undefined' && !$('#detailedStatsTab .nav-link.active').length) {
        $('#detailedStatsTab a[href="#stats-summary-detailed"]').tab('show');
    }
}

function renderChartsForModal(statsData, chartInstanceObj) {
    destroyCharts(chartInstanceObj);
    const chartsModalBody = document.getElementById('chartsModalBody');
    if (!chartsModalBody) { return; }

    const chartTextColor = getComputedStyle(document.body).getPropertyValue('--body-text-color').trim() || '#333';
    const gridColor = getComputedStyle(document.body).getPropertyValue('--table-border-color').trim() || 'rgba(0,0,0,0.1)';

    const renderSingleChart = (canvasId, type, chartLabels, chartDataSets, options = {}) => {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        const hasData = chartLabels && chartLabels.length > 0 && chartDataSets.some(ds => ds.data && ds.data.length > 0);

        if (hasData) {
            let chartOptions = { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: (type === 'pie' || type === 'doughnut' || type === 'radar'), labels: { color: chartTextColor } } }, scales: { x: { display: (type === 'bar' || type === 'line'), ticks: { color: chartTextColor }, grid: { color: gridColor } }, y: { display: (type === 'bar' || type === 'line'), ticks: { color: chartTextColor }, grid: { color: gridColor }, beginAtZero: true } }, ...options };
            if (type === 'radar') chartOptions.scales = { r: { angleLines: { color: gridColor }, grid: { color: gridColor }, pointLabels: { color: chartTextColor, font: { size: 10 } }, ticks: { backdropColor: 'transparent', color: chartTextColor, stepSize: 1, min: 0, max: 5 } } };
            const styledChartDataSets = chartDataSets.map((dataset) => ({ ...dataset, backgroundColor: generateColors(dataset.data.length, 0.8), borderColor: generateColors(dataset.data.length, 1), borderWidth: 1.5, tension: 0.3 }));
            chartInstanceObj[canvasId] = new Chart(ctx, { type, data: { labels: chartLabels, datasets: styledChartDataSets }, options: chartOptions });
        }
    };

    renderSingleChart('chartModalWatchInstancesByYear', 'bar', (statsData.watchesByYear || []).map(d => d.year).reverse(), [{ label: 'Watch Instances', data: (statsData.watchesByYear || []).map(d => d.instances).reverse() }]);
    renderSingleChart('chartNormalizedPace', 'line', statsData.normalizedPaceData.labels, statsData.normalizedPaceData.datasets.map(ds => ({...ds, fill: false })), { plugins: { legend: { display: true } }, scales: { y: { title: { display: true, text: 'Cumulative Watches' } } }});
    const topGenresForChart = (statsData.topSingleGenres || []).slice(0, 10);
    renderSingleChart('chartModalMoviesPerGenre', 'bar', topGenresForChart.map(d => d.label), [{ label: 'Entries', data: topGenresForChart.map(d => d.value) }], { indexAxis: 'y' });
    renderSingleChart('chartModalOverallRatingDistribution', 'doughnut', (statsData.overallRatingDistributionData || []).map(d => d.label), [{ data: (statsData.overallRatingDistributionData || []).map(d => d.value) }]);
    renderSingleChart('chartModalWatchInstanceRatingDistribution', 'pie', (statsData.watchInstanceRatingDistributionData || []).map(d => d.label), [{ data: (statsData.watchInstanceRatingDistributionData || []).map(d => d.value) }]);
    renderSingleChart('chartModalMovieStatusBreakdown', 'pie', (statsData.statuses || []).map(d => d.label), [{ data: (statsData.statuses || []).map(d => d.value) }]);
    renderSingleChart('chartModalLanguageDistribution', 'doughnut', (statsData.topLanguages || []).map(d => d.label), [{ data: (statsData.topLanguages || []).map(d => d.value) }]);
    renderSingleChart('chartModalCountryDistribution', 'doughnut', (statsData.topCountries || []).map(d => d.label), [{ data: (statsData.topCountries || []).map(d => d.value) }]);
    const sortedMonthly = [...(statsData.watchesByMonth || [])].slice(0, 12).sort((a, b) => new Date(a.month_year_iso) - new Date(b.month_year_iso));
    renderSingleChart('chartModalWatchActivityOverTime', 'line', sortedMonthly.map(d => d.month_year_label), [{ label: 'Watch Instances', data: sortedMonthly.map(d => d.instances) }]);
    const sortedMonthlyRatings = [...(statsData.avgRatingByMonth || [])].slice(-12);
    renderSingleChart('chartModalAvgRatingOverTime', 'line', sortedMonthlyRatings.map(d => d.label), [{ label: 'Average Rating', data: sortedMonthlyRatings.map(d => d.value) }], { scales: { y: { beginAtZero: false, min: 1, max: 5 } } });
    const ratedGenres = (statsData.topRatedGenresOverall || []).filter(g => g.count >= 2).slice(0, 7);
    if (ratedGenres.length >= 3) renderSingleChart('chartModalRatingByGenreRadar', 'radar', ratedGenres.map(d => d.label), [{ label: 'Average Overall Rating', data: ratedGenres.map(d => parseFloat(d.value)) }]);
}

// **MODIFIED**: This function now retains the original icon for unlocked achievements.
function generateBadgesAndAchievements(achievementStats, container) {
    if (!container) return;
    container.innerHTML = '';
    let achievedCountForMeta = 0;
    const achievementsToDisplay = ACHIEVEMENTS.map(ach => {
        const { isAchieved, progress } = checkAchievement(ach, achievementStats);
        if (isAchieved && ach.type !== 'meta_achievement_count') achievedCountForMeta++;
        return { ...ach, isAchieved, progress };
    });

    const statsForMeta = { ...achievementStats, unlockedCountForMeta: achievedCountForMeta };

    achievementsToDisplay.forEach(ach => {
        if (ach.type === 'meta_achievement_count') {
            const { isAchieved, progress } = checkAchievement(ach, statsForMeta);
            ach.progress = progress;
            ach.isAchieved = isAchieved;
        }
    });

    achievementsToDisplay.sort((a, b) => (b.isAchieved - a.isAchieved) || ((b.progress / (b.threshold || 1)) - (a.progress / (a.threshold || 1))) || a.name.localeCompare(b.name));

    achievementsToDisplay.forEach(ach => {
        const titleText = `${ach.name} - ${ach.description} (${ach.isAchieved ? 'Completed!' : `${ach.progress} / ${ach.threshold}`})`;
        const badge = document.createElement('div');
        badge.className = `achievement-badge ${ach.isAchieved ? 'achieved' : 'locked'}`;
        badge.title = titleText;
        badge.dataset.description = ach.description;
        badge.dataset.name = ach.name;
        badge.dataset.progress = ach.progress;
        badge.dataset.threshold = ach.threshold;
        badge.dataset.achieved = ach.isAchieved;

        // **MODIFICATION**: The innerHTML now always uses the specific icon from the achievement object.
        // The 'achieved' class will handle the gold coloring via CSS (to be added in style.css).
        badge.innerHTML = `
            <span class="fa-stack fa-2x">
                <i class="${ach.icon} fa-stack-2x"></i>
            </span>
            <span>${ach.name}</span>`;
            
        container.appendChild(badge);
    });
}

async function exportStatsAsPdf(filename = 'KeepMovizEZ_Report.pdf') {
    if (!globalStatsData || !globalStatsData.totalEntries) {
        showToast("Export Error", "No statistics data available to export.", "error"); 
        return;
    }
    showLoading("Generating Your Comprehensive PDF Report...");
    await new Promise(resolve => setTimeout(resolve, 50)); 
    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
        const pageHeight = doc.internal.pageSize.height;
        const pageWidth = doc.internal.pageSize.width;
        const margin = 14;
        let yPos = 22;
        const addHeaderAndFooter = () => {
            const pageCount = doc.internal.getNumberOfPages();
            for (let i = 1; i <= pageCount; i++) {
                doc.setPage(i);
                doc.setFontSize(8); 
                doc.setTextColor(150);
                doc.text(`Page ${i} of ${pageCount}`, pageWidth - margin, pageHeight - 10);
                doc.text(`KeepMovizEZ Report | ${new Date().toLocaleDateString()}`, margin, pageHeight - 10);
            }
        };
        const renderChartOffscreen = async (type, chartLabels, chartDataSets, options = {}) => {
            const offscreenCanvas = document.createElement('canvas');
            offscreenCanvas.width = 800;
            offscreenCanvas.height = 600;
            const chartTextColor = '#333';
            const gridColor = '#e0e0e0';
            
            let chartOptions = {
                responsive: false,
                animation: false,
                plugins: { legend: { display: true, labels: { color: chartTextColor, font: { size: 18 } } } },
                scales: { x: { display: (type === 'bar' || type === 'line'), ticks: { color: chartTextColor }, grid: { color: gridColor } }, y: { display: (type === 'bar' || type === 'line'), ticks: { color: chartTextColor }, grid: { color: gridColor }, beginAtZero: true } },
                ...options
            };
            if (type === 'radar') chartOptions.scales = { r: { angleLines: { color: gridColor }, grid: { color: gridColor }, pointLabels: { color: chartTextColor, font: { size: 14 } }, ticks: { backdropColor: 'transparent', color: chartTextColor, stepSize: 1, min: 0, max: 5 } } };
            const chart = new Chart(offscreenCanvas.getContext('2d'), {
                type,
                data: {
                    labels: chartLabels,
                    datasets: chartDataSets.map(ds => ({
                        ...ds,
                        backgroundColor: generateColors(ds.data.length, 0.8),
                        borderColor: generateColors(ds.data.length, 1),
                        borderWidth: 1.5,
                        tension: 0.3
                    }))
                },
                options: chartOptions
            });
            await new Promise(resolve => setTimeout(resolve, 250)); 
            const imgData = chart.toBase64Image();
            chart.destroy();
            return imgData;
        };
        doc.setFontSize(18); doc.setTextColor(44, 62, 80); doc.text("Statistics Report", margin, yPos);
        yPos += 13;
        doc.setFontSize(12); doc.text("Overall Summary", margin, yPos);
        yPos += 5;

        doc.autoTable({
            startY: yPos,
            theme: 'grid',
            headStyles: { fillColor: [44, 62, 80] },
            body: [
                ['Total Entries in Log', globalStatsData.totalEntries],
                ['Total Titles Watched', globalStatsData.totalTitlesWatched],
                ['Total Individual Watch Instances', globalStatsData.totalWatchInstances],
                ['Estimated Total Watch Time', formatDuration(globalStatsData.totalWatchTimeMinutes, 'days')],
                ['Average Overall Rating (Watched)', `${globalStatsData.avgOverallRating} / 5`],
            ]
        });
        yPos = doc.lastAutoTable.finalY + 10;
        doc.setFontSize(12); doc.text("Visual Overview", margin, yPos);
        yPos += 5;
        const chartImage1 = await renderChartOffscreen('pie', globalStatsData.statuses.map(d => d.label), [{ data: globalStatsData.statuses.map(d => d.value) }]);
        const chartImage2 = await renderChartOffscreen('doughnut', globalStatsData.overallRatingDistributionData.map(d => d.label), [{ data: globalStatsData.overallRatingDistributionData.map(d => d.value) }]);
        if (chartImage1) doc.addImage(chartImage1, 'PNG', margin, yPos, 80, 60);
        if (chartImage2) doc.addImage(chartImage2, 'PNG', pageWidth - 80 - margin, yPos, 80, 60);
        doc.addPage();
        yPos = 22;
        doc.setFontSize(12); doc.setTextColor(44, 62, 80); doc.text("Detailed Breakdowns", margin, yPos);
        yPos += 8;
        const tableWidth = (pageWidth - (margin * 2) - 10) / 2;
        doc.autoTable({ startY: yPos, head: [['Category', 'Count']], body: globalStatsData.categories.map(item => [item.label, item.value]), theme: 'striped', headStyles: { fillColor: [44, 62, 80] }, margin: { right: pageWidth - margin - tableWidth } });
        doc.autoTable({ startY: yPos, head: [['Top 10 Countries', 'Count']], body: globalStatsData.topCountries.slice(0, 10).map(item => [item.label, item.value]), theme: 'striped', headStyles: { fillColor: [44, 62, 80] }, margin: { left: margin + tableWidth + 10 } });
        yPos = doc.lastAutoTable.finalY + 10;
        doc.setFontSize(11); doc.text("Watch Activity by Year", margin, yPos);
        yPos += 5;
        doc.autoTable({ startY: yPos, head: [['Year', 'Instances', 'Unique Titles', 'Avg. Rating']], body: globalStatsData.watchesByYear.slice(0, 20).map(r => [r.year, r.instances, r.unique_titles, r.avg_rating]), theme: 'grid', headStyles: { fillColor: [44, 62, 80] } });
        doc.addPage();
        yPos = 22;
        doc.setFontSize(12); doc.setTextColor(44, 62, 80); doc.text("People & Production", margin, yPos);
        yPos += 8;
        doc.autoTable({ startY: yPos, head: [['Top 10 Watched Actors', 'Appearances']], body: globalStatsData.mostWatchedActors.slice(0, 10).map(item => [item.label, item.value]), theme: 'striped', headStyles: { fillColor: [44, 62, 80] }, margin: { right: pageWidth / 2 + 5 } });
        doc.autoTable({ startY: yPos, head: [['Top 10 Watched Directors', 'Films']], body: globalStatsData.mostWatchedDirectors.slice(0, 10).map(item => [item.label, item.value]), theme: 'striped', headStyles: { fillColor: [44, 62, 80] }, margin: { left: pageWidth / 2 + 5 } });
        yPos = doc.lastAutoTable.finalY + 10;
        doc.setFontSize(11); doc.text("Top 10 Production Companies", margin, yPos);
        yPos += 5;
        doc.autoTable({ startY: yPos, head: [['Company', 'Count']], body: globalStatsData.mostFrequentProductionCompanies.slice(0, 10).map(item => [item.label, item.value]), theme: 'grid', headStyles: { fillColor: [44, 62, 80] } });
        doc.addPage();
        yPos = 22;
        doc.setFontSize(12); doc.setTextColor(44, 62, 80); doc.text("Visual Data Insights", margin, yPos);
        yPos += 8;
        const chartImage3 = await renderChartOffscreen('bar', globalStatsData.watchesByYear.map(d => d.year).reverse(), [{ label: 'Watch Instances', data: globalStatsData.watchesByYear.map(d => d.instances).reverse() }]);
        const topGenresForChart = globalStatsData.topSingleGenres.slice(0, 10);
        const chartImage4 = await renderChartOffscreen('bar', topGenresForChart.map(d => d.label), [{ label: 'Entries', data: topGenresForChart.map(d => d.value) }], { indexAxis: 'y' });
        if (chartImage3) doc.addImage(chartImage3, 'PNG', margin, yPos, (pageWidth - margin * 2), 80);
        yPos += 90;
        if (chartImage4) doc.addImage(chartImage4, 'PNG', margin, yPos, (pageWidth - margin * 2), 100);
        doc.addPage();
        yPos = 22;
        doc.setFontSize(12); doc.setTextColor(44, 62, 80); doc.text("Achievements Unlocked", margin, yPos);
        yPos += 10;
        const unlockedAchievements = [];
        ACHIEVEMENTS.forEach(ach => {
            const { isAchieved } = checkAchievement(ach, globalStatsData);
            if (isAchieved) unlockedAchievements.push([ach.name, ach.description]);
        });
        if (unlockedAchievements.length > 0) {
            doc.autoTable({ startY: yPos, head: [['Achievement', 'Description']], body: unlockedAchievements, theme: 'grid', headStyles: { fillColor: [44, 62, 80] } });
        } else {
            doc.setFontSize(10).setTextColor(100).text("No achievements unlocked yet. Keep watching!", margin, yPos);
        }
        addHeaderAndFooter();
        doc.save(filename);
        showToast("PDF Exported", `${filename} has been generated.`, "success");
    } catch (error) {
        console.error('Error exporting PDF:', error);
        showToast("PDF Export Error", `Failed: ${error.message}. Check console for details.`, "error", 7000);
    } finally {
        hideLoading();
    }
}
function getDailyRecommendationMovie() {
    let message = "No recommendations available. Try adding more movies to your 'To Watch' list!";
    const today = new Date().toISOString().slice(0, 10);
    const lastRecDate = localStorage.getItem(DAILY_RECOMMENDATION_DATE_KEY);
    const lastRecId = localStorage.getItem(DAILY_RECOMMENDATION_ID_KEY);
    let dailyRecSkipCount = parseInt(localStorage.getItem(DAILY_REC_SKIP_COUNT_KEY) || '0');
    
    // Reset skips if it's a new day
    if (lastRecDate !== today) {
        dailyRecSkipCount = 0;
        localStorage.setItem(DAILY_REC_SKIP_COUNT_KEY, '0');
        localStorage.removeItem(DAILY_RECOMMENDATION_ID_KEY);
    }
    
    // Check skip limit
    if (lastRecDate === today && dailyRecSkipCount >= MAX_DAILY_SKIPS) {
        return { message: "You've skipped the maximum number of daily recommendations. Check back tomorrow!", movie: null, dailyRecSkipCount };
    }
    
    // Return existing recommendation if valid
    if (lastRecDate === today && lastRecId) {
        const existingRec = movieData.find(m => m.id === lastRecId && m.Status === 'To Watch' && !m.doNotRecommendDaily && !m.is_deleted);
        if (existingRec) {
            return { message: "Success", movie: existingRec, dailyRecSkipCount };
        }
    }
    
    // Find new recommendation
    const toWatchList = movieData.filter(m => m.Status === 'To Watch' && !m.doNotRecommendDaily && !m.is_deleted);
    if (toWatchList.length === 0) return { message, movie: null, dailyRecSkipCount };
    
    const potentialPicks = toWatchList.filter(m => m.id !== lastRecId);
    const listToPickFrom = potentialPicks.length > 0 ? potentialPicks : toWatchList;
    const recommendedMovie = listToPickFrom[Math.floor(Math.random() * listToPickFrom.length)];
    
    localStorage.setItem(DAILY_RECOMMENDATION_ID_KEY, recommendedMovie.id);
    localStorage.setItem(DAILY_RECOMMENDATION_DATE_KEY, today);
    
    // Show toast only if it's the first time generating today
    if (lastRecDate !== today) {
        showToast("Daily Recommendation", "Here is your pick for today!", "info", 4000, DO_NOT_SHOW_AGAIN_KEYS.DAILY_RECOMMENDATION_INTRO);
    }
    
    return { message: "Success", movie: recommendedMovie, dailyRecSkipCount };
}