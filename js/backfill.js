/* backfill.js - TMDB Data Backfill Console Utility */

/**
 * Comprehensive TMDB Data Backfill CLI
 * Backfill ANY TMDB data field for entries with valid TMDB IDs
 * Supports 10+ data fields: rating, cast, director, collection, companies, keywords, runtime, release_date, imdb_id, vote_count
 */

const MIN_RETRY_DELAY = 25;      // Minimum delay between API requests (TMDB allows 50 calls/sec = 20ms, so 100ms is safe)
const DEFAULT_RETRY_DELAY = 25;  // Default delay (safer for multiple users/concurrent requests)

async function backfillTmdbData(options = {}) {
    const { columns = ['rating', 'cast', 'director', 'collection', 'companies'], dryRun = false, verbose = true, retryDelay = DEFAULT_RETRY_DELAY, maxResults = 500 } = options;
    const safeRetryDelay = Math.max(retryDelay, MIN_RETRY_DELAY);
    if (retryDelay !== safeRetryDelay && retryDelay > 0) console.warn(`⚠️  retryDelay cannot be less than ${MIN_RETRY_DELAY}ms. Using ${safeRetryDelay}ms`);
    if (!Array.isArray(movieData)) { console.error('❌ movieData not available'); return { total: 0, successful: 0, skipped: 0, failed: 0, updated: [], errors: [] }; }
    if (!window.callTmdbApiDirect) { console.error('❌ TMDB API not available'); return { total: 0, successful: 0, skipped: 0, failed: 0, updated: [], errors: [] }; }
    const backfillColumns = parseColumnInput(columns);
    if (backfillColumns.length === 0) { console.error('❌ No valid columns. Use: category, genre, language, year, country, description, poster_url, related_entries, tmdb_id, rating, vote_count, cast, director, collection, companies, keywords, runtime, release_date, imdb_id'); return { total: 0, successful: 0, skipped: 0, failed: 0, updated: [], errors: [] }; }
    const entriesToBackfill = movieData.filter(entry => entry.tmdbId && (
        (backfillColumns.includes('category') && !entry.category) ||
        (backfillColumns.includes('genre') && (!entry.genre || entry.genre.length === 0)) ||
        (backfillColumns.includes('language') && !entry.language) ||
        (backfillColumns.includes('year') && !entry.year) ||
        (backfillColumns.includes('country') && (!entry.country || entry.country.length === 0)) ||
        (backfillColumns.includes('description') && !entry.description) ||
        (backfillColumns.includes('poster_url') && !entry.poster_url) ||
        (backfillColumns.includes('related_entries') && (!entry.related_entries || entry.related_entries.length === 0)) ||
        (backfillColumns.includes('rating') && !entry.tmdb_vote_average) ||
        (backfillColumns.includes('cast') && (!entry.full_cast || entry.full_cast.length === 0)) ||
        (backfillColumns.includes('director') && !entry.director_info) ||
        (backfillColumns.includes('collection') && !entry.tmdb_collection_id) ||
        (backfillColumns.includes('companies') && (!entry.production_companies || entry.production_companies.length === 0)) ||
        (backfillColumns.includes('keywords') && (!entry.keywords || entry.keywords.length === 0)) ||
        (backfillColumns.includes('runtime') && !entry.runtime) ||
        (backfillColumns.includes('release_date') && !entry.tmdb_release_date) ||
        (backfillColumns.includes('imdb_id') && !entry.imdb_id) ||
        (backfillColumns.includes('vote_count') && !entry.tmdb_vote_count)
    )).slice(0, maxResults);
    if (entriesToBackfill.length === 0) { console.log('✅ No entries need backfilling'); return { total: 0, successful: 0, skipped: 0, failed: 0, updated: [], errors: [] }; }
    console.log(`\n${'═'.repeat(80)}\n🚀 TMDB DATA BACKFILL -  MODE\n${'═'.repeat(80)}\n📊 Entries: ${entriesToBackfill.length}/${movieData.length}\n📋 Columns: ${backfillColumns.join(', ')}\n⏱️  Delay: ${safeRetryDelay}ms\n🏃 Dry run: ${dryRun ? 'YES' : 'NO'}\n${'═'.repeat(80)}\n`);
    const results = { total: entriesToBackfill.length, successful: 0, skipped: 0, failed: 0, updated: [], errors: [] };
    for (let i = 0; i < entriesToBackfill.length; i++) {
        const entry = entriesToBackfill[i];
        try {
            if (i > 0) await new Promise(resolve => setTimeout(resolve, safeRetryDelay));
            if (verbose) console.log(`[${(i+1).toString().padStart(3)}/${entriesToBackfill.length}] Fetching: "${entry.Name}" (TMDB: ${entry.tmdbId})`);
            const mediaType = entry.tmdbMediaType || (entry.Category === 'Series' ? 'tv' : 'movie');
            const detailData = await callTmdbApiDirect(`/${mediaType}/${entry.tmdbId}`, { append_to_response: 'credits,keywords,collection,external_ids' });
            if (!detailData) { results.skipped++; if (verbose) console.log(`  ⚠️  No data`); continue; }
            const tmdbData = extractTmdbData(detailData, mediaType, backfillColumns);
            if (!dryRun) {
                const entryIndex = movieData.findIndex(m => m.id === entry.id);
                if (entryIndex !== -1) {
                    const currentTimestamp = new Date().toISOString();
                    const changedFields = [];
                    // Fields that ALWAYS REPLACE existing data
                    const replaceFields = ['poster_url', 'related_entries', 'tmdb_vote_count', 'tmdb_vote_average', 'tmdb_collection_total_parts'];
                    // Fields that ONLY FILL IF MISSING
                    if (backfillColumns.includes('rating') && tmdbData.vote_average !== null) {
                        if (replaceFields.includes('tmdb_vote_average') || !movieData[entryIndex].tmdb_vote_average) {
                            movieData[entryIndex].tmdb_vote_average = tmdbData.vote_average;
                            changedFields.push('rating');
                        }
                    }
                    if (backfillColumns.includes('vote_count') && tmdbData.vote_count !== null) {
                        if (replaceFields.includes('tmdb_vote_count') || !movieData[entryIndex].tmdb_vote_count) {
                            movieData[entryIndex].tmdb_vote_count = tmdbData.vote_count;
                            changedFields.push('vote_count');
                        }
                    }
                    if (backfillColumns.includes('cast') && tmdbData.full_cast.length > 0 && (!movieData[entryIndex].full_cast || movieData[entryIndex].full_cast.length === 0)) {
                        movieData[entryIndex].full_cast = tmdbData.full_cast;
                        changedFields.push('cast');
                    }
                    if (backfillColumns.includes('director') && tmdbData.director_info && !movieData[entryIndex].director_info) {
                        movieData[entryIndex].director_info = tmdbData.director_info;
                        changedFields.push('director');
                    }
                    if (backfillColumns.includes('collection') && tmdbData.collection_id) {
                        if (!movieData[entryIndex].tmdb_collection_id) {
                            movieData[entryIndex].tmdb_collection_id = tmdbData.collection_id;
                            movieData[entryIndex].tmdb_collection_name = tmdbData.collection_name;
                            movieData[entryIndex].tmdb_collection_total_parts = tmdbData.collection_total_parts;
                            changedFields.push('collection');
                        } else if (replaceFields.includes('tmdb_collection_total_parts')) {
                            movieData[entryIndex].tmdb_collection_total_parts = tmdbData.collection_total_parts;
                            if (!changedFields.includes('collection')) changedFields.push('collection (total_parts)');
                        }
                    }
                    if (backfillColumns.includes('companies') && tmdbData.production_companies.length > 0 && (!movieData[entryIndex].production_companies || movieData[entryIndex].production_companies.length === 0)) {
                        movieData[entryIndex].production_companies = tmdbData.production_companies;
                        changedFields.push('companies');
                    }
                    if (backfillColumns.includes('keywords') && tmdbData.keywords.length > 0 && (!movieData[entryIndex].keywords || movieData[entryIndex].keywords.length === 0)) {
                        movieData[entryIndex].keywords = tmdbData.keywords;
                        changedFields.push('keywords');
                    }
                    if (backfillColumns.includes('runtime') && tmdbData.runtime && !movieData[entryIndex].runtime) {
                        movieData[entryIndex].runtime = tmdbData.runtime;
                        changedFields.push('runtime');
                    }
                    if (backfillColumns.includes('release_date') && tmdbData.release_date && !movieData[entryIndex].tmdb_release_date) {
                        movieData[entryIndex].tmdb_release_date = tmdbData.release_date;
                        changedFields.push('release_date');
                    }
                    if (backfillColumns.includes('imdb_id') && tmdbData.imdb_id && !movieData[entryIndex].imdb_id) {
                        movieData[entryIndex].imdb_id = tmdbData.imdb_id;
                        changedFields.push('imdb_id');
                    }
                    if (backfillColumns.includes('poster_url') && tmdbData.poster_url) {
                        if (replaceFields.includes('poster_url') || !movieData[entryIndex].poster_url) {
                            movieData[entryIndex].poster_url = tmdbData.poster_url;
                            changedFields.push('poster_url');
                        }
                    }
                    if (backfillColumns.includes('related_entries') && tmdbData.related_entries.length > 0) {
                        if (replaceFields.includes('related_entries') || !movieData[entryIndex].related_entries || movieData[entryIndex].related_entries.length === 0) {
                            movieData[entryIndex].related_entries = tmdbData.related_entries;
                            changedFields.push('related_entries');
                        }
                    }
                    if (backfillColumns.includes('category') && tmdbData.category && !movieData[entryIndex].category) {
                        movieData[entryIndex].category = tmdbData.category;
                        changedFields.push('category');
                    }
                    if (backfillColumns.includes('genre') && tmdbData.genre.length > 0 && (!movieData[entryIndex].genre || movieData[entryIndex].genre.length === 0)) {
                        movieData[entryIndex].genre = tmdbData.genre;
                        changedFields.push('genre');
                    }
                    if (backfillColumns.includes('language') && tmdbData.language && !movieData[entryIndex].language) {
                        movieData[entryIndex].language = tmdbData.language;
                        changedFields.push('language');
                    }
                    if (backfillColumns.includes('year') && tmdbData.year && !movieData[entryIndex].year) {
                        movieData[entryIndex].year = tmdbData.year;
                        changedFields.push('year');
                    }
                    if (backfillColumns.includes('country') && tmdbData.country.length > 0 && (!movieData[entryIndex].country || movieData[entryIndex].country.length === 0)) {
                        movieData[entryIndex].country = tmdbData.country;
                        changedFields.push('country');
                    }
                    if (backfillColumns.includes('description') && tmdbData.description && !movieData[entryIndex].description) {
                        movieData[entryIndex].description = tmdbData.description;
                        changedFields.push('description');
                    }
                    if (changedFields.length > 0) {
                        movieData[entryIndex].lastModifiedDate = currentTimestamp;
                        if (movieData[entryIndex]._sync_state !== 'new') movieData[entryIndex]._sync_state = 'edited';
                        results.updated.push({ id: entry.id, name: entry.Name, fields: changedFields });
                        results.successful++;
                        if (verbose) console.log(`  ✓ Updated: ${changedFields.join(', ')}`);
                    } else {
                        results.skipped++;
                        if (verbose) console.log(`  ⊘ No new data`);
                    }
                }
            } else {
                results.successful++;
                if (verbose) {
                    const fields = [];
                    if (tmdbData.category) fields.push('category');
                    if (tmdbData.genre.length > 0) fields.push('genre');
                    if (tmdbData.language) fields.push('language');
                    if (tmdbData.year) fields.push('year');
                    if (tmdbData.country.length > 0) fields.push('country');
                    if (tmdbData.description) fields.push('description');
                    if (tmdbData.poster_url) fields.push('poster_url');
                    if (tmdbData.related_entries.length > 0) fields.push('related_entries');
                    if (tmdbData.vote_average) fields.push('rating');
                    if (tmdbData.vote_count) fields.push('vote_count');
                    if (tmdbData.full_cast.length > 0) fields.push('cast');
                    if (tmdbData.director_info) fields.push('director');
                    if (tmdbData.collection_id) fields.push('collection');
                    if (tmdbData.production_companies.length > 0) fields.push('companies');
                    if (tmdbData.keywords.length > 0) fields.push('keywords');
                    if (tmdbData.runtime) fields.push('runtime');
                    if (tmdbData.release_date) fields.push('release_date');
                    if (tmdbData.imdb_id) fields.push('imdb_id');
                    console.log(`  ✓ Would update: ${fields.join(', ')}`);
                }
            }
        } catch (error) {
            results.failed++;
            const errorMsg = `[${i+1}/${entriesToBackfill.length}] "${entry.Name}": ${error.message}`;
            console.error(`  ❌ ${errorMsg}`);
            results.errors.push(errorMsg);
        }
    }
    if (!dryRun && results.successful > 0) {
        try {
            if (typeof recalculateAndApplyAllRelationships === 'function') recalculateAndApplyAllRelationships();
            if (typeof sortMovies === 'function') sortMovies(currentSortColumn, currentSortDirection);
            await saveToIndexedDB();
            if (window.globalStatsData) window.globalStatsData = {};
            if (typeof checkAndNotifyNewAchievements === 'function') await checkAndNotifyNewAchievements();
            if (typeof renderMovieCards === 'function') renderMovieCards();
            console.log(`\n✅ Data saved and UI updated`);
        } catch (error) {
            console.error(`⚠️  Save failed:`, error);
        }
    }
    console.log(`\n${'═'.repeat(80)}\n📋 SUMMARY\n${'═'.repeat(80)}\nTotal: ${results.total}\n✓ Success: ${results.successful}\n⊘ Skipped: ${results.skipped}\n❌ Failed: ${results.failed}\n🔍 Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}\n${'═'.repeat(80)}\n`);
    if (results.updated.length > 0 && !dryRun) {
        console.log(`📝 Updated (${results.updated.length}):`);
        results.updated.slice(0, 10).forEach(item => console.log(`  • "${item.name}" → ${item.fields.join(', ')}`));
        if (results.updated.length > 10) console.log(`  ... +${results.updated.length - 10} more`);
    }
    if (results.errors.length > 0) {
        console.log(`\n⚠️  Errors:`);
        results.errors.slice(0, 5).forEach(err => console.log(`  • ${err}`));
    }
    console.log('\n💡 Next: Run comprehensiveSync() to sync to cloud\n');
    return results;
}

