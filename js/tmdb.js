/* js/tmdb.js */
// START CHUNK: TMDB API Wrapper
async function callTmdbApiDirect(endpoint, params = {}) {
    if (!window.supabaseClient) {
        throw new Error("Supabase client is not available.");
    }

    try {
        const { data, error } = await window.supabaseClient.functions.invoke('tmdb-proxy', {
            body: { endpoint, params },
        });

        if (error) {
            // This handles errors from the Edge Function itself (e.g., network issues, Deno errors)
            throw new Error(`Edge Function invocation failed: ${error.message}`);
        }

        if (data.error) {
            // This handles errors our Edge Function code caught (e.g., secret key missing)
            throw new Error(`Error from Edge Function: ${data.error}`);
        }

        // The Edge Function forwards TMDB's status, so we check for non-200 responses here
        // The data object might contain TMDB's error message, like { status_message: 'Invalid API key' }
        if (data.status_message) {
            throw new Error(data.status_message);
        }

        return data;
    } catch (error) {
        console.error(`Error calling TMDB via proxy (${endpoint}):`, error);
        throw new Error(`TMDB API Error: ${error.message || 'Unknown error'}`);
    }
}
// END CHUNK: TMDB API Wrapper

// START CHUNK: TMDB Media Search
// Cache configuration
const tmdbSearchCache = new Map();
const MAX_CACHE_SIZE = 50;

async function fetchMovieInfoFromTmdb(query, searchYear) {
    if (!query) return;

    const tmdbResultsEl = document.getElementById('tmdbSearchResults');
    const spinnerEl = document.getElementById('liveSearchStatus'); // Get the spinner element

    if (tmdbResultsEl) {
        tmdbResultsEl.style.display = 'block';
    }

    // 1. Generate Key
    const normalizedQuery = query.trim().toLowerCase();
    const cacheKey = `${normalizedQuery}_${searchYear || 'all'}`;

    // 2. Check Cache
    if (tmdbSearchCache.has(cacheKey)) {
        console.log(`[Cache Hit] Serving results for: "${normalizedQuery}"`);
        // IMPORTANT: Do NOT show spinner here. Immediate render.
        if (spinnerEl) spinnerEl.style.display = 'none'; // Ensure it's hidden
        const cachedResults = tmdbSearchCache.get(cacheKey);
        displayTmdbResults(cachedResults);
        return;
    }

    // 3. Cache Miss - Network Request
    console.log(`[API Call] Fetching live results for: "${normalizedQuery}"`);

    // ONLY show spinner now that we know we are making a request
    if (spinnerEl) spinnerEl.style.display = 'inline-block';

    let results = [];

    try {
        // Detect and Handle TMDB ID Search ---
        const idMatch = query.match(/^(?:id:|tmdb:)?(\d{1,10})$/i);
        if (idMatch) {
            const tmdbId = idMatch[1];
            console.log(`[ID Search] Attempting direct fetch for TMDB ID: ${tmdbId}`);

            // Try fetching as both movie and tv since we don't know the type
            const [movieRes, tvRes] = await Promise.allSettled([
                callTmdbApiDirect(`/movie/${tmdbId}`),
                callTmdbApiDirect(`/tv/${tmdbId}`)
            ]);

            let idResults = [];
            if (movieRes.status === 'fulfilled' && movieRes.value && !movieRes.value.status_message) {
                movieRes.value.media_type = 'movie';
                idResults.push(movieRes.value);
            }
            if (tvRes.status === 'fulfilled' && tvRes.value && !tvRes.value.status_message) {
                tvRes.value.media_type = 'tv';
                idResults.push(tvRes.value);
            }

            if (idResults.length > 0) {
                results = idResults;
                // Cache and display immediately
                tmdbSearchCache.set(cacheKey, results);
                displayTmdbResults(results);
                return;
            }
            // If ID search yielded nothing, fall back to normal search (it might be a title like "1917")
            console.log(`[ID Search] No direct match for ${tmdbId}, falling back to text search.`);
        }
        // --- END ID Search Logic ---

        if (searchYear) {
            // FIX: Use specific search endpoints when year is provided for much better accuracy
            // search/multi does NOT officially support year parameters
            const [movieData, tvData] = await Promise.all([
                callTmdbApiDirect('/search/movie', { query, primary_release_year: searchYear }),
                callTmdbApiDirect('/search/tv', { query, first_air_date_year: searchYear })
            ].map(p => p.catch(e => ({ results: [] })))); // Graceful failure for one type

            const movieResults = (movieData.results || []).map(r => ({ ...r, media_type: 'movie' }));
            const tvResults = (tvData.results || []).map(r => ({ ...r, media_type: 'tv' }));

            results = [...movieResults, ...tvResults];
            // Sort combined results by popularity
            results.sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
        } else {
            // Standard multi-search when no year is provided
            const multiData = await callTmdbApiDirect('/search/multi', { query });
            results = multiData.results || [];
        }

        // 4. Save to Cache
        if (tmdbSearchCache.size >= MAX_CACHE_SIZE) {
            const oldestKey = tmdbSearchCache.keys().next().value;
            tmdbSearchCache.delete(oldestKey);
        }
        tmdbSearchCache.set(cacheKey, results);

        displayTmdbResults(results);

    } catch (error) {
        console.error("Error fetching from TMDB (proxy search):", error);
        if (tmdbResultsEl) tmdbResultsEl.innerHTML = `<div class="list-group-item text-danger small">Search Error: ${escapeHTML(error.message)}</div>`;
    } finally {
        // Hide spinner after API call completes
        if (spinnerEl) spinnerEl.style.display = 'none';
    }
}
// END CHUNK: TMDB Media Search

