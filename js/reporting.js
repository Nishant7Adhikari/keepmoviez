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

const DAILY_RECOMMENDATION_QUEUE_SIZE = MAX_DAILY_SKIPS + 1;

function getDailyRecommendationModalState() {
    if (!window.dailyRecommendationModalState) {
        window.dailyRecommendationModalState = {
            today: null,
            queue: [],
            currentIndex: 0,
            skipCount: 0,
            message: '',
        };
    }

    return window.dailyRecommendationModalState;
}

function shuffleDailyRecommendationMovies(items) {
    const shuffled = [...items];
    for (let index = shuffled.length - 1; index > 0; index--) {
        const swapIndex = Math.floor(Math.random() * (index + 1));
        [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
    }
    return shuffled;
}

function getDailyRecommendationPickReason(movie) {
    let pickReason = "This title matches your overall movie taste and is waiting for you in your watchlist!";
    if (window.globalStatsData && Array.isArray(window.globalStatsData.topRatedGenresOverall) && window.globalStatsData.topRatedGenresOverall.length > 0) {
        const genres = (movie.Genre || '').split(',').map(g => g.trim());
        const favoriteGenreObj = window.globalStatsData.topRatedGenresOverall[0];
        const match = genres.find(g => g.toLowerCase() === favoriteGenreObj.label.toLowerCase());
        if (match) {
            pickReason = `Matches one of your top-rated genres: <strong>${match}</strong> (average rating: ${favoriteGenreObj.value} <i class="fas fa-star text-warning"></i>)!`;
        } else if (window.globalStatsData.mostWatchedDirectors && window.globalStatsData.mostWatchedDirectors.length > 0 && movie.director_info && movie.director_info.name) {
            const topDirector = window.globalStatsData.mostWatchedDirectors[0].label;
            if (movie.director_info.name === topDirector) {
                pickReason = `Directed by <strong>${topDirector}</strong>, who is currently your most-watched director!`;
            }
        }
    }

    return pickReason;
}

async function prepareDailyRecommendationCard(movie) {
    let backdropUrl = '';

    if (movie.tmdbId) {
        try {
            const mediaType = movie.tmdbMediaType || (movie.Category === 'Series' ? 'tv' : 'movie');
            const detailData = await callTmdbApiDirect(`/${mediaType}/${movie.tmdbId}`);
            if (detailData && detailData.backdrop_path) {
                backdropUrl = `https://image.tmdb.org/t/p/w780${detailData.backdrop_path}`;
            }
        } catch (e) {
            console.warn("Could not fetch daily pick backdrop from TMDB:", e);
        }
    }

    if (!backdropUrl && (movie.poster_url || movie['Poster URL'])) {
        backdropUrl = movie.poster_url || movie['Poster URL'];
    }

    const rating = parseFloat(movie.tmdb_vote_average) || parseFloat(movie.overallRating) || 0.0;
    const ratingPercentage = Math.round(rating * 10);
    let gaugeColorClass = 'gauge-low';
    if (rating >= 7.0) {
        gaugeColorClass = 'gauge-high';
    } else if (rating >= 5.0) {
        gaugeColorClass = 'gauge-mid';
    }

    return {
        movie,
        backdropUrl,
        rating,
        ratingPercentage,
        gaugeColorClass,
        pickReason: getDailyRecommendationPickReason(movie),
    };
}

function renderDailyRecommendationCard(card, dailyRecSkipCount) {
    const movie = card.movie;
    const hasStandbyCards = Array.isArray(card.remainingCards) && card.remainingCards.length > 0;
    return `
            <button type="button" class="daily-pick-close-btn" data-dismiss="modal" aria-label="Close" title="Close">
                <i class="fas fa-times"></i>
            </button>
            <div class="daily-pick-backdrop" style="background-image: ${card.backdropUrl ? `url('${card.backdropUrl}')` : 'linear-gradient(135deg, #1e3c72 0%, #2a5298 100%)'};">
                <div class="daily-pick-header-content">
                    <div class="daily-pick-meta">${movie.Category || 'N/A'} &bull; ${movie.Year || 'N/A'}</div>
                    <h2 class="daily-pick-title">${movie.Name}</h2>
                </div>
            </div>
            
            <div class="daily-pick-body">
                <div class="d-flex justify-content-between align-items-center mt-3">
                    <div class="daily-pick-badge-row">
                        ${(movie.Genre || '').split(',').map(g => `<span class="badge badge-pill badge-secondary" style="background: rgba(128, 128, 128, 0.12); color: var(--body-text-color); border: 1px solid rgba(128, 128, 128, 0.2);">${g.trim()}</span>`).join('')}
                    </div>
                    
                    <div class="gauge-container" title="TMDB Rating: ${card.rating > 0 ? card.rating.toFixed(1) : 'N/A'}/10">
                        <svg viewBox="0 0 36 36" class="circular-chart">
                            <path class="circle-bg"
                                d="M18 2.0845
                                    a 15.9155 15.9155 0 0 1 0 31.831
                                    a 15.9155 15.9155 0 0 1 0 -31.831"
                            />
                            <path class="circle ${card.gaugeColorClass}"
                                stroke-dasharray="${card.ratingPercentage}, 100"
                                d="M18 2.0845
                                    a 15.9155 15.9155 0 0 1 0 31.831
                                    a 15.9155 15.9155 0 0 1 0 -31.831"
                            />
                            <text x="18" y="20.35" class="percentage">${card.rating > 0 ? card.rating.toFixed(1) : 'N/A'}</text>
                        </svg>
                    </div>
                </div>
                
                <div class="daily-pick-reason-box">
                    <i class="fas fa-magic text-primary mr-1"></i> ${card.pickReason}
                </div>
                
                <div class="daily-pick-description">
                    ${movie.Description || 'No description available. Open details view to fetch more info.'}
                </div>
                
                <div class="daily-pick-standby-strip">
                    <span class="daily-pick-standby-label">Up next</span>
                    ${hasStandbyCards ? card.remainingCards.map(nextCard => `<span class="daily-pick-standby-chip">${nextCard.movie.Name}</span>`).join('') : '<span class="daily-pick-standby-empty">No standby picks left</span>'}
                </div>
                
                <div class="d-flex justify-content-between align-items-center mt-4">
                    <small class="text-muted">Skips left: <strong>${MAX_DAILY_SKIPS - dailyRecSkipCount}</strong></small>
                    <div>
                        ${hasStandbyCards
            ? `<button class="btn btn-warning skip-daily-rec-modal mr-2" data-movie-id="${movie.id}" title="Skip this pick for today"><i class="fas fa-forward"></i> Skip</button>`
            : `<button class="btn btn-warning mr-2" disabled title="No more skips left"><i class="fas fa-ban"></i> No more skips</button>`}
                        <button class="btn btn-info view-btn-modal mr-2" data-movie-id="${movie.id}" title="View Details"><i class="fas fa-eye"></i> View</button>
                        <button class="btn btn-success mark-completed-daily-rec-modal" data-movie-id="${movie.id}" title="Mark as Watched"><i class="fas fa-check-circle"></i> Watched It!</button>
                    </div>
                </div>
                ${hasStandbyCards ? '' : '<div class="daily-pick-no-more-skips">No more skipping. The recommendation bureau has closed for business.</div>'}
            </div>`;
}

function bindDailyRecommendationCardActions(modalBody) {
    const viewButton = modalBody.querySelector('.view-btn-modal');
    const markCompletedButton = modalBody.querySelector('.mark-completed-daily-rec-modal');
    const skipButton = modalBody.querySelector('.skip-daily-rec-modal');

    if (viewButton) {
        viewButton.addEventListener('click', function () {
            if (typeof window.preserveModalForBackNavigation === 'function') {
                window.preserveModalForBackNavigation('#dailyRecommendationModal');
            }
            $('#dailyRecommendationModal').modal('hide');
            $('#dailyRecommendationModal').one('hidden.bs.modal', () => openDetailsModal(this.dataset.movieId));
        });
    }

    if (markCompletedButton) {
        markCompletedButton.addEventListener('click', async function (event) {
            await window.markDailyRecCompleted(event);
        });
    }

    if (skipButton) {
        skipButton.addEventListener('click', async function (event) {
            await window.advanceDailyRecommendationModal(event);
        });
    }
}

async function buildDailyRecommendationModalState() {
    const state = getDailyRecommendationModalState();
    const today = new Date().toISOString().slice(0, 10);
    const lastRecDate = localStorage.getItem(DAILY_RECOMMENDATION_DATE_KEY);
    const lastRecId = localStorage.getItem(DAILY_RECOMMENDATION_ID_KEY);
    let dailyRecSkipCount = parseInt(localStorage.getItem(DAILY_REC_SKIP_COUNT_KEY) || '0');

    if (lastRecDate !== today) {
        dailyRecSkipCount = 0;
        localStorage.setItem(DAILY_REC_SKIP_COUNT_KEY, '0');
        localStorage.removeItem(DAILY_RECOMMENDATION_ID_KEY);
    }

    state.today = today;
    state.skipCount = dailyRecSkipCount;
    state.message = 'Success';

    if (lastRecDate === today && dailyRecSkipCount >= MAX_DAILY_SKIPS) {
        state.queue = [];
        state.currentIndex = 0;
        state.message = "You've skipped the maximum number of daily recommendations. Check back tomorrow!";
        return state;
    }

    const toWatchList = movieData.filter(m => m.Status === 'To Watch' && !m.doNotRecommendDaily && !m.is_deleted);
    if (toWatchList.length === 0) {
        state.queue = [];
        state.currentIndex = 0;
        state.message = "No recommendations available. Try adding more movies to your 'To Watch' list!";
        return state;
    }

    let seedMovie = null;
    if (lastRecDate === today && lastRecId) {
        seedMovie = movieData.find(m => m.id === lastRecId && m.Status === 'To Watch' && !m.doNotRecommendDaily && !m.is_deleted) || null;
    }

    if (!seedMovie) {
        const potentialPicks = toWatchList.filter(m => m.id !== lastRecId);
        const listToPickFrom = potentialPicks.length > 0 ? potentialPicks : toWatchList;
        seedMovie = listToPickFrom[Math.floor(Math.random() * listToPickFrom.length)];
        localStorage.setItem(DAILY_RECOMMENDATION_ID_KEY, seedMovie.id);
        localStorage.setItem(DAILY_RECOMMENDATION_DATE_KEY, today);

        if (lastRecDate !== today) {
            showToast("Daily Recommendation", "Here is your pick for today!", "info", 4000, DO_NOT_SHOW_AGAIN_KEYS.DAILY_RECOMMENDATION_INTRO);
        }
    }

    const standbyMovies = shuffleDailyRecommendationMovies(toWatchList.filter(m => m.id !== seedMovie.id));
    const queueMovies = [seedMovie, ...standbyMovies].slice(0, DAILY_RECOMMENDATION_QUEUE_SIZE);
    state.queue = await Promise.all(queueMovies.map(prepareDailyRecommendationCard));
    state.currentIndex = 0;

    return state;
}

async function advanceDailyRecommendationModal(event) {
    const modalContent = document.querySelector('.daily-pick-modal-content');
    const modalBody = document.getElementById('dailyRecommendationModalBody');
    const state = getDailyRecommendationModalState();
    const nextIndex = state.currentIndex + 1;

    if (!state.queue[nextIndex]) {
        localStorage.removeItem(DAILY_RECOMMENDATION_ID_KEY);
        if (modalContent) {
            modalContent.classList.add('skip-card-transition');
            await new Promise(resolve => setTimeout(resolve, 300));
        }
        if (modalBody && state.queue[state.currentIndex]) {
            modalBody.innerHTML = renderDailyRecommendationCard({
                ...state.queue[state.currentIndex],
                remainingCards: [],
            }, state.skipCount);
            bindDailyRecommendationCardActions(modalBody);
        }
        showToast("No more skips", "The algorithm has seized the means of recommendation. This is the last pick.", "info");
        return;
    }

    if (modalContent) {
        modalContent.classList.add('skip-card-transition');
        await new Promise(resolve => setTimeout(resolve, 300));
    }

    state.skipCount += 1;
    localStorage.setItem(DAILY_REC_SKIP_COUNT_KEY, state.skipCount.toString());

    state.currentIndex = nextIndex;
    localStorage.setItem(DAILY_RECOMMENDATION_ID_KEY, state.queue[state.currentIndex].movie.id);
    localStorage.setItem(DAILY_RECOMMENDATION_DATE_KEY, state.today || new Date().toISOString().slice(0, 10));

    if (modalBody) {
        modalBody.innerHTML = renderDailyRecommendationCard({
            ...state.queue[state.currentIndex],
            remainingCards: state.queue.slice(state.currentIndex + 1),
        }, state.skipCount);
        bindDailyRecommendationCardActions(modalBody);
    }

    if (modalContent) {
        modalContent.classList.remove('skip-card-transition');
    }
}

async function displayDailyRecommendationModal() {
    const modalBody = document.getElementById('dailyRecommendationModalBody');
    if (!modalBody) { console.warn("Daily recommendation modal body not found."); return; }
    modalBody.innerHTML = '<p class="text-center text-muted p-5"><i class="fas fa-spinner fa-spin fa-2x"></i><span class="d-block mt-2">Finding your daily pick...</span></p>';

    const state = await buildDailyRecommendationModalState();
    const dailyRecMovie = state.queue[state.currentIndex];
    const dailyRecSkipCount = state.skipCount;
    const dailyRecMsg = state.message;

    if (dailyRecMovie) {
        modalBody.innerHTML = renderDailyRecommendationCard({
            ...dailyRecMovie,
            remainingCards: state.queue.slice(state.currentIndex + 1),
        }, dailyRecSkipCount);
        bindDailyRecommendationCardActions(modalBody);
    } else {
        modalBody.innerHTML = `
            <button type="button" class="daily-pick-close-btn" data-dismiss="modal" aria-label="Close" title="Close">
                <i class="fas fa-times"></i>
            </button>
            <div class="p-5 text-center">
                <i class="fas fa-calendar-day fa-3x text-muted mb-3"></i>
                <p class="text-muted">${dailyRecMsg}</p>
                <button class="btn btn-secondary mt-3" data-dismiss="modal">Close</button>
            </div>`;
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
    const metaEl = document.getElementById('recommendationsListMeta');
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
        if (metaEl) metaEl.textContent = 'Need a stronger seed movie to build the hub.';
        return;
    }
    
    titleEl.textContent = `Suggestions based on "${seedMovie.Name}"`;
    
    const carousels = await fetchSuggestionCarousels(seedMovie);

    if (carousels.length === 0) {
        listEl.innerHTML = '<div class="list-group-item text-muted small p-3">No new suggestions found based on this movie. Try refreshing for a new seed!</div>';
        if (metaEl) metaEl.textContent = `Seeded from ${seedMovie.Name}. No sections were strong enough to display.`;
        return;
    }

    if (metaEl) {
        const sectionCount = carousels.filter(carousel => carousel.items.length > 0).length;
        metaEl.textContent = `${sectionCount} recommendation section${sectionCount === 1 ? '' : 's'} ready. Built from ${seedMovie.Name}.`;
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
    // Build a Set of composite keys (mediaType_tmdbId) to correctly differentiate
    // movies and TV shows that share the same numeric TMDB ID.
    const loggedTmdbKeys = new Set(movieData.filter(m => m.tmdbId).map(m => {
        const type = m.tmdbMediaType || (m.Category === 'Series' ? 'tv' : 'movie');
        return `${type}_${m.tmdbId}`;
    }));
    
    // 1. "Because You Liked..." carousel
    try {
        const seedMediaType = seedMovie.tmdbMediaType || 'movie';
        const data = await callTmdbApiDirect(`/${seedMediaType}/${seedMovie.tmdbId}/recommendations`);
        const items = (data.results || []).filter(rec => {
            const recType = rec.media_type || seedMediaType;
            return !loggedTmdbKeys.has(`${recType}_${rec.id}`);
        }).slice(0, 10);
        if(items.length > 0) carousels.push({ title: `Because you liked "${seedMovie.Name}"`, items });
    } catch (e) { console.warn("Could not fetch TMDB recommendations:", e); }
    
    // 2. "More from Director..." carousel
    if (seedMovie.director_info && seedMovie.director_info.id) {
        try {
            const data = await callTmdbApiDirect(`/person/${seedMovie.director_info.id}/combined_credits`);
            const items = (data.cast || []).concat(data.crew || [])
                .filter(c => c.id !== parseInt(seedMovie.tmdbId) && (c.media_type === 'movie' || c.media_type === 'tv') && !loggedTmdbKeys.has(`${c.media_type}_${c.id}`))
                .sort((a,b) => b.popularity - a.popularity)
                .slice(0, 10);
            if(items.length > 0) carousels.push({ title: `More from ${seedMovie.director_info.name}`, items });
        } catch (e) { console.warn(`Could not fetch director credits for ${seedMovie.director_info.name}:`, e); }
    }
    
    // 3. "Complete the Collection" carousel
    if (seedMovie.tmdb_collection_id) {
         try {
            const data = await callTmdbApiDirect(`/collection/${seedMovie.tmdb_collection_id}`);
            // Collection parts are always movies
            const items = (data.parts || []).filter(rec => !loggedTmdbKeys.has(`movie_${rec.id}`)).slice(0, 10);
            if(items.length > 0) carousels.push({ title: `Complete the "${seedMovie.tmdb_collection_name}"`, items });
        } catch (e) { console.warn("Could not fetch collection details:", e); }
    }
    
    // 4. Fallback: Popular Movies in the same Genre
    const primaryGenre = (seedMovie.Genre || '').split(',')[0].trim();
    const genreObject = GENRE_MAP.find(g => g.name === primaryGenre);
    if(carousels.length < 2 && genreObject) {
        try {
            const data = await callTmdbApiDirect(`/discover/movie`, { with_genres: genreObject.id, sort_by: 'popularity.desc' });
            // Discover/movie results are always movies
            const items = (data.results || []).filter(rec => !loggedTmdbKeys.has(`movie_${rec.id}`)).slice(0, 10);
            if(items.length > 0) carousels.push({ title: `Popular in ${primaryGenre}`, items });
        } catch (e) { console.warn("Could not fetch popular by genre:", e); }
    }

    return carousels;
}

// Renders a single carousel (title + cards) using premium scrolling container
function renderSuggestionCarousel(title, items) {
    const carouselWrapper = document.createElement('div');
    carouselWrapper.className = 'suggestion-carousel-wrapper mb-4';

    const carouselTitle = document.createElement('h6');
    carouselTitle.textContent = title;

    const cardContainer = document.createElement('div');
    cardContainer.className = 'suggestion-card-container';
    
    items.forEach(item => {
        cardContainer.appendChild(renderSuggestionCard(item));
    });

    carouselWrapper.appendChild(carouselTitle);
    carouselWrapper.appendChild(cardContainer);
    return carouselWrapper;
}

// Renders a single suggestion card with Match Score and Quick Action overlays
function renderSuggestionCard(item) {
    const card = document.createElement('div');
    card.className = 'suggestion-card';

    const posterPath = item.poster_path ? `${TMDB_IMAGE_BASE_URL}w342${item.poster_path}` : 'icons/placeholder-poster.png';
    const name = item.title || item.name;
    const year = (item.release_date || item.first_air_date || '').substring(0, 4);

    // Calculate match score
    const matchScore = calculateMatchScoreForRecommendation(item);
    let matchColorClass = 'match-score-low';
    if (matchScore >= 88) {
        matchColorClass = 'match-score-high';
    } else if (matchScore >= 80) {
        matchColorClass = 'match-score-mid';
    }

    card.innerHTML = `
        <div class="match-score-badge ${matchColorClass}">${matchScore}% Match</div>
        <img src="${posterPath}" alt="Poster for ${name}" loading="lazy">
        
        <!-- Hover Quick Actions Overlay -->
        <div class="quick-action-overlay">
            <button class="quick-action-btn quick-action-add" title="Add to Watchlist" aria-label="Add to Watchlist">
                <i class="fas fa-plus"></i>
            </button>
            <button class="quick-action-btn quick-action-watch" title="Mark as Watched" aria-label="Mark as Watched">
                <i class="fas fa-check"></i>
            </button>
        </div>
        
        <div class="suggestion-card-info">
            <strong>${name}</strong>
            <small class="text-muted">${year || 'N/A'}</small>
        </div>
    `;

    // Tooltip configuration
    const voteAvg = item.vote_average ? item.vote_average.toFixed(1) : 'N/A';
    card.setAttribute('title', `${name} (${year || 'N/A'}) - TMDB Rating: ${voteAvg}/10`);
    $(card).tooltip({ boundary: 'window', trigger: 'hover' });

    // Handle Quick Action Clicks
    card.querySelector('.quick-action-add').addEventListener('click', async (e) => {
        e.stopPropagation();
        e.preventDefault();
        $(card).tooltip('hide');
        
        // Smoothly fade card element to indicate action
        card.style.opacity = '0.4';
        card.style.pointerEvents = 'none';
        
        await fastSaveSuggestion(item, 'To Watch');
        
        // Remove card element from DOM after save
        $(card).fadeOut(400, () => {
            const container = card.parentElement;
            card.remove();
            // If container is empty, show a fallback message or refresh suggestions
            if (container && container.children.length === 0) {
                const wrapper = container.parentElement;
                if (wrapper) {
                    $(wrapper).fadeOut(400, () => wrapper.remove());
                }
            }
        });
    });

    card.querySelector('.quick-action-watch').addEventListener('click', async (e) => {
        e.stopPropagation();
        e.preventDefault();
        $(card).tooltip('hide');
        
        // Smoothly fade card element to indicate action
        card.style.opacity = '0.4';
        card.style.pointerEvents = 'none';
        
        const savedEntryId = await fastSaveSuggestion(item, 'Watched');
        if (savedEntryId) {
            $('#personalizedSuggestionsModal').modal('hide');
            $('#personalizedSuggestionsModal').one('hidden.bs.modal', () => {
                prepareQuickUpdateModal(savedEntryId);
            });
        }
    });

    // Handle Card click to view details
    card.addEventListener('click', () => {
        if (typeof window.preserveModalForBackNavigation === 'function') {
            window.preserveModalForBackNavigation('#personalizedSuggestionsModal');
        }
        $('#personalizedSuggestionsModal').modal('hide');
        $('#personalizedSuggestionsModal').one('hidden.bs.modal', () => {
            openDetailsModal(null, item);
        });
    });

    return card;
}

// Dynamic Taste affinity Match Score calculator
function calculateMatchScoreForRecommendation(item) {
    let score = 75; // base match score
    const itemGenres = item.genre_ids || [];
    
    if (window.globalStatsData && Array.isArray(window.globalStatsData.topRatedGenresOverall)) {
        // Map genre_ids to local names using our GENRE_MAP
        const localGenreNames = itemGenres.map(id => {
            const mapObj = GENRE_MAP.find(g => g.id === id);
            return mapObj ? mapObj.name : null;
        }).filter(Boolean);
        
        let matchingTopGenre = false;
        localGenreNames.forEach(genreName => {
            const ratedGenre = window.globalStatsData.topRatedGenresOverall.find(g => g.label.toLowerCase() === genreName.toLowerCase());
            if (ratedGenre) {
                matchingTopGenre = true;
                const ratingVal = parseFloat(ratedGenre.value) || 0;
                if (ratingVal >= 4.0) {
                    score += 6;
                } else {
                    score += 3;
                }
            }
        });
        
        if (!matchingTopGenre) {
            score += Math.floor(Math.random() * 5); // organic variety
        }
    }
    
    if (item.vote_average && item.vote_average >= 7.5) {
        score += 4;
    }
    
    return Math.min(score, 98); // Cap match score at 98%
}

// Fast-save engine for suggestion quick-action overlays
async function fastSaveSuggestion(item, status) {
    const isSeries = item.media_type === 'tv';
    const name = item.title || item.name;
    const year = (item.release_date || item.first_air_date || '').substring(0, 4);
    
    // Check if duplicate
    const existing = window.movieData.find(m => m.tmdbId == item.id && !m.is_deleted);
    let savedEntryId;
    
    showLoading(status === 'To Watch' ? "Adding to Watchlist..." : "Saving details...");
    
    let processed = {};
    try {
        processed = await fetchAndProcessTmdbDetails(item.media_type || (item.name ? 'tv' : 'movie'), item.id);
    } catch (err) {
        console.warn("Could not fetch full details for fast-save:", err);
        // Fallback minimally if tmdb fetch fails
        processed = {
            Name: name,
            Category: isSeries ? 'Series' : 'Movie',
            Genre: '',
            genres: [],
            Language: '',
            Year: year,
            Country: '',
            Description: item.overview || '',
            "Poster URL": item.poster_path ? `${TMDB_IMAGE_BASE_URL}w500${item.poster_path}` : '',
            poster_url: item.poster_path ? `${TMDB_IMAGE_BASE_URL}w500${item.poster_path}` : '',
            keywords: [],
            full_cast: [],
            director_info: null,
            production_companies: [],
            tmdb_vote_average: item.vote_average || null,
            tmdb_vote_count: item.vote_count || null,
            runtime: null,
            tmdb_collection_id: null,
            tmdb_collection_name: null,
            tmdb_collection_total_parts: null,
            imdb_id: null,
            tmdb_release_date: item.release_date || item.first_air_date || null
        };
    }

    // Map genres to local UNIQUE_ALL_GENRES names
    const localGenres = [];
    if (processed.genres && processed.genres.length > 0) {
        processed.genres.forEach(tmdbGenreName => {
            const matchedLocalGenre = UNIQUE_ALL_GENRES.find(localGenre => String(localGenre).toLowerCase() === String(tmdbGenreName).toLowerCase().replace(/-/g, ' '));
            if (matchedLocalGenre) {
                localGenres.push(matchedLocalGenre);
            }
        });
    }
    const genreString = [...new Set(localGenres)].sort().join(", ");
    
    if (existing) {
        // Update status and fields of existing entry
        existing.Status = status;
        existing.Name = processed.Name || existing.Name;
        existing.Category = processed.Category || existing.Category;
        existing.Genre = genreString || existing.Genre;
        existing.Language = processed.Language || existing.Language;
        existing.Year = processed.Year || existing.Year;
        existing.Country = processed.Country || existing.Country;
        existing.Description = processed.Description || existing.Description;
        existing["Poster URL"] = processed["Poster URL"] || existing["Poster URL"];
        existing.poster_url = processed.poster_url || existing.poster_url;
        existing.keywords = processed.keywords.length > 0 ? processed.keywords : existing.keywords;
        existing.full_cast = processed.full_cast.length > 0 ? processed.full_cast : existing.full_cast;
        existing.director_info = processed.director_info || existing.director_info;
        existing.production_companies = processed.production_companies.length > 0 ? processed.production_companies : existing.production_companies;
        existing.tmdb_vote_average = processed.tmdb_vote_average || existing.tmdb_vote_average;
        existing.tmdb_vote_count = processed.tmdb_vote_count || existing.tmdb_vote_count;
        existing.runtime = processed.runtime || existing.runtime;
        existing.tmdb_collection_id = processed.tmdb_collection_id || existing.tmdb_collection_id;
        existing.tmdb_collection_name = processed.tmdb_collection_name || existing.tmdb_collection_name;
        existing.tmdb_collection_total_parts = processed.tmdb_collection_total_parts || existing.tmdb_collection_total_parts;
        existing.imdb_id = processed.imdb_id || existing.imdb_id;
        existing.tmdb_release_date = processed.tmdb_release_date || existing.tmdb_release_date;

        existing.lastModifiedDate = new Date().toISOString();
        if (existing._sync_state !== 'new') existing._sync_state = 'edited';
        
        savedEntryId = existing.id;
    } else {
        // Construct and save new entry with full details
        const newEntry = {
            id: generateUUID(),
            Name: processed.Name || name,
            Category: processed.Category,
            Genre: genreString,
            Status: status,
            seasonsCompleted: 0,
            currentSeasonEpisodesWatched: 0,
            Recommendation: "",
            overallRating: "",
            personalRecommendation: "",
            Language: processed.Language,
            Year: processed.Year || year,
            Country: processed.Country,
            Description: processed.Description,
            "Poster URL": processed["Poster URL"],
            poster_url: processed.poster_url,
            watchHistory: [],
            relatedEntries: [],
            lastModifiedDate: new Date().toISOString(),
            doNotRecommendDaily: false,
            tmdbId: item.id,
            tmdbMediaType: item.media_type || (item.name ? 'tv' : 'movie'),
            keywords: processed.keywords,
            full_cast: processed.full_cast,
            director_info: processed.director_info,
            production_companies: processed.production_companies,
            tmdb_vote_average: processed.tmdb_vote_average,
            tmdb_vote_count: processed.tmdb_vote_count,
            runtime: processed.runtime,
            tmdb_collection_id: processed.tmdb_collection_id,
            tmdb_collection_name: processed.tmdb_collection_name,
            tmdb_collection_total_parts: processed.tmdb_collection_total_parts,
            imdb_id: processed.imdb_id,
            tmdb_release_date: processed.tmdb_release_date,
            is_deleted: false,
            _sync_state: "new"
        };
        
        window.movieData.push(newEntry);
        savedEntryId = newEntry.id;
    }
    
    // Save to DB and refresh main grid
    recalculateAndApplyAllRelationships();
    sortMovies(currentSortColumn, currentSortDirection);
    renderMovieCards();
    await saveToIndexedDB();
    
    // Track modification for auto-sync
    if (typeof trackModification === 'function') {
        trackModification(savedEntryId);
    }
    
    await checkAndNotifyNewAchievements();
    if (processed.tmdb_collection_id) {
        await propagateCollectionDataUpdate({
            id: savedEntryId,
            tmdb_collection_id: processed.tmdb_collection_id,
            tmdb_collection_name: processed.tmdb_collection_name,
            tmdb_collection_total_parts: processed.tmdb_collection_total_parts
        });
    }
    
    hideLoading();
    
    if (status === 'To Watch') {
        showToast(
            "Added to Watchlist",
            `Successfully added "${processed.Name || name}" to your library!`,
            "success"
        );
    }
    
    return savedEntryId;
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
        .suggestion-hub-header {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 1rem;
            padding: 1rem 1.1rem;
            border-radius: 18px;
            background: linear-gradient(135deg, rgba(0,123,138,0.12), rgba(0,123,138,0.03));
            border: 1px solid rgba(0,123,138,0.14);
        }
        .suggestion-hub-list {
            display: grid;
            gap: 1rem;
        }
        .suggestion-carousel-wrapper {
            padding: 1rem;
            border-radius: 18px;
            background: var(--card-bg);
            border: 1px solid var(--table-border-color);
            box-shadow: var(--box-shadow-subtle);
        }
        .suggestion-carousel-wrapper .overflow-auto { -ms-overflow-style: none; scrollbar-width: none; }
        .suggestion-carousel-wrapper .overflow-auto::-webkit-scrollbar { display: none; }
        .suggestion-carousel-wrapper h6 {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 0.75rem;
            margin-bottom: 0.85rem;
            color: var(--primary-color);
            font-weight: 800;
        }
        .suggestion-card {
            flex: 0 0 auto;
            width: 150px;
            margin: 0 10px;
            cursor: pointer;
            transition: transform 0.25s ease-in-out, box-shadow 0.25s ease-in-out;
            border-radius: 14px;
            overflow: hidden;
            box-shadow: 0 8px 24px rgba(0,0,0,0.12);
            background: linear-gradient(180deg, rgba(255,255,255,0.04), rgba(0,0,0,0.04));
        }
        .suggestion-card:hover {
            transform: translateY(-4px) scale(1.03);
            box-shadow: 0 12px 28px rgba(0,0,0,0.22);
        }
        .suggestion-card img { width: 100%; height: 220px; object-fit: cover; display: block; }
        .suggestion-card-info {
            padding: 10px;
            background: rgba(0,0,0,0.12);
            color: var(--body-text-color);
            font-size: 0.82rem;
        }
        .suggestion-card-info strong {
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
            text-overflow: ellipsis;
            min-height: 2.4em; /* Approx 2 lines */
        }
        .achievement-hero {
            border-radius: 18px;
            background: linear-gradient(135deg, rgba(40,167,69,0.12), rgba(0,123,138,0.04));
            border: 1px solid rgba(40,167,69,0.14) !important;
        }
        .achievement-summary-row {
            display: flex;
            flex-wrap: wrap;
            gap: 0.5rem;
        }
        .achievement-summary-chip {
            display: inline-flex;
            align-items: center;
            padding: 0.35rem 0.75rem;
            border-radius: 999px;
            background: rgba(0,0,0,0.08);
            color: var(--body-text-color);
            font-size: 0.78rem;
            font-weight: 700;
        }
        .achievement-ratio-pill {
            border-radius: 999px;
            padding: 0.45rem 0.8rem;
        }
    `;
    const styleSheet = document.createElement("style");
    styleSheet.id = 'suggestion-hub-styles';
    styleSheet.innerText = suggestionHubCSS;
    document.head.appendChild(styleSheet);
}

// <<-- REIMAGINED SUGGESTION ENGINE END -->>

function displayAchievementsModal() {
    const containerAll = document.getElementById('achievementBadgesModal');
    const containerMilestones = document.getElementById('achievementBadgesMilestones');
    const containerGenres = document.getElementById('achievementBadgesGenres');
    const containerFun = document.getElementById('achievementBadgesFun');

    if (!containerAll) { console.warn("Achievements modal badges container not found."); return; }

    // Show loading state in all containers
    [containerAll, containerMilestones, containerGenres, containerFun].forEach(c => {
        if (c) c.innerHTML = '<p class="text-center text-muted p-3"><i class="fas fa-spinner fa-spin"></i> Calculating achievements...</p>';
    });

    const statsForAchievements = (Object.keys(globalStatsData || {}).length > 0 && globalStatsData.totalEntries > 0)
        ? globalStatsData
        : calculateAllStatistics(movieData);

    // ---- Evaluate all achievements ----
    let achievedCountForMeta = 0;
    const achievementsToDisplay = ACHIEVEMENTS.map(ach => {
        const { isAchieved, progress } = checkAchievement(ach, statsForAchievements);
        if (isAchieved && ach.type !== 'meta_achievement_count') achievedCountForMeta++;
        return { ...ach, isAchieved, progress };
    });

    const statsForMeta = { ...statsForAchievements, unlockedCountForMeta: achievedCountForMeta };
    achievementsToDisplay.forEach(ach => {
        if (ach.type === 'meta_achievement_count') {
            const { isAchieved, progress } = checkAchievement(ach, statsForMeta);
            ach.progress = progress;
            ach.isAchieved = isAchieved;
        }
    });

    // Sort: unlocked first, then by closest to completion, then alphabetically
    achievementsToDisplay.sort((a, b) =>
        (b.isAchieved - a.isAchieved) ||
        ((b.progress / (b.threshold || 1)) - (a.progress / (a.threshold || 1))) ||
        a.name.localeCompare(b.name)
    );

    // ---- Categorize achievements ----
    const milestoneTypes = ['total_entries', 'total_titles_watched', 'distinct_titles_rewatched',
        'single_title_rewatch_count', 'category_watched_count', 'long_series_watched_count',
        'status_count', 'status_count_active', 'meta_achievement_count'];
    const genreTypes = ['genre_watched_count', 'genre_variety_count', 'country_variety_count', 'language_variety_count'];

    const buckets = { all: [], milestones: [], genres: [], fun: [] };

    achievementsToDisplay.forEach(ach => {
        buckets.all.push(ach);
        if (milestoneTypes.includes(ach.type)) {
            buckets.milestones.push(ach);
        } else if (genreTypes.includes(ach.type)) {
            buckets.genres.push(ach);
        } else {
            buckets.fun.push(ach);
        }
    });

    // ---- Render into each container ----
    const renderIntoContainer = (container, items) => {
        if (!container) return;
        container.innerHTML = '';
        if (items.length === 0) {
            container.innerHTML = '<p class="text-center text-muted p-3">No achievements in this category yet.</p>';
            return;
        }
        items.forEach(ach => container.appendChild(_createAchievementBadgeElement(ach)));
    };

    renderIntoContainer(containerAll, buckets.all);
    renderIntoContainer(containerMilestones, buckets.milestones);
    renderIntoContainer(containerGenres, buckets.genres);
    renderIntoContainer(containerFun, buckets.fun);

    const bucketSummaries = [
        { label: 'Milestones', items: buckets.milestones },
        { label: 'Genre Mastery', items: buckets.genres },
        { label: 'Features & Fun', items: buckets.fun },
    ].map(bucket => {
        const achieved = bucket.items.filter(ach => ach.isAchieved).length;
        const total = bucket.items.length;
        return {
            ...bucket,
            achieved,
            total,
            percent: total > 0 ? Math.round((achieved / total) * 100) : 0,
        };
    }).sort((a, b) => b.percent - a.percent || b.achieved - a.achieved || a.label.localeCompare(b.label));

    // ---- Update global completion header ----
    const totalCount = ACHIEVEMENTS.length;
    const unlockedCount = achievementsToDisplay.filter(a => a.isAchieved).length;
    const percent = totalCount > 0 ? Math.round((unlockedCount / totalCount) * 100) : 0;

    const ratioEl = document.getElementById('globalAchievementsRatio');
    if (ratioEl) ratioEl.textContent = `${unlockedCount} / ${totalCount} Unlocked`;

    const progressBarEl = document.getElementById('globalAchievementsProgressBar');
    if (progressBarEl) {
        progressBarEl.style.width = '0%';
        // Animate the progress bar after a tiny delay for visual effect
        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                progressBarEl.style.transition = 'width 0.8s cubic-bezier(0.25, 0.8, 0.25, 1)';
                progressBarEl.style.width = percent + '%';
            });
        });
    }

    const unlockedSummaryEl = document.getElementById('achievementSummaryUnlocked');
    if (unlockedSummaryEl) unlockedSummaryEl.textContent = `${unlockedCount} achieved`;

    const lockedSummaryEl = document.getElementById('achievementSummaryLocked');
    if (lockedSummaryEl) lockedSummaryEl.textContent = `${Math.max(totalCount - unlockedCount, 0)} locked`;

    const topCategoryEl = document.getElementById('achievementSummaryTopCategory');
    if (topCategoryEl) {
        const topBucket = bucketSummaries[0];
        topCategoryEl.textContent = topBucket && topBucket.total > 0
            ? `Top category: ${topBucket.label} (${topBucket.achieved}/${topBucket.total})`
            : 'Top category: pending';
    }
}

/** Creates a single achievement badge DOM element with optional mini-progress bar for locked trophies. */
function _createAchievementBadgeElement(ach) {
    const titleText = `${ach.name} - ${ach.description} (${ach.isAchieved ? 'Completed!' : `${ach.progress} / ${ach.threshold}`})`;
    const badge = document.createElement('div');
    badge.className = `achievement-badge ${ach.isAchieved ? 'achieved' : 'locked'}`;
    badge.title = titleText;
    badge.dataset.description = ach.description;
    badge.dataset.name = ach.name;
    badge.dataset.progress = ach.progress;
    badge.dataset.threshold = ach.threshold;
    badge.dataset.achieved = ach.isAchieved;

    let progressBarHTML = '';
    if (!ach.isAchieved && ach.threshold > 0) {
        const pct = Math.min(100, Math.round((ach.progress / ach.threshold) * 100));
        progressBarHTML = `<div class="ach-progress-bar-mini" title="Progress: ${ach.progress}/${ach.threshold}"><div class="ach-progress-fill-mini" style="width: ${pct}%"></div></div>`;
    }

    badge.innerHTML = `
        <span class="fa-stack fa-2x">
            <i class="${ach.icon} fa-stack-2x"></i>
        </span>
        <span>${ach.name}</span>
        ${progressBarHTML}`;

    return badge;
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

// ==========================================================================
//  PHASE 3: LIGHTWEIGHT CANVAS CONFETTI ENGINE
// ==========================================================================

/**
 * Fires a burst of confetti particles on the #globalConfettiCanvas.
 * Self-cleans after ~5 seconds when all particles have fallen out of view.
 */
window.fireConfetti = function () {
    const canvas = document.getElementById('globalConfettiCanvas');
    if (!canvas) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    canvas.style.display = 'block';

    const ctx = canvas.getContext('2d');
    const PARTICLE_COUNT = 120;
    const COLORS = [
        '#ffc107', '#ff6f61', '#00e676', '#40c4ff', '#ab47bc',
        '#ff9100', '#e040fb', '#ffeb3b', '#69f0ae', '#ea80fc'
    ];

    const particles = [];
    for (let i = 0; i < PARTICLE_COUNT; i++) {
        particles.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height * -0.5 - 20,
            w: Math.random() * 8 + 4,
            h: Math.random() * 5 + 3,
            color: COLORS[Math.floor(Math.random() * COLORS.length)],
            vx: (Math.random() - 0.5) * 4,
            vy: Math.random() * 3 + 2,
            rotation: Math.random() * 360,
            rotationSpeed: (Math.random() - 0.5) * 10,
            opacity: 1,
        });
    }

    let animId = null;
    const startTime = performance.now();
    const DURATION = 5000; // 5 seconds max

    const _resizeHandler = () => {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', _resizeHandler);

    function animate(now) {
        const elapsed = now - startTime;
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        let alive = 0;
        particles.forEach(p => {
            p.x += p.vx;
            p.vy += 0.05; // gravity
            p.y += p.vy;
            p.rotation += p.rotationSpeed;

            // Fade out after 3.5s
            if (elapsed > 3500) {
                p.opacity = Math.max(0, p.opacity - 0.02);
            }

            if (p.y < canvas.height + 50 && p.opacity > 0) {
                alive++;
                ctx.save();
                ctx.translate(p.x, p.y);
                ctx.rotate((p.rotation * Math.PI) / 180);
                ctx.globalAlpha = p.opacity;
                ctx.fillStyle = p.color;
                ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
                ctx.restore();
            }
        });

        if (alive > 0 && elapsed < DURATION) {
            animId = requestAnimationFrame(animate);
        } else {
            // Cleanup
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            canvas.style.display = 'none';
            window.removeEventListener('resize', _resizeHandler);
            if (animId) cancelAnimationFrame(animId);
        }
    }

    animId = requestAnimationFrame(animate);
};

// ==========================================================================
//  PHASE 3: ACHIEVEMENT UNLOCK CELEBRATION OVERLAY
// ==========================================================================

/**
 * Shows a full-screen celebration overlay for a newly unlocked achievement.
 * Automatically fires confetti and provides a dismiss button.
 * @param {Object} achievement - The achievement object from ACHIEVEMENTS array.
 */
window.celebrateAchievementUnlock = function (achievement) {
    if (!achievement) return;

    // Prevent duplicate overlays
    const existing = document.querySelector('.achievement-showcase-overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.className = 'achievement-showcase-overlay';
    overlay.innerHTML = `
        <div class="achievement-showcase-card">
            <div class="achievement-showcase-icon">
                <i class="${achievement.icon || 'fas fa-trophy'}"></i>
            </div>
            <div style="font-size: 0.75rem; text-transform: uppercase; letter-spacing: 2px; color: #ffc107; font-weight: 700; margin-bottom: 0.5rem;">🏆 Achievement Unlocked!</div>
            <div class="achievement-showcase-title">${achievement.name}</div>
            <div class="achievement-showcase-desc">${achievement.description}</div>
            <button class="achievement-showcase-btn" id="achievementShowcaseDismissBtn">Awesome!</button>
        </div>
    `;

    document.body.appendChild(overlay);

    // Animate in
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            overlay.classList.add('show');
        });
    });

    // Fire confetti
    if (typeof window.fireConfetti === 'function') {
        window.fireConfetti();
    }

    // Dismiss handler
    const dismiss = () => {
        overlay.classList.remove('show');
        setTimeout(() => {
            if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
        }, 500);
    };

    const btn = overlay.querySelector('#achievementShowcaseDismissBtn');
    if (btn) btn.addEventListener('click', dismiss);

    // Also dismiss on overlay background click
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) dismiss();
    });

    // Auto-dismiss after 8 seconds
    setTimeout(dismiss, 8000);
};