async function backfillEverything(options = {}) {
    const { dryRun = false, verbose = true, retryDelay = DEFAULT_RETRY_DELAY, maxResults = 50 } = options;
    console.log(`\n${'═'.repeat(80)}\n🔥 BACKFILL EVERYTHING\n${'═'.repeat(80)}\nPhase 1: Search for missing TMDB IDs\nPhase 2: Backfill ALL 21 data fields\n${'═'.repeat(80)}\n`);
    
    // Phase 1: Search for missing TMDB IDs
    console.log('📍 PHASE 1: Searching for missing TMDB IDs...\n');
    const idResults = await backfillTmdbIds({ dryRun, verbose, retryDelay, maxResults });
    console.log(`✓ Phase 1 complete: Found ${idResults.successful} IDs\n`);
    
    // Phase 2: Backfill all 21 fields
    console.log('📍 PHASE 2: Backfilling all 21 data fields...\n');
    const allColumns = ['category', 'genre', 'language', 'year', 'country', 'description', 'poster_url', 'related_entries', 'rating', 'vote_count', 'cast', 'director', 'collection', 'companies', 'keywords', 'runtime', 'release_date', 'imdb_id'];
    const dataResults = await backfillTmdbData({ columns: allColumns, dryRun, verbose, retryDelay, maxResults });
    console.log(`✓ Phase 2 complete: Updated ${dataResults.successful} entries\n`);
    
    // Summary
    const totalUpdated = (idResults.successful || 0) + (dataResults.successful || 0);
    console.log(`${'═'.repeat(80)}\n✨ BACKFILL EVERYTHING COMPLETE\n${'═'.repeat(80)}\nPhase 1 (IDs): ${idResults.successful} found\nPhase 2 (Data): ${dataResults.successful} entries updated\nTotal Changes: ${totalUpdated}\nMode: ${dryRun ? 'DRY RUN' : 'LIVE'}\nSync State: ${dryRun ? '(preview only)' : '_sync_state set to "edited"'}\n${'═'.repeat(80)}\n`);
    
    if (!dryRun && totalUpdated > 0) {
        console.log('💡 Next: Run comprehensiveSync() to sync all changes to cloud\n');
    }
    
    return { phase1: idResults, phase2: dataResults, totalUpdated };
}