function displayTmdbResults(results) {
    const tmdbResultsDiv = document.getElementById('tmdbSearchResults');
    if (!tmdbResultsDiv) return;
    tmdbResultsDiv.innerHTML = '';

    const filteredResults = results.filter(item =>
        (item.media_type === 'movie' || item.media_type === 'tv') && (item.title || item.name)
    );

    if (filteredResults.length === 0) {
        tmdbResultsDiv.innerHTML = '<div class="list-group-item text-muted">No relevant results found. Try refining your search or year.</div>';
        tmdbResultsDiv.style.display = 'block';
        return;
    }

    filteredResults.slice(0, 10).forEach(item => {
        const title = item.title || item.name;
        const releaseDate = item.release_date || item.first_air_date;
        const year = releaseDate ? new Date(releaseDate).getFullYear() : 'N/A';
        const posterPath = item.poster_path ? `${TMDB_IMAGE_BASE_URL}w92${item.poster_path}` : 'https://via.placeholder.com/40x60?text=N/A';
        const overview = item.overview ? (item.overview.substring(0, 100) + (item.overview.length > 100 ? '...' : '')) : 'No overview.';

        const resultItem = document.createElement('div');
        resultItem.className = 'list-group-item list-group-item-action search-results-item d-flex align-items-start p-2';
        resultItem.innerHTML = `
            <img src="${escapeHTML(posterPath)}" class="tmdb-poster-thumb mr-2" alt="Poster for ${escapeHTML(title)}" style="width:50px; height:auto;">
            <div class="flex-grow-1">
                ${item.media_type === 'tv' ? '<i class="fas fa-tv text-info mr-1" title="TV Series" aria-hidden="true"></i>' : '<i class="fas fa-film text-warning mr-1" title="Movie" aria-hidden="true"></i>'}
                <strong>${escapeHTML(title)}</strong> <span class="text-muted">(${escapeHTML(year)})</span>
                <p class="mb-0 mt-1 text-muted small">${escapeHTML(overview)}</p>
            </div>`;
        resultItem.addEventListener('click', () => {
            applyTmdbSelection(item);
            tmdbResultsDiv.innerHTML = '';
            tmdbResultsDiv.style.display = 'none';
        });
        tmdbResultsDiv.appendChild(resultItem);
    });
    tmdbResultsDiv.style.display = 'block';
}
// END CHUNK: Display TMDB Search Results

