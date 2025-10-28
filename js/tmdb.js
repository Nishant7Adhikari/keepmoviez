/* tmdb.js */
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
async function fetchMovieInfoFromTmdb(query, searchYear) {
    if (!query) {
        if (typeof showToast === 'function') showToast("Input Needed", "Enter movie/series name to search.", "info");
        if (typeof hideLoading === 'function') hideLoading();
        return;
    }

    const tmdbResultsEl = document.getElementById('tmdbSearchResults');
    if (tmdbResultsEl) {
        tmdbResultsEl.innerHTML = '<div class="list-group-item text-muted"><i>Searching TMDB...</i></div>';
        tmdbResultsEl.style.display = 'block';
    }

    let results = [];

    try {
        const searchParams = { query };
        if (searchYear) {
            searchParams.query = `${query} ${searchYear}`;
        }
        
        const multiData = await callTmdbApiDirect('/search/multi', searchParams);
        results = multiData.results || [];
        
        displayTmdbResults(results);

    } catch (error) {
        console.error("Error fetching from TMDB (proxy search):", error);
        if (tmdbResultsEl) tmdbResultsEl.innerHTML = `<div class="list-group-item text-danger">Search Error: ${error.message}</div>`;
        if (typeof showToast === 'function') showToast("TMDB Search Error", `Failed: ${error.message}`, "error");
    } finally {
        if (typeof hideLoading === 'function') hideLoading();
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
            <img src="${posterPath}" class="tmdb-poster-thumb mr-2" alt="Poster for ${title}" style="width:50px; height:auto;">
            <div class="flex-grow-1">
                ${item.media_type === 'tv' ? '<i class="fas fa-tv text-info mr-1" title="TV Series"></i>' : '<i class="fas fa-film text-warning mr-1" title="Movie"></i>'}
                <strong>${title}</strong> <span class="text-muted">(${year})</span>
                <p class="mb-0 mt-1 text-muted small">${overview}</p>
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
async function applyTmdbSelection(item) {
    if (!formFieldsGlob) {
        console.error("formFieldsGlob not initialized. Cannot apply TMDB selection.");
        return;
    }
    if (typeof showLoading === 'function') showLoading("Fetching details for TMDB selection...");

    const releaseDate = item.release_date || item.first_air_date;
    const year = releaseDate ? new Date(releaseDate).getFullYear().toString() : '';

    let tmdbGenres = [], tmdbCountryISO = '', tmdbLanguage = '', tmdbKeywords = [];
    let tmdbPosterPath = item.poster_path ? `${TMDB_IMAGE_BASE_URL}w500${item.poster_path}` : '';
    let tmdbCast = [], tmdbDirector = null, tmdbProductionCompanies = [];
    let tmdbVoteAverage = null, tmdbVoteCount = null, tmdbRuntime = null;
    let tmdbCollectionId = null, tmdbCollectionName = null;
    let tmdbCollectionTotalParts = null; 
    let detailData = {};

    try {
        detailData = await callTmdbApiDirect(`/${item.media_type}/${item.id}`, { append_to_response: 'keywords,credits,collection,external_ids' });

        if (detailData.genres) tmdbGenres = detailData.genres.map(g => g.name);
        if (detailData.production_countries && detailData.production_countries.length > 0) tmdbCountryISO = detailData.production_countries[0].iso_3166_1 || '';
        else if (detailData.origin_country && detailData.origin_country.length > 0) tmdbCountryISO = detailData.origin_country[0] || '';
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

        if (detailData.production_companies) tmdbProductionCompanies = detailData.production_companies.map(pc => ({ id: pc.id, name: pc.name, logo_path: pc.logo_path, origin_country: pc.origin_country }));

        tmdbVoteAverage = item.vote_average || detailData.vote_average || null;
        tmdbVoteCount = item.vote_count || detailData.vote_count || null;

        if (item.media_type === 'movie') {
            tmdbRuntime = detailData.runtime || null;
        } else if (item.media_type === 'tv') {
            tmdbRuntime = {
                seasons: detailData.number_of_seasons || null,
                episodes: detailData.number_of_episodes || null,
                episode_run_time: detailData.episode_run_time && detailData.episode_run_time.length > 0 ? detailData.episode_run_time[0] : null
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

    } catch (error) {
        console.error("Error fetching TMDB item details (proxy):", error);
        if (typeof showToast === 'function') {
            showToast("TMDB Detail Error", `Could not fetch detailed info: ${error.message}`, "warning");
        }
    }

    formFieldsGlob.name.value = item.title || item.name || formFieldsGlob.name.value;
    formFieldsGlob.category.value = item.media_type === 'movie' ? 'Movie' : (item.media_type === 'tv' ? 'Series' : 'Special');
    formFieldsGlob.year.value = year;
    formFieldsGlob.country.value = tmdbCountryISO;
    formFieldsGlob.language.value = tmdbLanguage;
    formFieldsGlob.posterUrl.value = tmdbPosterPath;
    if (item.overview) formFieldsGlob.description.value = item.overview;

    document.getElementById('tmdbId').value = item.id;
    document.getElementById('tmdbMediaType').value = item.media_type;

    if (tmdbGenres.length > 0) {
        const currentSelectedGenres = new Set(selectedGenres);
        tmdbGenres.forEach(tmdbGenreName => {
            const matchedLocalGenre = UNIQUE_ALL_GENRES.find(localGenre => String(localGenre).toLowerCase() === String(tmdbGenreName).toLowerCase().replace(/-/g, ' '));
            if (matchedLocalGenre) {
                currentSelectedGenres.add(matchedLocalGenre);
            }
        });
        selectedGenres = Array.from(currentSelectedGenres).sort();
        renderGenreTags();
        populateGenreDropdown();
    }

    const entryFormEl = document.getElementById('entryForm');
    if (entryFormEl) {
        entryFormEl._tempTmdbData = {
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
            imdb_id: detailData.external_ids?.imdb_id || null
        };
    }
    if (typeof showToast === 'function') showToast("Info Applied", `${item.title || item.name} details pre-filled. Review and save.`, "info", 3000);
    if (typeof hideLoading === 'function') hideLoading();
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