function parseColumnInput(input) {
    if (!input) return [];
    let columns = typeof input === 'string' ? input.split(',').map(col => col.trim().toLowerCase()) : (Array.isArray(input) ? input.map(col => String(col).trim().toLowerCase()) : []);
    const validColumns = ['category', 'genre', 'language', 'year', 'country', 'description', 'poster_url', 'related_entries', 'tmdb_id', 'rating', 'vote_count', 'cast', 'director', 'collection', 'companies', 'keywords', 'runtime', 'release_date', 'imdb_id'];
    return columns.filter(col => validColumns.includes(col));
}

function extractTmdbData(detailData, mediaType, requestedColumns) {
    const data = { vote_average: null, vote_count: null, full_cast: [], director_info: null, collection_id: null, collection_name: null, collection_total_parts: null, production_companies: [], keywords: [], runtime: null, release_date: null, imdb_id: null, poster_url: null, related_entries: [], category: null, genre: [], language: null, year: null, country: [], description: null };
    if (!detailData) return data;
    if (requestedColumns.includes('rating')) data.vote_average = detailData.vote_average || null;
    if (requestedColumns.includes('vote_count')) data.vote_count = detailData.vote_count || null;
    if (requestedColumns.includes('cast') && detailData.credits && detailData.credits.cast) {
        data.full_cast = detailData.credits.cast.slice(0, 15).map(c => ({ id: c.id, name: c.name, character: c.character, profile_path: c.profile_path, order: c.order }));
    }
    if (requestedColumns.includes('director') && detailData.credits && detailData.credits.crew) {
        const director = detailData.credits.crew.find(c => c.job === 'Director');
        if (director) data.director_info = { id: director.id, name: director.name, profile_path: director.profile_path, job: director.job };
    }
    if (requestedColumns.includes('collection') && detailData.collection) {
        data.collection_id = detailData.collection.id;
        data.collection_name = detailData.collection.name;
        data.collection_total_parts = detailData.collection.parts ? detailData.collection.parts.length : null;
    }
    if (requestedColumns.includes('companies') && detailData.production_companies) {
        data.production_companies = detailData.production_companies.map(pc => ({ id: pc.id, name: pc.name, logo_path: pc.logo_path, origin_country: pc.origin_country }));
    }
    if (requestedColumns.includes('keywords')) {
        const keywordsList = detailData.keywords?.keywords || detailData.keywords?.results || [];
        data.keywords = keywordsList.map(k => ({ id: k.id, name: k.name }));
    }
    if (requestedColumns.includes('runtime')) {
        if (mediaType === 'movie') {
            data.runtime = detailData.runtime || null;
        } else if (mediaType === 'tv') {
            data.runtime = { seasons: detailData.number_of_seasons || null, episodes: detailData.number_of_episodes || null, episode_run_time: detailData.episode_run_time ? detailData.episode_run_time[0] : null };
        }
    }
    if (requestedColumns.includes('release_date')) {
        data.release_date = mediaType === 'movie' ? (detailData.release_date || null) : (detailData.first_air_date || null);
    }
    if (requestedColumns.includes('imdb_id') && detailData.external_ids) {
        data.imdb_id = detailData.external_ids.imdb_id || null;
    }
    if (requestedColumns.includes('poster_url') && detailData.poster_path) {
        data.poster_url = `https://image.tmdb.org/t/p/w500${detailData.poster_path}`;
    }
    if (requestedColumns.includes('related_entries') && detailData.collection && detailData.collection.parts) {
        data.related_entries = detailData.collection.parts.map(part => ({
            id: part.id,
            name: part.title || part.name,
            release_date: part.release_date || part.first_air_date,
            poster_path: part.poster_path
        }));
    }
    if (requestedColumns.includes('category') && detailData.genres && detailData.genres.length > 0) {
        data.category = detailData.genres[0].name;
    }
    if (requestedColumns.includes('genre') && detailData.genres) {
        data.genre = detailData.genres.map(g => ({ id: g.id, name: g.name }));
    }
    if (requestedColumns.includes('language') && detailData.original_language) {
        data.language = detailData.original_language.toUpperCase();
    }
    if (requestedColumns.includes('year')) {
        const dateStr = mediaType === 'movie' ? detailData.release_date : detailData.first_air_date;
        data.year = dateStr ? new Date(dateStr).getFullYear() : null;
    }
    if (requestedColumns.includes('country') && detailData.production_countries) {
        data.country = detailData.production_countries.map(pc => ({ code: pc.iso_3166_1, name: pc.name }));
    }
    if (requestedColumns.includes('description') && detailData.overview) {
        data.description = detailData.overview;
    }
    return data;
}