// START CHUNK: Apply TMDB Selection to Form
async function fetchAndProcessTmdbDetails(mediaType, id) {
    let tmdbGenres = [], tmdbCountryISO = '', tmdbLanguage = '', tmdbKeywords = [];
    let tmdbPosterPath = '';
    let tmdbCast = [], tmdbDirector = null, tmdbProductionCompanies = [];
    let tmdbVoteAverage = null, tmdbVoteCount = null, tmdbRuntime = null;
    let tmdbCollectionId = null, tmdbCollectionName = null;
    let tmdbCollectionTotalParts = null;
    let detailData = {};

    detailData = await callTmdbApiDirect(`/${mediaType}/${id}`, { append_to_response: 'keywords,credits,collection,external_ids' });

    if (detailData) {
        if (detailData.genres) tmdbGenres = detailData.genres.map(g => g.name);
        if (detailData.production_countries && detailData.production_countries.length > 0) {
            tmdbCountryISO = detailData.production_countries[0].iso_3166_1 || '';
        } else if (detailData.origin_country && detailData.origin_country.length > 0) {
            tmdbCountryISO = detailData.origin_country[0] || '';
        }

        if (detailData.original_language) {
            const langObj = (detailData.spoken_languages || []).find(l => l.iso_639_1 === detailData.original_language);
            tmdbLanguage = langObj ? (langObj.english_name || langObj.name || detailData.original_language.toUpperCase()) : detailData.original_language.toUpperCase();
        } else if (detailData.spoken_languages && detailData.spoken_languages.length > 0) {
            tmdbLanguage = detailData.spoken_languages[0].english_name || detailData.spoken_languages[0].name;
        }

        if (detailData.keywords) {
            const keywordsData = detailData.keywords.keywords || detailData.keywords.results || [];
            tmdbKeywords = keywordsData.map(k => ({ id: k.id, name: k.name }));
        }

        if (detailData.poster_path) tmdbPosterPath = `${TMDB_IMAGE_BASE_URL}w500${detailData.poster_path}`;

        if (detailData.credits) {
            if (detailData.credits.cast) tmdbCast = detailData.credits.cast.slice(0, 15).map(c => ({ id: c.id, name: c.name, character: c.character, profile_path: c.profile_path, order: c.order }));
            if (detailData.credits.crew) {
                const directorObj = detailData.credits.crew.find(c => c.job === 'Director');
                if (directorObj) tmdbDirector = { id: directorObj.id, name: directorObj.name, profile_path: directorObj.profile_path, job: directorObj.job };
            }
        }

        if (mediaType === 'tv' && (!tmdbDirector || !tmdbDirector.name)) {
            if (Array.isArray(detailData.created_by) && detailData.created_by.length > 0) {
                const creator = detailData.created_by[0];
                tmdbDirector = { id: creator.id, name: creator.name, profile_path: creator.profile_path || null, job: 'Creator' };
            }
        }

        if (detailData.production_companies) tmdbProductionCompanies = detailData.production_companies.map(pc => ({ id: pc.id, name: pc.name, logo_path: pc.logo_path, origin_country: pc.origin_country }));

        tmdbVoteAverage = detailData.vote_average || null;
        tmdbVoteCount = detailData.vote_count || null;

        if (mediaType === 'movie') {
            tmdbRuntime = detailData.runtime || null;
        } else if (mediaType === 'tv') {
            const numSeasons = detailData.number_of_seasons || 0;

            // Build a summary map from the top-level seasons array as a baseline
            const summaryCountMap = {};
            if (Array.isArray(detailData.seasons)) {
                detailData.seasons
                    .filter(s => s.season_number > 0)
                    .forEach(s => { summaryCountMap[s.season_number] = s.episode_count || 0; });
            }

            let epPerSeason = [];

            // For shows with a manageable number of seasons, fetch each season individually
            // via append_to_response to get the real episode list (accurate count).
            // TMDB supports up to ~20 appended resources per request.
            if (numSeasons > 0 && numSeasons <= 20) {
                try {
                    const appendStr = Array.from({ length: numSeasons }, (_, i) => `season/${i + 1}`).join(',');
                    const seasonDetailData = await callTmdbApiDirect(`/tv/${id}`, { append_to_response: appendStr });
                    for (let i = 1; i <= numSeasons; i++) {
                        const seasonKey = `season/${i}`;
                        const seasonObj = seasonDetailData && seasonDetailData[seasonKey];
                        if (seasonObj && Array.isArray(seasonObj.episodes) && seasonObj.episodes.length > 0) {
                            epPerSeason.push(seasonObj.episodes.length);
                        } else {
                            // Fall back to summary count for this season
                            epPerSeason.push(summaryCountMap[i] || 0);
                        }
                    }
                } catch (seasonFetchError) {
                    console.warn('Could not fetch detailed season data, falling back to summary counts:', seasonFetchError.message);
                    // Fall back to summary counts
                    epPerSeason = Array.from({ length: numSeasons }, (_, i) => summaryCountMap[i + 1] || 0);
                }
            } else if (numSeasons > 20) {
                // Too many seasons to use append_to_response; use summary counts
                epPerSeason = Array.from({ length: numSeasons }, (_, i) => summaryCountMap[i + 1] || 0);
            } else if (Object.keys(summaryCountMap).length > 0) {
                // number_of_seasons was 0/null but seasons array had data — use that
                epPerSeason = Object.keys(summaryCountMap)
                    .map(Number).sort((a, b) => a - b)
                    .map(n => summaryCountMap[n]);
            }

            tmdbRuntime = {
                seasons: numSeasons || epPerSeason.length || null,
                episodes: detailData.number_of_episodes || epPerSeason.reduce((a, b) => a + b, 0) || null,
                episodes_per_season: epPerSeason,
                episode_run_time: detailData.episode_run_time && detailData.episode_run_time.length > 0 ? detailData.episode_run_time[0] : null,
                series_status: detailData.status || null
            };
        }

        if (detailData.belongs_to_collection) {
            tmdbCollectionId = detailData.belongs_to_collection.id;
            tmdbCollectionName = detailData.belongs_to_collection.name;
            try {
                const collectionDetails = await callTmdbApiDirect(`/collection/${tmdbCollectionId}`);
                if (collectionDetails && collectionDetails.parts) {
                    tmdbCollectionTotalParts = collectionDetails.parts.length;
                }
            } catch (collectionError) {
                console.warn(`Could not fetch details for collection ID ${tmdbCollectionId}:`, collectionError.message);
            }
        }
    }

    // Auto-Category Logic:
    // 1. If genre ID 99 or 'Documentary' is present on either movie or tv, classify as Documentary (structured TMDB genre)
    const hasDocGenre = (detailData.genres || []).some(g => g.id === 99 || (g.name && g.name.toLowerCase() === 'documentary')) ||
                        (tmdbGenres || []).some(g => typeof g === 'string' && g.toLowerCase() === 'documentary');

    // 2. Structured Special Check:
    // Only auto-classify as Special if a TV show structurally has NO regular seasons and only Season 0 ("Specials").
    // We intentionally avoid title string matching or loose keyword guessing to prevent false positives (e.g., "Midnight Special").
    // Users can cleanly select "Special" via the dropdown, which saves to user_library.custom_category.
    const hasOnlySeason0 = mediaType === 'tv' && Array.isArray(detailData.seasons) && detailData.seasons.length > 0 &&
        detailData.seasons.every(s => s.season_number === 0 || (s.name && s.name.toLowerCase().includes('special')));

    let detectedCategory = mediaType === 'tv' ? 'Series' : 'Movie';
    if (hasDocGenre) {
        detectedCategory = 'Documentary';
    } else if (hasOnlySeason0) {
        detectedCategory = 'Special';
    }

    const releaseDate = detailData.release_date || detailData.first_air_date || '';
    const year = releaseDate ? new Date(releaseDate).getFullYear().toString() : '';

    return {
        Name: detailData.title || detailData.name || '',
        Category: detectedCategory,
        Genre: tmdbGenres.join(', '),
        genres: tmdbGenres,
        Language: tmdbLanguage,
        Year: year,
        Country: tmdbCountryISO,
        Description: detailData.overview || '',
        "Poster URL": tmdbPosterPath,
        poster_url: tmdbPosterPath,
        keywords: tmdbKeywords,
        full_cast: tmdbCast,
        director_info: tmdbDirector,
        production_companies: tmdbProductionCompanies,
        tmdb_vote_average: tmdbVoteAverage,
        tmdb_vote_count: tmdbVoteCount,
        runtime: tmdbRuntime,
        tmdb_collection_id: tmdbCollectionId,
        tmdb_collection_name: tmdbCollectionName,
        tmdb_collection_total_parts: tmdbCollectionTotalParts,
        imdb_id: detailData.external_ids?.imdb_id || null,
        tmdb_release_date: releaseDate || null,
        episodesPerSeason: mediaType === 'tv' && typeof tmdbRuntime === 'object' && tmdbRuntime ? (tmdbRuntime.episodes_per_season || []) : [],
        episodes_per_season: mediaType === 'tv' && typeof tmdbRuntime === 'object' && tmdbRuntime ? (tmdbRuntime.episodes_per_season || []) : [],
        seriesStatus: detailData.status || null,
        series_status: detailData.status || null
    };
}

// START CHUNK: Supabase Catalog-First Flow
function catalogRowToProcessedFormat(entry) {
    const hasSeasons = entry.category === 'Series' || (Array.isArray(entry.seasons) && entry.seasons.length > 0);
    let runtimeVal = null;
    let epPerSeason = [];

    if (hasSeasons) {
        const seasons = Array.isArray(entry.seasons) ? entry.seasons : [];
        seasons.sort((a, b) => (a.season_number || 0) - (b.season_number || 0));
        epPerSeason = seasons.map(s => s.episode_count || 0);

        const totalEpisodes = epPerSeason.reduce((a, b) => a + b, 0);
        runtimeVal = {
            seasons: seasons.length || null,
            episodes: totalEpisodes || null,
            episodes_per_season: epPerSeason,
            episode_run_time: entry.runtime_minutes || null,
            series_status: entry.series_status || null
        };
    } else {
        runtimeVal = entry.runtime_minutes != null ? entry.runtime_minutes : null;
    }

    const defaultGenres = Array.isArray(entry.default_genres) ? entry.default_genres : [];

    return {
        Name: entry.default_name || '',
        Category: entry.category || (hasSeasons ? 'Series' : 'Movie'),
        Genre: defaultGenres.join(', '),
        genres: defaultGenres,
        Language: entry.language || '',
        Year: entry.year ? String(entry.year) : (entry.release_date ? new Date(entry.release_date).getFullYear().toString() : ''),
        Country: entry.country || '',
        Description: entry.default_description || '',
        "Poster URL": entry.default_poster_url || '',
        poster_url: entry.default_poster_url || '',
        keywords: Array.isArray(entry.keywords) ? entry.keywords : [],
        full_cast: Array.isArray(entry.full_cast) ? entry.full_cast : [],
        director_info: entry.director_info || null,
        production_companies: Array.isArray(entry.production_companies) ? entry.production_companies : [],
        tmdb_vote_average: entry.vote_average != null ? Number(entry.vote_average) : null,
        tmdb_vote_count: entry.vote_count != null ? Number(entry.vote_count) : null,
        runtime: runtimeVal,
        tmdb_collection_id: entry.collection_id || null,
        tmdb_collection_name: entry.collection_name || null,
        tmdb_collection_total_parts: entry.collection_total_parts || null,
        imdb_id: entry.imdb_id || null,
        tmdb_release_date: entry.release_date || null,
        episodesPerSeason: epPerSeason,
        episodes_per_season: epPerSeason,
        seriesStatus: entry.series_status || null,
        series_status: entry.series_status || null
    };
}