async function backfillTmdbIds(options = {}) {
    const { dryRun = false, verbose = true, mediaType = 'multi', retryDelay = DEFAULT_RETRY_DELAY, maxResults = 50 } = options;
    const safeRetryDelay = Math.max(retryDelay, MIN_RETRY_DELAY);
    if (retryDelay !== safeRetryDelay && retryDelay > 0) console.warn(`⚠️  retryDelay cannot be less than ${MIN_RETRY_DELAY}ms. Using ${safeRetryDelay}ms`);
    if (!Array.isArray(movieData)) { console.error('❌ movieData not available'); return; }
    if (!window.callTmdbApiDirect) { console.error('❌ TMDB API not available'); return; }
    const entriesToBackfill = movieData.filter(entry => !entry.tmdbId && entry.Name && entry.Year).slice(0, maxResults);
    if (entriesToBackfill.length === 0) { console.log('✅ No entries need TMDB ID'); return; }
    console.log(`\n${'═'.repeat(80)}\n🔍 TMDB ID SEARCH & BACKFILL\n${'═'.repeat(80)}\n📝 Entries: ${entriesToBackfill.length}\n🔍 Type: ${mediaType}\n⏱️  Delay: ${safeRetryDelay}ms\n🏃 Dry run: ${dryRun ? 'YES' : 'NO'}\n${'═'.repeat(80)}\n`);
    const results = { total: entriesToBackfill.length, successful: 0, skipped: 0, failed: 0, updated: [], errors: [] };
    for (let i = 0; i < entriesToBackfill.length; i++) {
        const entry = entriesToBackfill[i];
        try {
            if (i > 0) await new Promise(resolve => setTimeout(resolve, safeRetryDelay));
            if (verbose) console.log(`[${(i+1).toString().padStart(3)}/${entriesToBackfill.length}] Searching: "${entry.Name}" (${entry.Year})`);
            const searchResults = await callTmdbApiDirect(`/search/${mediaType}`, { query: entry.Name, primary_release_year: entry.Year });
            if (!searchResults || !Array.isArray(searchResults.results) || searchResults.results.length === 0) {
                if (verbose) console.log(`  ⚠️  No results`);
                results.skipped++;
                continue;
            }
            const topResult = searchResults.results[0];
            const resultTitle = topResult.title || topResult.name || '';
            const resultYear = topResult.release_date ? new Date(topResult.release_date).getFullYear() : (topResult.first_air_date ? new Date(topResult.first_air_date).getFullYear() : null);
            const tmdbId = topResult.id;
            const matchScore = calculateMatchScore(entry.Name, entry.Year, resultTitle, resultYear);
            if (verbose) console.log(`  ✓ Found: "${resultTitle}" (${resultYear || 'N/A'}) - ID: ${tmdbId} - Match: ${matchScore.toFixed(1)}%`);
            if (!dryRun) {
                const entryIndex = movieData.findIndex(m => m.id === entry.id);
                if (entryIndex !== -1) {
                    const currentTimestamp = new Date().toISOString();
                    movieData[entryIndex].tmdbId = tmdbId;
                    movieData[entryIndex].tmdbMatchScore = matchScore;
                    movieData[entryIndex].tmdbSearchDate = currentTimestamp;
                    movieData[entryIndex].lastModifiedDate = currentTimestamp;
                    if (movieData[entryIndex]._sync_state !== 'new') movieData[entryIndex]._sync_state = 'edited';
                    results.updated.push({ id: entry.id, name: entry.Name, year: entry.Year, tmdbId: tmdbId, matchScore: matchScore });
                    results.successful++;
                }
            } else {
                results.successful++;
            }
        } catch (error) {
            results.failed++;
            const errorMsg = `[${i+1}/${entriesToBackfill.length}] "${entry.Name}" (${entry.Year}): ${error.message}`;
            console.error(`  ❌ ${errorMsg}`);
            results.errors.push(errorMsg);
        }
    }
    if (!dryRun && results.successful > 0) {
        try {
            if (typeof recalculateAndApplyAllRelationships === 'function') recalculateAndApplyAllRelationships();
            if (typeof sortMovies === 'function') sortMovies(currentSortColumn, currentSortDirection);
            await saveToIndexedDB();
            if (window.globalStatsData) window.globalStatsData = {};
            if (typeof checkAndNotifyNewAchievements === 'function') await checkAndNotifyNewAchievements();
            if (typeof renderMovieCards === 'function') renderMovieCards();
            console.log(`\n✅ Data saved and UI updated`);
        } catch (error) {
            console.error(`⚠️  Save failed:`, error);
        }
    }
    console.log(`\n${'═'.repeat(80)}\n📋 RESULTS\n${'═'.repeat(80)}\nTotal: ${results.total}\n✓ Success: ${results.successful}\n⊘ Skipped: ${results.skipped}\n❌ Failed: ${results.failed}\n🔍 Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}\n${'═'.repeat(80)}\n`);
    if (results.updated.length > 0) {
        console.log(`📝 Found IDs (${results.updated.length}):`);
        results.updated.slice(0, 10).forEach(item => console.log(`  • "${item.name}" (${item.year}) → ${item.tmdbId} (${item.matchScore.toFixed(1)}%)`));
        if (results.updated.length > 10) console.log(`  ... +${results.updated.length - 10} more`);
    }
    if (results.errors.length > 0) {
        console.log(`\n⚠️  Errors:`);
        results.errors.slice(0, 5).forEach(err => console.log(`  • ${err}`));
    }
    console.log('\n💡 Next: Run backfillTmdbData() to fill other fields\n');
    return results;
}

function calculateMatchScore(origName, origYear, resultName, resultYear) {
    let score = 0;
    const normOrigName = origName.toLowerCase().trim();
    const normResultName = resultName.toLowerCase().trim();
    if (normOrigName === normResultName) score += 60;
    else if (normResultName.startsWith(normOrigName)) score += 50;
    else if (normResultName.includes(normOrigName)) score += 40;
    else score += stringSimilarity(normOrigName, normResultName) * 35;
    if (origYear && resultYear) {
        const yearDiff = Math.abs(origYear - resultYear);
        if (yearDiff === 0) score += 40;
        else if (yearDiff === 1) score += 25;
        else if (yearDiff <= 2) score += 10;
    }
    return Math.min(score, 100);
}

function stringSimilarity(str1, str2) {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    if (longer.length === 0) return 1.0;
    const editDistance = getEditDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
}

function getEditDistance(s1, s2) {
    const costs = {};
    for (let i = 0; i <= s1.length; i++) {
        let lastValue = i;
        for (let j = 0; j <= s2.length; j++) {
            if (i === 0) costs[j] = j;
            else if (j > 0) {
                let newValue = costs[j - 1];
                if (s1.charAt(i - 1) !== s2.charAt(j - 1)) newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
                costs[j - 1] = lastValue;
                lastValue = newValue;
            }
        }
        if (i > 0) costs[s2.length] = lastValue;
    }
    return costs[s2.length];
}