async function cacheTmdbToSupabaseCatalog(tmdbData, tmdbId, category) {
    if (!window.supabaseClient || typeof window.supabaseClient.rpc !== 'function') {
        return null;
    }

    try {
        const isSeriesLike = category === 'Series' || (tmdbData && Array.isArray(tmdbData.episodesPerSeason) && tmdbData.episodesPerSeason.length > 0) || (tmdbData && typeof tmdbData.runtime === 'object' && Array.isArray(tmdbData.runtime?.episodes_per_season) && tmdbData.runtime.episodes_per_season.length > 0);
        const episodesPerSeason = isSeriesLike && Array.isArray(tmdbData.episodesPerSeason)
            ? tmdbData.episodesPerSeason
            : (isSeriesLike && typeof tmdbData.runtime === 'object' && Array.isArray(tmdbData.runtime?.episodes_per_season)
                ? tmdbData.runtime.episodes_per_season
                : []);

        const seasonsPayload = episodesPerSeason.map((count, idx) => ({
            season_number: idx + 1,
            episode_count: count
        }));

        let runtimeMinutes = null;
        if (typeof tmdbData.runtime === 'number') {
            runtimeMinutes = tmdbData.runtime;
        } else if (typeof tmdbData.runtime === 'object' && tmdbData.runtime) {
            runtimeMinutes = tmdbData.runtime.episode_run_time || null;
        }

        const payload = {
            tmdb_id: tmdbId,
            category: category,
            default_name: tmdbData.Name,
            release_date: tmdbData.tmdb_release_date || null,
            year: tmdbData.Year ? parseInt(tmdbData.Year, 10) : null,
            country: tmdbData.Country || null,
            language: tmdbData.Language || null,
            default_description: tmdbData.Description || null,
            default_poster_url: tmdbData.poster_url || tmdbData["Poster URL"] || null,
            runtime_minutes: runtimeMinutes,
            series_status: tmdbData.seriesStatus || tmdbData.series_status || null,
            vote_average: tmdbData.tmdb_vote_average || null,
            vote_count: tmdbData.tmdb_vote_count || null,
            collection_id: tmdbData.tmdb_collection_id || null,
            collection_name: tmdbData.tmdb_collection_name || null,
            collection_total_parts: tmdbData.tmdb_collection_total_parts || null,
            director_info: tmdbData.director_info || null,
            full_cast: tmdbData.full_cast || [],
            production_companies: tmdbData.production_companies || [],
            keywords: tmdbData.keywords || [],
            default_genres: tmdbData.genres || (tmdbData.Genre ? tmdbData.Genre.split(',').map(s => s.trim()).filter(Boolean) : []),
            imdb_id: tmdbData.imdb_id || null,
            seasons: seasonsPayload
        };

        const { data, error } = await window.supabaseClient.rpc('save_media_catalog_entry', { payload });
        if (error) {
            console.warn('[Catalog Cache] RPC save_media_catalog_entry error:', error.message);
            return null;
        }
        if (data && data.success && data.catalog_entry) {
            return data.catalog_entry;
        }
    } catch (e) {
        console.warn('[Catalog Cache] Failed to cache TMDB entry into Supabase:', e);
    }
    return null;
}

async function fetchMediaDetailsCatalogFirst(mediaType, tmdbId) {
    const isTv = mediaType === 'tv';
    const numId = parseInt(tmdbId, 10);
    const candidateCategories = isTv ? ['Series', 'Documentary'] : ['Movie', 'Documentary', 'Special'];

    // 1. Query Supabase media_catalog first
    let catalogEntry = null;
    if (window.supabaseClient) {
        try {
            const { data, error } = await window.supabaseClient
                .from('media_catalog')
                .select(`
                    *,
                    collections (name, total_parts),
                    series_seasons (season_number, episode_count)
                `)
                .eq('tmdb_id', numId)
                .in('category', candidateCategories)
                .maybeSingle();

            if (!error && data) {
                catalogEntry = {
                    ...data,
                    collection_name: data.collections?.name || null,
                    collection_total_parts: data.collections?.total_parts || null,
                    seasons: data.series_seasons || []
                };
            }
        } catch (fetchErr) {
            console.warn('[Catalog] Error querying media_catalog:', fetchErr);
        }
    }

    // Branch 1: Movie (or Movie-based Documentary/Special)
    if (!isTv) {
        if (catalogEntry) {
            console.log(`[Catalog Hit] ${catalogEntry.category} tmdb_id=${numId} loaded directly from Supabase (0 TMDB calls)`);
            return catalogRowToProcessedFormat(catalogEntry);
        }
        // Not in Supabase -> Fetch from TMDB proxy -> Save in Supabase -> Return from catalog
        console.log(`[Catalog Miss] Movie tmdb_id=${numId} fetching from TMDB proxy...`);
        const tmdbData = await fetchAndProcessTmdbDetails('movie', numId);
        const targetCategory = tmdbData.Category || 'Movie';
        const savedCatalog = await cacheTmdbToSupabaseCatalog(tmdbData, numId, targetCategory);
        return savedCatalog ? catalogRowToProcessedFormat(savedCatalog) : tmdbData;
    }

    // Branch 2: Series (or TV-based Docuseries)
    if (catalogEntry) {
        const rawStatus = (catalogEntry.series_status || '').toLowerCase().trim();
        const isCompleted = rawStatus === 'ended' || rawStatus === 'canceled';

        if (isCompleted) {
            console.log(`[Catalog Hit] Series tmdb_id=${numId} is completed (${catalogEntry.series_status}). Loaded directly from Supabase (0 TMDB calls)`);
            return catalogRowToProcessedFormat(catalogEntry);
        }

        // Series is Ongoing -> Fetch latest details from TMDB proxy, but ONLY update catalog if episodes/seasons or status changed
        console.log(`[Catalog Check] Series tmdb_id=${numId} is ongoing (${catalogEntry.series_status}). Checking for new seasons/episodes...`);
        try {
            const tmdbData = await fetchAndProcessTmdbDetails('tv', numId);
            
            // Compare catalog seasons with freshly fetched TMDB seasons
            const catalogSeasonCounts = (catalogEntry.seasons || [])
                .slice()
                .sort((a, b) => a.season_number - b.season_number)
                .map(s => s.episode_count);

            const tmdbSeasonCounts = Array.isArray(tmdbData.episodesPerSeason) ? tmdbData.episodesPerSeason : [];
            const hasNewSeasonsOrEpisodes = 
                tmdbSeasonCounts.length !== catalogSeasonCounts.length ||
                tmdbSeasonCounts.some((count, i) => count !== catalogSeasonCounts[i]);

            const hasStatusChanged = (tmdbData.seriesStatus || '').toLowerCase().trim() !== (catalogEntry.series_status || '').toLowerCase().trim();

            if (!hasNewSeasonsOrEpisodes && !hasStatusChanged) {
                console.log(`[Catalog Up-to-date] Series tmdb_id=${numId} has no new episodes/seasons. Skipping database catalog write.`);
                return catalogRowToProcessedFormat(catalogEntry);
            }

            console.log(`[Catalog Update Needed] Series tmdb_id=${numId} has changes (New seasons/episodes: ${hasNewSeasonsOrEpisodes}, Status change: ${hasStatusChanged}). Updating media_catalog...`);
            const targetCategory = tmdbData.Category || 'Series';
            const updatedCatalog = await cacheTmdbToSupabaseCatalog(tmdbData, numId, targetCategory);
            return updatedCatalog ? catalogRowToProcessedFormat(updatedCatalog) : tmdbData;
        } catch (err) {
            console.warn('[Catalog] Ongoing series refresh failed, falling back to cached catalog:', err);
            return catalogRowToProcessedFormat(catalogEntry);
        }
    }

    // Series not in Supabase -> Fetch from TMDB proxy -> Save in Supabase -> Return from catalog
    console.log(`[Catalog Miss] Series tmdb_id=${numId} fetching from TMDB proxy...`);
    const tmdbData = await fetchAndProcessTmdbDetails('tv', numId);
    const targetCategory = tmdbData.Category || 'Series';
    const savedCatalog = await cacheTmdbToSupabaseCatalog(tmdbData, numId, targetCategory);
    return savedCatalog ? catalogRowToProcessedFormat(savedCatalog) : tmdbData;
}
// END CHUNK: Supabase Catalog-First Flow