function getBackfillStatus() {
    if (!Array.isArray(movieData)) { console.error('movieData not available'); return; }
    const withTmdbId = movieData.filter(entry => entry.tmdbId);
    const withoutTmdbId = movieData.filter(entry => !entry.tmdbId);
    const withoutNameYear = withoutTmdbId.filter(entry => !entry.Name || !entry.Year);
    const missingRating = withTmdbId.filter(e => !e.tmdb_vote_average).length;
    const missingCast = withTmdbId.filter(e => !e.full_cast || e.full_cast.length === 0).length;
    const missingDirector = withTmdbId.filter(e => !e.director_info).length;
    const missingCollection = withTmdbId.filter(e => !e.tmdb_collection_id).length;
    const missingCompanies = withTmdbId.filter(e => !e.production_companies || e.production_companies.length === 0).length;
    console.log(`\n${'═'.repeat(80)}\n📊 BACKFILL STATUS\n${'═'.repeat(80)}\n🆔 TMDB IDs:\n  Total: ${movieData.length}\n  ✓ With ID: ${withTmdbId.length} (${((withTmdbId.length/movieData.length)*100).toFixed(1)}%)\n  ❌ Missing: ${withoutTmdbId.length}\n     └─ Searchable: ${withoutTmdbId.length - withoutNameYear.length}\n     └─ Unsearchable: ${withoutNameYear.length}\n\n📋 DATA (${withTmdbId.length} entries):\n  ⭐ Rating: ${withTmdbId.length - missingRating}/${withTmdbId.length} (${(((withTmdbId.length - missingRating)/withTmdbId.length)*100).toFixed(1)}%)\n  👥 Cast: ${withTmdbId.length - missingCast}/${withTmdbId.length} (${(((withTmdbId.length - missingCast)/withTmdbId.length)*100).toFixed(1)}%)\n  🎬 Director: ${withTmdbId.length - missingDirector}/${withTmdbId.length} (${(((withTmdbId.length - missingDirector)/withTmdbId.length)*100).toFixed(1)}%)\n  🎞️  Collection: ${withTmdbId.length - missingCollection}/${withTmdbId.length} (${(((withTmdbId.length - missingCollection)/withTmdbId.length)*100).toFixed(1)}%)\n  🏢 Companies: ${withTmdbId.length - missingCompanies}/${withTmdbId.length} (${(((withTmdbId.length - missingCompanies)/withTmdbId.length)*100).toFixed(1)}%)\n\n${'═'.repeat(80)}\n`);
    return { total: movieData.length, withTmdbId: withTmdbId.length, withoutTmdbId: withoutTmdbId.length, searchable: withoutTmdbId.length - withoutNameYear.length, unsearchable: withoutNameYear.length, missingData: { rating: missingRating, cast: missingCast, director: missingDirector, collection: missingCollection, companies: missingCompanies } };
}

function backfillHelp() {
    console.log(`
╔════════════════════════════════════════════════════════════════════════════╗
║                    TMDB BACKFILL                              ║
╚════════════════════════════════════════════════════════════════════════════╝

🎯 MAIN FUNCTIONS:

1️⃣  backfillTmdbData(options)
    Backfill TMDB data fields for entries WITH TMDB IDs
    
    Options: { columns, dryRun, verbose, retryDelay, maxResults }
    
    Available columns:
    'rating', 'vote_count', 'cast', 'director', 'collection', 
    'companies', 'keywords', 'runtime', 'release_date', 'imdb_id'
    
    Examples:
    backfillTmdbData()
    backfillTmdbData({ columns: ['rating', 'cast'], dryRun: true })
    backfillTmdbData({ columns: 'director,companies', maxResults: 100, retryDelay: 750 })

2️⃣  backfillTmdbIds(options)
    Search for and assign TMDB IDs to entries WITHOUT IDs
    
    Options: { dryRun, verbose, mediaType, retryDelay, maxResults }
    
    Examples:
    backfillTmdbIds()
    backfillTmdbIds({ dryRun: true, maxResults: 100 })
    backfillTmdbIds({ mediaType: 'movie' })

3️⃣  getBackfillStatus()
    Show comprehensive backfill statistics

4️⃣  backfillHelp()
    Show this help

⚡ QUICK START:

getBackfillStatus()                              // Check status
backfillTmdbIds({ dryRun: true })              // Preview ID search
backfillTmdbIds()                               // Apply ID search
backfillTmdbData({ dryRun: true })             // Preview data fill
backfillTmdbData()                              // Apply data fill
comprehensiveSync()                             // Sync to cloud

✓ Multiple parameters work: { dryRun: true, maxResults: 50, retryDelay: 750 }
✓ retryDelay minimum: 500ms (enforced automatically)
✓ columns: array or string ('rating,cast' or ['rating', 'cast'])
✓ Only backfills empty fields (never overwrites)
✓ All changes synced automatically for cloud upload

    `);
}

console.log('\n✅ TMDB Backfill loaded! Type backfillHelp() for documentation.\n');

/**
 * TMDB Data Backfill CLI
 * Backfill ANY TMDB data field for entries with valid TMDB IDs
 * 
 * Features:
 * - Multiple column backfill modes
 * - Smart filtering and validation
 * - Rate-limited API calls
 * - Detailed progress reporting
 * - Dry-run support
 * - Relationship auto-update
 */

// ============================================================================
// MAIN FUNCTION: Universal TMDB Data Backfill
// ============================================================================