async function applyTmdbSelection(item, force = false) {
    if (!formFieldsGlob) {
        console.error("formFieldsGlob not initialized. Cannot apply TMDB selection.");
        return;
    }

    // --- NEW LOCAL DUPLICATE CHECK BEFORE FETCH ---
    if (!force && typeof movieData !== "undefined" && movieData) {
        const tmdbId = String(item.id);
        const mediaType = item.media_type;
        const title = item.title || item.name || "";
        const releaseDate = item.release_date || item.first_air_date;
        const year = releaseDate ? new Date(releaseDate).getFullYear().toString() : "";
        const category = mediaType === 'tv' ? 'Series' : 'Movie';

        const editIdInput = document.getElementById('editEntryId');
        const editId = editIdInput ? editIdInput.value : "";

        // 1. Strict TMDB ID Block
        const exactTmdbMatch = movieData.find(
            (m) =>
                m.tmdbId == tmdbId &&
                m.id !== editId &&
                !m.is_deleted &&
                m.Status !== "Unwatchable" &&
                (m.Category === category || m.tmdbMediaType === mediaType)
        );

        if (exactTmdbMatch) {
            if (typeof showToast === 'function') {
                showToast(
                    "Data Conflict",
                    `Entry "${exactTmdbMatch.Name}" already exists with this TMDB ID. Please verify using search bar.`,
                    "error",
                    6000
                );
            }
            return; // Hard block, do not fetch
        }

        // 2. Name & Year Check
        const exactNameYearMatch = movieData.find(
            (m) =>
                m.id !== editId &&
                !m.is_deleted &&
                m.Status !== "Unwatchable" &&
                m.Name && String(m.Name).toLowerCase().trim() === title.toLowerCase().trim() &&
                m.Year == year
        );

        if (exactNameYearMatch) {
            window.duplicateModalMode = "tmdb_fetch";
            window.pendingTmdbItem = item;

            const titleEl = document.getElementById("duplicateNameConfirmModalLabel");
            const bodyEl = document.querySelector("#duplicateNameConfirmModal .modal-body");
            if (titleEl) titleEl.textContent = "Local Entry Found";
            if (bodyEl) bodyEl.innerHTML = `An entry for <strong>"${escapeHTML(exactNameYearMatch.Name)}"</strong> (${escapeHTML(exactNameYearMatch.Year) || 'N/A'}) already exists in your library. Do you still want to fetch and apply this TMDB data?`;

            const confirmBtn = document.getElementById("confirmDuplicateSaveBtn");
            const cancelBtn = document.getElementById("cancelDuplicateSaveBtn");
            if (confirmBtn) confirmBtn.textContent = "Fetch Anyway";
            if (cancelBtn) cancelBtn.textContent = "Cancel";

            $("#duplicateNameConfirmModal").modal("show");
            return; // Pause execution, wait for user modal action
        }
    }
    // --- END DUPLICATE CHECK ---

    if (typeof showLoading === 'function') showLoading("Fetching details for TMDB selection...");

    try {
        const processed = await fetchMediaDetailsCatalogFirst(item.media_type, item.id);

        formFieldsGlob.name.value = processed.Name || formFieldsGlob.name.value;
        formFieldsGlob.category.value = processed.Category;
        formFieldsGlob.year.value = processed.Year;
        formFieldsGlob.country.value = processed.Country;
        formFieldsGlob.language.value = processed.Language;

        if (typeof toggleConditionalFields === 'function') {
            toggleConditionalFields();
        }

        if (processed.Category === 'Series') {
            if (formFieldsGlob.runtimeSeriesSeasons) {
                formFieldsGlob.runtimeSeriesSeasons.value = (processed.runtime && processed.runtime.seasons) || (processed.episodesPerSeason ? processed.episodesPerSeason.length : '') || '';
            }
            if (formFieldsGlob.runtimeSeriesEpisodes) {
                formFieldsGlob.runtimeSeriesEpisodes.value = (processed.runtime && processed.runtime.episodes) || '';
            }
            if (formFieldsGlob.runtimeSeriesAvgEp) {
                formFieldsGlob.runtimeSeriesAvgEp.value = (processed.runtime && processed.runtime.episode_run_time) || '';
            }
        } else {
            // Movie, Documentary, Special
            if (formFieldsGlob.runtimeMovie) {
                formFieldsGlob.runtimeMovie.value = (typeof processed.runtime === 'number' ? processed.runtime : (processed.runtime && processed.runtime.episode_run_time)) || '';
            }
        }

        // NEW: Overwrite Protection for Poster URL
        const existingPosterVal = formFieldsGlob.posterUrl.value.trim();
        if (existingPosterVal.startsWith('"') && existingPosterVal.endsWith('"')) {
            console.log("Skipping Poster URL update (Locked by User).");
        } else {
            formFieldsGlob.posterUrl.value = processed["Poster URL"];
            if (typeof window.handlePosterUrlInput === 'function') {
                window.handlePosterUrlInput(false);
            }
            formFieldsGlob.posterUrl.dataset.source = 'tmdb';
        }

        // Overwrite description cleanly with new selection
        formFieldsGlob.description.value = processed.Description || "";

        document.getElementById('tmdbId').value = item.id;
        document.getElementById('tmdbMediaType').value = item.media_type;

        // Overwrite genres with new selection (do not merge with previous title's genres)
        if (processed.genres && processed.genres.length > 0) {
            const newSelectedGenres = new Set();
            processed.genres.forEach(tmdbGenreName => {
                const matchedLocalGenre = UNIQUE_ALL_GENRES.find(localGenre => String(localGenre).toLowerCase() === String(tmdbGenreName).toLowerCase().replace(/-/g, ' '));
                if (matchedLocalGenre) {
                    newSelectedGenres.add(matchedLocalGenre);
                }
            });
            selectedGenres = Array.from(newSelectedGenres).sort();
        } else {
            selectedGenres = [];
        }
        renderGenreTags();
        populateGenreDropdown();

        const entryFormEl = document.getElementById('entryForm');
        if (entryFormEl) {
            entryFormEl._tempTmdbData = {
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
                episodesPerSeason: processed.episodesPerSeason || [],
                episodes_per_season: processed.episodes_per_season || processed.episodesPerSeason || [],
                seriesStatus: processed.seriesStatus || null,
                series_status: processed.series_status || processed.seriesStatus || null
            };
        }

        if (processed.Category === 'Series' && typeof window.renderSeasonBreakdownCards === 'function') {
            const seasonCount = (processed.runtime && typeof processed.runtime === 'object') ? (processed.runtime.seasons || (processed.episodesPerSeason ? processed.episodesPerSeason.length : 1)) : ((processed.episodesPerSeason ? processed.episodesPerSeason.length : 1));
            window.renderSeasonBreakdownCards(seasonCount, processed.episodesPerSeason || []);
        }

        if (typeof showToast === 'function') showToast("Info Applied", `${processed.Name} details pre-filled. Review and save.`, "info", 3000);
    } catch (error) {
        console.error("Error applying TMDB selection:", error);
        if (typeof showToast === 'function') {
            showToast("TMDB Detail Error", `Could not fetch detailed info: ${error.message}`, "warning");
        }
    } finally {
        if (typeof hideLoading === 'function') hideLoading();
    }
}
// END CHUNK: Apply TMDB Selection to Form

// START CHUNK: Fetch TMDB Person Details
async function fetchTmdbPersonDetails(personId) {
    if (!personId) return null;
    try {
        const data = await callTmdbApiDirect(`/person/${personId}`, { append_to_response: 'combined_credits,images' });
        return data;
    } catch (error) {
        console.error(`Error fetching TMDB person details for ID ${personId}:`, error);
        if (typeof showToast === 'function') {
            showToast("TMDB Person Error", `Could not fetch person details: ${error.message}`, "warning");
        }
        return null;
    }
}
// END CHUNK: Fetch TMDB Person Details
async function propagateCollectionDataUpdate(updatedEntry) {
    if (!updatedEntry || !updatedEntry.tmdb_collection_id || !movieData) {
        return false;
    }

    const collectionId = updatedEntry.tmdb_collection_id;
    const collectionName = updatedEntry.tmdb_collection_name;
    const collectionTotalParts = updatedEntry.tmdb_collection_total_parts;

    let changesMade = false;
    const currentTimestamp = new Date().toISOString();

    movieData.forEach(entry => {
        if (entry && entry.id !== updatedEntry.id && entry.tmdb_collection_id === collectionId) {
            let entryModified = false;

            if (entry.tmdb_collection_name !== collectionName) {
                entry.tmdb_collection_name = collectionName;
                entryModified = true;
            }
            if (entry.tmdb_collection_total_parts !== collectionTotalParts) {
                entry.tmdb_collection_total_parts = collectionTotalParts;
                entryModified = true;
            }

            if (entryModified) {
                entry.lastModifiedDate = currentTimestamp;
                changesMade = true;
            }
        }
    });

    if (changesMade) {
        console.log(`Propagated collection updates for "${collectionName}" to other entries.`);
    }

    return changesMade;
}