async function backfillTmdbData(options = {}) {
    // === Validate & Normalize Options ===
    const {
        columns = ['rating', 'cast', 'director', 'collection', 'companies'],
        dryRun = false,
        verbose = true,
        retryDelay = 500,
        maxResults = 50,
        minMatchScore = 0
    } = options;

    // === Enforce minimum retry delay ===
    const safeRetryDelay = Math.max(retryDelay, MIN_RETRY_DELAY);
    if (retryDelay !== safeRetryDelay) {
        console.warn(`⚠️  retryDelay cannot be less than ${MIN_RETRY_DELAY}ms. Using ${safeRetryDelay}ms`);
    }

    // === Validate inputs ===
    if (!Array.isArray(movieData)) {
        console.error('❌ movieData is not available or not an array');
        return;
    }

    if (!window.callTmdbApiDirect) {
        console.error('❌ TMDB API function not available. Make sure tmdb.js is loaded');
        return;
    }

    // === Parse columns input ===
    const backfillColumns = parseColumnInput(columns);
    if (backfillColumns.length === 0) {
        console.error('❌ No valid columns specified. Use: rating, cast, director, collection, companies, keywords, runtime, release_date, imdb_id, vote_count');
        return;
    }

    // === Find entries to backfill ===
    const entriesToBackfill = movieData
        .filter(entry => entry.tmdbId && (
            (backfillColumns.includes('rating') && !entry.tmdb_vote_average) ||
            (backfillColumns.includes('cast') && (!entry.full_cast || entry.full_cast.length === 0)) ||
            (backfillColumns.includes('director') && !entry.director_info) ||
            (backfillColumns.includes('collection') && !entry.tmdb_collection_id) ||
            (backfillColumns.includes('companies') && (!entry.production_companies || entry.production_companies.length === 0)) ||
            (backfillColumns.includes('keywords') && (!entry.keywords || entry.keywords.length === 0)) ||
            (backfillColumns.includes('runtime') && !entry.runtime) ||
            (backfillColumns.includes('release_date') && !entry.tmdb_release_date) ||
            (backfillColumns.includes('imdb_id') && !entry.imdb_id) ||
            (backfillColumns.includes('vote_count') && !entry.tmdb_vote_count)
        ))
        .slice(0, maxResults);

    if (entriesToBackfill.length === 0) {
        console.log('✅ No entries found that need backfilling for selected columns');
        return;
    }

    // === Print header ===
    console.log(`\n${'═'.repeat(70)}`);
    console.log(`🚀 TMDB DATA BACKFILL`);
    console.log(`${'═'.repeat(70)}`);
    console.log(`📊 Entries to process:     ${entriesToBackfill.length}/${movieData.length}`);
    console.log(`📋 Columns to backfill:    ${backfillColumns.join(', ')}`);
    console.log(`⏱️  Retry delay:            ${safeRetryDelay}ms`);
    console.log(`🏃 Dry run:                ${dryRun ? 'YES (no changes)' : 'NO (live changes)'}`);
    console.log(`${'═'.repeat(70)}\n`);

    const results = {
        total: entriesToBackfill.length,
        successful: 0,
        skipped: 0,
        failed: 0,
        updated: [],
        errors: []
    };

    // === Process each entry ===
    for (let i = 0; i < entriesToBackfill.length; i++) {
        const entry = entriesToBackfill[i];
        const progress = `[${(i + 1).toString().padStart(3)}/${entriesToBackfill.length.toString().padStart(3)}]`;

        try {
            // Rate limiting
            if (i > 0) {
                await new Promise(resolve => setTimeout(resolve, safeRetryDelay));
            }

            if (verbose) {
                console.log(`${progress} Fetching: "${entry.Name}" (TMDB: ${entry.tmdbId})`);
            }

            // Determine media type with fallback
            let mediaType = entry.tmdbMediaType || (entry.Category === 'Series' ? 'tv' : 'movie');
            
            // Fetch TMDB details with automatic fallback
            let detailData = await callTmdbApiDirect(
                `/${mediaType}/${entry.tmdbId}`,
                { 
                    append_to_response: 'credits,keywords,collection,external_ids'
                }
            );
            
            // If failed with 404, try the opposite media type
            if (!detailData && !entry.tmdbMediaType) {
                const fallbackMediaType = mediaType === 'movie' ? 'tv' : 'movie';
                if (verbose) console.log(`  ↻ Retrying with ${fallbackMediaType}...`);
                detailData = await callTmdbApiDirect(
                    `/${fallbackMediaType}/${entry.tmdbId}`,
                    { 
                        append_to_response: 'credits,keywords,collection,external_ids'
                    }
                );
                if (detailData) {
                    mediaType = fallbackMediaType;
                    entry.tmdbMediaType = fallbackMediaType; // Save correct media type
                }
            }

            if (!detailData) {
                results.skipped++;
                if (verbose) console.log(`  ⚠️  No data received`);
                continue;
            }

            // === Extract TMDB data ===
            const tmdbData = extractTmdbData(detailData, mediaType, backfillColumns);
            let dataChanged = false;

            if (!dryRun) {
                const entryIndex = movieData.findIndex(m => m.id === entry.id);
                if (entryIndex !== -1) {
                    const currentTimestamp = new Date().toISOString();
                    const changedFields = [];

                    // Apply backfill data
                    if (backfillColumns.includes('rating') && tmdbData.vote_average !== null && !movieData[entryIndex].tmdb_vote_average) {
                        movieData[entryIndex].tmdb_vote_average = tmdbData.vote_average;
                        changedFields.push('rating');
                        dataChanged = true;
                    }

                    if (backfillColumns.includes('vote_count') && tmdbData.vote_count !== null && !movieData[entryIndex].tmdb_vote_count) {
                        movieData[entryIndex].tmdb_vote_count = tmdbData.vote_count;
                        changedFields.push('vote_count');
                        dataChanged = true;
                    }

                    if (backfillColumns.includes('cast') && tmdbData.full_cast.length > 0 && (!movieData[entryIndex].full_cast || movieData[entryIndex].full_cast.length === 0)) {
                        movieData[entryIndex].full_cast = tmdbData.full_cast;
                        changedFields.push('cast');
                        dataChanged = true;
                    }

                    if (backfillColumns.includes('director') && tmdbData.director_info && !movieData[entryIndex].director_info) {
                        movieData[entryIndex].director_info = tmdbData.director_info;
                        changedFields.push('director');
                        dataChanged = true;
                    }

                    if (backfillColumns.includes('collection') && tmdbData.collection_id && !movieData[entryIndex].tmdb_collection_id) {
                        movieData[entryIndex].tmdb_collection_id = tmdbData.collection_id;
                        movieData[entryIndex].tmdb_collection_name = tmdbData.collection_name;
                        movieData[entryIndex].tmdb_collection_total_parts = tmdbData.collection_total_parts;
                        changedFields.push('collection');
                        dataChanged = true;
                    }

                    if (backfillColumns.includes('companies') && tmdbData.production_companies.length > 0 && (!movieData[entryIndex].production_companies || movieData[entryIndex].production_companies.length === 0)) {
                        movieData[entryIndex].production_companies = tmdbData.production_companies;
                        changedFields.push('companies');
                        dataChanged = true;
                    }

                    if (backfillColumns.includes('keywords') && tmdbData.keywords.length > 0 && (!movieData[entryIndex].keywords || movieData[entryIndex].keywords.length === 0)) {
                        movieData[entryIndex].keywords = tmdbData.keywords;
                        changedFields.push('keywords');
                        dataChanged = true;
                    }

                    if (backfillColumns.includes('runtime') && tmdbData.runtime && !movieData[entryIndex].runtime) {
                        movieData[entryIndex].runtime = tmdbData.runtime;
                        changedFields.push('runtime');
                        dataChanged = true;
                    }

                    if (backfillColumns.includes('release_date') && tmdbData.release_date && !movieData[entryIndex].tmdb_release_date) {
                        movieData[entryIndex].tmdb_release_date = tmdbData.release_date;
                        changedFields.push('release_date');
                        dataChanged = true;
                    }

                    if (backfillColumns.includes('imdb_id') && tmdbData.imdb_id && !movieData[entryIndex].imdb_id) {
                        movieData[entryIndex].imdb_id = tmdbData.imdb_id;
                        changedFields.push('imdb_id');
                        dataChanged = true;
                    }

                    if (dataChanged) {
                        movieData[entryIndex].lastModifiedDate = currentTimestamp;
                        if (movieData[entryIndex]._sync_state !== 'new') {
                            movieData[entryIndex]._sync_state = 'edited';
                        }

                        results.updated.push({
                            id: entry.id,
                            name: entry.Name,
                            fields: changedFields
                        });

                        results.successful++;

                        if (verbose) {
                            console.log(`  ✓ Updated: ${changedFields.join(', ')}`);
                        }
                    } else {
                        results.skipped++;
                        if (verbose) {
                            console.log(`  ⊘ No new data to add`);
                        }
                    }
                }
            } else {
                // Dry run: just count
                results.successful++;
                if (verbose) {
                    const fields = [];
                    if (tmdbData.vote_average) fields.push('rating');
                    if (tmdbData.full_cast.length > 0) fields.push('cast');
                    if (tmdbData.director_info) fields.push('director');
                    if (tmdbData.collection_id) fields.push('collection');
                    if (tmdbData.production_companies.length > 0) fields.push('companies');
                    if (tmdbData.keywords.length > 0) fields.push('keywords');
                    console.log(`  ✓ Would update: ${fields.join(', ')}`);
                }
            }

        } catch (error) {
            results.failed++;
            const errorMsg = `[${i + 1}/${entriesToBackfill.length}] "${entry.Name}": ${error.message}`;
            console.error(`  ❌ ${errorMsg}`);
            results.errors.push(errorMsg);
        }
    }

    // === Save to database ===
    if (!dryRun && results.successful > 0) {
        try {
            if (typeof recalculateAndApplyAllRelationships === 'function') {
                recalculateAndApplyAllRelationships();
            }
            if (typeof sortMovies === 'function') {
                sortMovies(currentSortColumn, currentSortDirection);
            }
            await saveToIndexedDB();
            if (window.globalStatsData) {
                window.globalStatsData = {};
            }
            if (typeof checkAndNotifyNewAchievements === 'function') {
                await checkAndNotifyNewAchievements();
            }
            if (typeof renderMovieCards === 'function') {
                renderMovieCards();
            }
            console.log(`\n✅ Data saved to local database and UI updated`);
        } catch (error) {
            console.error(`⚠️  Failed to save to database:`, error);
        }
    }

    // === Print summary ===
    console.log(`\n${'═'.repeat(70)}`);
    console.log(`📋 BACKFILL SUMMARY`);
    console.log(`${'═'.repeat(70)}`);
    console.log(`Total Processed:  ${results.total}`);
    console.log(`✓ Successful:     ${results.successful}`);
    console.log(`⊘ Skipped:        ${results.skipped}`);
    console.log(`❌ Failed:        ${results.failed}`);
    console.log(`🔍 Mode:          ${dryRun ? 'DRY RUN (No changes)' : 'LIVE (Changes saved)'}`);
    console.log(`${'═'.repeat(70)}\n`);

    if (results.updated.length > 0 && !dryRun) {
        console.log(`📝 Updated Entries (${results.updated.length}):`);
        results.updated.slice(0, 10).forEach(item => {
            console.log(`  • "${item.name}" → ${item.fields.join(', ')}`);
        });
        if (results.updated.length > 10) {
            console.log(`  ... and ${results.updated.length - 10} more`);
        }
    }

    if (results.errors.length > 0) {
        console.log(`\n⚠️  Errors (${results.errors.length}):`);
        results.errors.slice(0, 5).forEach(err => console.log(`  • ${err}`));
        if (results.errors.length > 5) {
            console.log(`  ... and ${results.errors.length - 5} more`);
        }
    }

    return results;
}

// ============================================================================
// LEGACY FUNCTION: backfillTmdbIds() - Alias for backward compatibility
// ============================================================================

async function backfillTmdbIds(options = {}) {
    const {
        dryRun = false,
        verbose = true,
        mediaType = 'multi', // 'movie' or 'tv' or 'multi'
        retryDelay = 500,
        maxResults = 50
    } = options;

    if (!Array.isArray(movieData)) {
        console.error('❌ movieData is not available or not an array');
        return { total: 0, successful: 0, skipped: 0, failed: 0, updated: [], errors: [] };
    }

    if (!window.callTmdbApiDirect) {
        console.error('❌ TMDB API function not available. Make sure tmdb.js is loaded');
        return { total: 0, successful: 0, skipped: 0, failed: 0, updated: [], errors: [] };
    }

    // Find entries with missing TMDB IDs
    const entriesToBackfill = movieData
        .filter(entry => !entry.tmdbId && entry.Name && entry.Year)
        .slice(0, maxResults);

    if (entriesToBackfill.length === 0) {
        console.log('✅ No entries found that need TMDB ID backfill');
        return { total: 0, successful: 0, skipped: 0, failed: 0, updated: [], errors: [] };
    }

    console.log(`\n📊 Starting TMDB ID Backfill`);
    console.log(`📝 Found ${entriesToBackfill.length} entries missing TMDB IDs (max ${maxResults})`);
    console.log(`🔍 Search Type: ${mediaType}`);
    console.log(`🏃 Dry Run: ${dryRun ? 'Yes' : 'No'}\n`);

    const results = {
        total: entriesToBackfill.length,
        successful: 0,
        skipped: 0,
        failed: 0,
        updated: [],
        errors: []
    };

    for (let i = 0; i < entriesToBackfill.length; i++) {
        const entry = entriesToBackfill[i];
        const searchQuery = `${entry.Name} ${entry.Year}`;
        const progress = `[${i + 1}/${entriesToBackfill.length}]`;

        try {
            // Rate limiting - wait between requests
            if (i > 0) {
                await new Promise(resolve => setTimeout(resolve, retryDelay));
            }

            if (verbose) {
                console.log(`${progress} Searching: "${entry.Name}" (${entry.Year})`);
            }

            // Search TMDB
            const searchParams = {
                query: entry.Name,
                primary_release_year: entry.Year
            };

            const searchResults = await callTmdbApiDirect(`/search/${mediaType}`, searchParams);
            
            if (!searchResults || !Array.isArray(searchResults.results) || searchResults.results.length === 0) {
                if (verbose) {
                    console.log(`  ⚠️  No results found`);
                }
                results.skipped++;
                continue;
            }

            // Find best match
            const topResult = searchResults.results[0];
            
            // Verify it's a reasonable match
            const isMovie = topResult.media_type === 'movie' || topResult.title;
            const isSeries = topResult.media_type === 'tv' || topResult.name;
            const resultTitle = topResult.title || topResult.name || '';
            const resultYear = topResult.release_date 
                ? new Date(topResult.release_date).getFullYear()
                : topResult.first_air_date
                    ? new Date(topResult.first_air_date).getFullYear()
                    : null;
            
            const tmdbId = topResult.id;
            const matchScore = calculateMatchScore(entry.Name, entry.Year, resultTitle, resultYear);

            if (verbose) {
                console.log(`  ✓ Found: "${resultTitle}" (${resultYear || 'N/A'}) - ID: ${tmdbId} - Match Score: ${matchScore.toFixed(1)}%`);
            }

            if (!dryRun) {
                // Update the entry
                const entryIndex = movieData.findIndex(m => m.id === entry.id);
                if (entryIndex !== -1) {
                    const currentTimestamp = new Date().toISOString();
                    
                    movieData[entryIndex].tmdbId = tmdbId;
                    movieData[entryIndex].tmdbMatchScore = matchScore;
                    movieData[entryIndex].tmdbSearchDate = currentTimestamp;
                    movieData[entryIndex].lastModifiedDate = currentTimestamp;
                    
                    // Mark as edited for sync (only if not new)
                    if (movieData[entryIndex]._sync_state !== 'new') {
                        movieData[entryIndex]._sync_state = 'edited';
                    }

                    results.updated.push({
                        id: entry.id,
                        name: entry.Name,
                        year: entry.Year,
                        tmdbId: tmdbId,
                        matchScore: matchScore
                    });

                    results.successful++;
                }
            } else {
                results.updated.push({
                    id: entry.id,
                    name: entry.Name,
                    year: entry.Year,
                    tmdbId: tmdbId,
                    matchScore: matchScore
                });
                results.successful++;
            }

        } catch (error) {
            results.failed++;
            const errorMsg = `${progress} "${entry.Name}" (${entry.Year}): ${error.message}`;
            console.error(`  ❌ ${errorMsg}`);
            results.errors.push(errorMsg);
        }
    }

    // Save results
    if (!dryRun && results.successful > 0) {
        try {
            // Recalculate relationships and apply them
            if (typeof recalculateAndApplyAllRelationships === 'function') {
                recalculateAndApplyAllRelationships();
            }
            
            // Re-sort movies
            if (typeof sortMovies === 'function') {
                sortMovies(currentSortColumn, currentSortDirection);
            }
            
            // Save to local database
            await saveToIndexedDB();
            
            // Clear stats cache so UI reflects new data
            if (window.globalStatsData) {
                window.globalStatsData = {};
            }
            
            // Update achievements if function exists
            if (typeof checkAndNotifyNewAchievements === 'function') {
                await checkAndNotifyNewAchievements();
            }
            
            // Re-render the UI
            if (typeof renderMovieCards === 'function') {
                renderMovieCards();
            }
            
            console.log(`\n✅ Data saved to local database and UI updated`);
        } catch (error) {
            console.error(`⚠️  Failed to save to local database:`, error);
        }
    }

    // Print summary
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📋 BACKFILL SUMMARY`);
    console.log(`${'='.repeat(60)}`);
    console.log(`Total Processed:  ${results.total}`);
    console.log(`✓ Successful:     ${results.successful}`);
    console.log(`⚠️  Skipped:       ${results.skipped}`);
    console.log(`❌ Failed:        ${results.failed}`);
    console.log(`🔍 Mode:          ${dryRun ? 'DRY RUN (No changes saved)' : 'LIVE (Changes saved)'}`);
    console.log(`${'='.repeat(60)}\n`);

    if (results.updated.length > 0) {
        console.log(`📝 Updated Entries:`);
        results.updated.forEach(item => {
            console.log(`  • "${item.name}" (${item.year}) → TMDB ID: ${item.tmdbId} (${item.matchScore.toFixed(1)}% match)`);
        });
    }

    if (results.errors.length > 0) {
        console.log(`\n⚠️  Errors:`);
        results.errors.forEach(err => console.log(`  • ${err}`));
    }

    return results;
}

/**
 * Calculate match score between search query and result (0-100)
 * Considers title similarity and year match
 */
function calculateMatchScore(origName, origYear, resultName, resultYear) {
    let score = 0;
    const maxScore = 100;

    // Normalize names for comparison
    const normOrigName = origName.toLowerCase().trim();
    const normResultName = resultName.toLowerCase().trim();

    // Exact name match
    if (normOrigName === normResultName) {
        score += 60;
    }
    // Name starts with search term
    else if (normResultName.startsWith(normOrigName)) {
        score += 50;
    }
    // Search term in result name
    else if (normResultName.includes(normOrigName)) {
        score += 40;
    }
    // Similarity score (simple Levenshtein-ish)
    else {
        const similarity = stringSimilarity(normOrigName, normResultName);
        score += similarity * 35; // max 35 points
    }

    // Year match
    if (origYear && resultYear) {
        const yearDiff = Math.abs(origYear - resultYear);
        if (yearDiff === 0) {
            score += 40; // Exact year match
        } else if (yearDiff === 1) {
            score += 25; // 1 year difference
        } else if (yearDiff <= 2) {
            score += 10; // 2 years difference
        }
    }

    return Math.min(score, maxScore);
}

/**
 * Simple string similarity calculation (0-1)
 */
function stringSimilarity(str1, str2) {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;

    if (longer.length === 0) return 1.0;

    const editDistance = getEditDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
}

/**
 * Calculate Levenshtein distance between two strings
 */
function getEditDistance(s1, s2) {
    const costs = {};

    for (let i = 0; i <= s1.length; i++) {
        let lastValue = i;
        for (let j = 0; j <= s2.length; j++) {
            if (i === 0) {
                costs[j] = j;
            } else if (j > 0) {
                let newValue = costs[j - 1];
                if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
                    newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
                }
                costs[j - 1] = lastValue;
                lastValue = newValue;
            }
        }
        if (i > 0) costs[s2.length] = lastValue;
    }

    return costs[s2.length];
}

/**
 * Get backfill status and statistics
 */
function getBackfillStatus() {
    if (!Array.isArray(movieData)) {
        console.error('movieData not available');
        return;
    }

    const withoutTmdbId = movieData.filter(entry => !entry.tmdbId);
    const withTmdbId = movieData.filter(entry => entry.tmdbId);
    const withoutNameYear = withoutTmdbId.filter(entry => !entry.Name || !entry.Year);

    console.log(`\n📊 BACKFILL STATUS REPORT`);
    console.log(`${'='.repeat(60)}`);
    console.log(`Total Entries:             ${movieData.length}`);
    console.log(`✓ With TMDB ID:            ${withTmdbId.length} (${((withTmdbId.length / movieData.length) * 100).toFixed(1)}%)`);
    console.log(`❌ Without TMDB ID:        ${withoutTmdbId.length} (${((withoutTmdbId.length / movieData.length) * 100).toFixed(1)}%)`);
    console.log(`  └─ Backfill-able (Name + Year): ${withoutTmdbId.length - withoutNameYear.length}`);
    console.log(`  └─ Not backfill-able (missing Name/Year): ${withoutNameYear.length}`);
    console.log(`${'='.repeat(60)}\n`);

    return {
        total: movieData.length,
        withTmdbId: withTmdbId.length,
        withoutTmdbId: withoutTmdbId.length,
        backfillable: withoutTmdbId.length - withoutNameYear.length,
        notBackfillable: withoutNameYear.length
    };
}

/**
 * Export entries without TMDB ID for review
 */
function exportMissingTmdbIds() {
    if (!Array.isArray(movieData)) {
        console.error('movieData not available');
        return;
    }

    const missing = movieData
        .filter(entry => !entry.tmdbId && entry.Name && entry.Year)
        .map(entry => ({
            id: entry.id,
            Name: entry.Name,
            Year: entry.Year,
            Category: entry.Category,
            Status: entry.Status
        }));

    console.log(`\n📋 Entries Missing TMDB ID (${missing.length} total):`);
    console.table(missing);

    return missing;
}

// Console help function
function backfillHelp() {
    console.log(`
╔════════════════════════════════════════════════════════════╗
║           TMDB ID BACKFILL UTILITY - HELP                  ║
╚════════════════════════════════════════════════════════════╝

📖 FUNCTIONS:

1️⃣  backfillTmdbIds(options)
    Backfill missing TMDB IDs using Name + Year search
    
    Options:
    {
        dryRun: true|false      // Preview changes (default: false)
        verbose: true|false     // Show detailed logs (default: true)
        mediaType: 'multi'      // 'multi', 'movie', or 'tv' (default: 'multi')
        retryDelay: 500         // ms between API calls (default: 500)
        maxResults: 50          // Max entries to process (default: 50)
    }
    
    Examples:
    • backfillTmdbIds()                    // Process up to 50 entries
    • backfillTmdbIds({ dryRun: true })   // Preview without saving
    • backfillTmdbIds({ maxResults: 100 }) // Process up to 100 entries
    • backfillTmdbIds({ mediaType: 'movie' }) // Only search for movies

2️⃣  getBackfillStatus()
    View overall status of TMDB ID coverage
    
    Example:
    • getBackfillStatus()

3️⃣  exportMissingTmdbIds()
    Export list of entries missing TMDB IDs
    
    Example:
    • exportMissingTmdbIds()

4️⃣  backfillHelp()
    Display this help message

🔑 QUICK START:
    1. Run: getBackfillStatus()          // Check how many need backfill
    2. Run: backfillTmdbIds({ dryRun: true })  // Preview changes
    3. Run: backfillTmdbIds()            // Apply changes
    4. Sync data to cloud when ready

⚠️  IMPORTANT:
    • This requires TMDB API to be configured
    • Rate limiting is applied (500ms between requests)
    • Changes are marked for cloud sync automatically
    • Use dryRun: true to preview changes first
    `);
}

// Auto-display help when script loads
console.log('\n✅ Backfill utility loaded! Type backfillHelp() for usage instructions.\n');
