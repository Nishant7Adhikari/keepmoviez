/* backfill.js - TMDB Data Backfill Console Utility */

/**
 * Comprehensive TMDB Data Backfill CLI
 * Backfill ANY TMDB data field for entries with valid TMDB IDs
 * Supports 10+ data fields: rating, cast, director, collection, companies, keywords, runtime, release_date, imdb_id, vote_count
 */

const MIN_RETRY_DELAY = 25;      // Minimum delay between API requests (TMDB allows 50 calls/sec = 20ms, so 100ms is safe)
const DEFAULT_RETRY_DELAY = 25;  // Default delay (safer for multiple users/concurrent requests)

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
        retryDelay = DEFAULT_RETRY_DELAY,
        maxResults = 500
    } = options;

    // === Enforce minimum retry delay ===
    const safeRetryDelay = Math.max(retryDelay, MIN_RETRY_DELAY);

    if (retryDelay !== safeRetryDelay && retryDelay > 0) {
        console.warn(
            `⚠️  retryDelay cannot be less than ${MIN_RETRY_DELAY}ms. Using ${safeRetryDelay}ms`
        );
    }

    // === Validate Environment ===
    if (!Array.isArray(movieData)) {
        console.error('❌ movieData not available or not an array');

        return {
            total: 0,
            successful: 0,
            skipped: 0,
            failed: 0,
            updated: [],
            errors: []
        };
    }

    if (typeof window.callTmdbApiDirect !== 'function') {
        console.error(
            '❌ TMDB API function not available. Make sure tmdb.js is loaded'
        );

        return {
            total: 0,
            successful: 0,
            skipped: 0,
            failed: 0,
            updated: [],
            errors: []
        };
    }

    // === Parse Columns ===
    const backfillColumns = parseColumnInput(columns);

    if (backfillColumns.length === 0) {
        console.error(
            '❌ No valid columns specified. Use: ' +
            'category, genre, language, year, country, description, ' +
            'poster_url, related_entries, tmdb_id, rating, vote_count, ' +
            'cast, director, collection, companies, keywords, runtime, ' +
            'release_date, imdb_id'
        );

        return {
            total: 0,
            successful: 0,
            skipped: 0,
            failed: 0,
            updated: [],
            errors: []
        };
    }

    // === Find Entries That Need Backfilling ===
    const entriesToBackfill = movieData
        .filter(entry => entry.tmdbId && (
            (backfillColumns.includes('category') &&
                !entry.category) ||

            (backfillColumns.includes('genre') &&
                (!entry.genre || entry.genre.length === 0)) ||

            (backfillColumns.includes('language') &&
                !entry.language) ||

            (backfillColumns.includes('year') &&
                !entry.year) ||

            (backfillColumns.includes('country') &&
                (!entry.country || entry.country.length === 0)) ||

            (backfillColumns.includes('description') &&
                !entry.description) ||

            (backfillColumns.includes('poster_url') &&
                !entry.poster_url) ||

            (backfillColumns.includes('related_entries') &&
                (!entry.related_entries ||
                    entry.related_entries.length === 0)) ||

            (backfillColumns.includes('rating') &&
                !entry.tmdb_vote_average) ||

            (backfillColumns.includes('vote_count') &&
                !entry.tmdb_vote_count) ||

            (backfillColumns.includes('cast') &&
                (!entry.full_cast ||
                    entry.full_cast.length === 0)) ||

            (backfillColumns.includes('director') &&
                !entry.director_info) ||

            (backfillColumns.includes('collection') &&
                !entry.tmdb_collection_id) ||

            (backfillColumns.includes('companies') &&
                (!entry.production_companies ||
                    entry.production_companies.length === 0)) ||

            (backfillColumns.includes('keywords') &&
                (!entry.keywords ||
                    entry.keywords.length === 0)) ||

            (backfillColumns.includes('runtime') &&
                !entry.runtime) ||

            (backfillColumns.includes('release_date') &&
                !entry.tmdb_release_date) ||

            (backfillColumns.includes('imdb_id') &&
                !entry.imdb_id)
        ))
        .slice(0, maxResults);

    // === Nothing To Process ===
    if (entriesToBackfill.length === 0) {
        console.log(
            '✅ No entries found that need backfilling for selected columns'
        );

        return {
            total: 0,
            successful: 0,
            skipped: 0,
            failed: 0,
            updated: [],
            errors: []
        };
    }

    // === Print Header ===
    console.log(`\n${'═'.repeat(80)}`);
    console.log(`🚀 TMDB DATA BACKFILL`);
    console.log(`${'═'.repeat(80)}`);
    console.log(
        `📊 Entries to process: ${entriesToBackfill.length}/${movieData.length}`
    );
    console.log(
        `📋 Columns:            ${backfillColumns.join(', ')}`
    );
    console.log(
        `⏱️  Retry delay:        ${safeRetryDelay}ms`
    );
    console.log(
        `🏃 Dry run:             ${dryRun ? 'YES (no changes)' : 'NO (live changes)'}`
    );
    console.log(`${'═'.repeat(80)}\n`);

    // === Results ===
    const results = {
        total: entriesToBackfill.length,
        successful: 0,
        skipped: 0,
        failed: 0,
        updated: [],
        errors: []
    };

    // === Fields That Should Always Be Refreshed ===
    //
    // These values can change on TMDB over time.
    // Existing values are therefore refreshed when explicitly
    // requested through the selected columns.
    //
    const replaceFields = [
        'poster_url',
        'related_entries',
        'tmdb_vote_count',
        'tmdb_vote_average',
        'tmdb_collection_total_parts'
    ];

    // === Process Entries ===
    for (let i = 0; i < entriesToBackfill.length; i++) {
        const entry = entriesToBackfill[i];

        const progress =
            `[${(i + 1).toString().padStart(3)}/` +
            `${entriesToBackfill.length.toString().padStart(3)}]`;

        try {
            // === Rate Limiting ===
            if (i > 0) {
                await new Promise(resolve =>
                    setTimeout(resolve, safeRetryDelay)
                );
            }

            if (verbose) {
                console.log(
                    `${progress} Fetching: "${entry.Name}" ` +
                    `(TMDB: ${entry.tmdbId})`
                );
            }

            // === Determine Initial Media Type ===
            let mediaType =
                entry.tmdbMediaType ||
                (entry.Category === 'Series' ? 'tv' : 'movie');

            // === Fetch TMDB Details ===
            let detailData = await callTmdbApiDirect(
                `/${mediaType}/${entry.tmdbId}`,
                {
                    append_to_response:
                        'credits,keywords,collection,external_ids'
                }
            );

            // =========================================================
            // MOVIE ↔ TV FALLBACK
            // =========================================================
            //
            // If tmdbMediaType is missing and the first request fails,
            // try the opposite media type.
            //
            // Example:
            //
            // /movie/123  → fails
            // /tv/123     → succeeds
            //
            // Then save the correct media type.
            //
            if (!detailData && !entry.tmdbMediaType) {
                const fallbackMediaType =
                    mediaType === 'movie' ? 'tv' : 'movie';

                if (verbose) {
                    console.log(
                        `  ↻ First lookup failed. ` +
                        `Retrying as ${fallbackMediaType}...`
                    );
                }

                detailData = await callTmdbApiDirect(
                    `/${fallbackMediaType}/${entry.tmdbId}`,
                    {
                        append_to_response:
                            'credits,keywords,collection,external_ids'
                    }
                );

                if (detailData) {
                    mediaType = fallbackMediaType;

                    // Save the discovered media type
                    if (!dryRun) {
                        const entryIndex = movieData.findIndex(
                            m => m.id === entry.id
                        );

                        if (entryIndex !== -1) {
                            movieData[entryIndex].tmdbMediaType =
                                fallbackMediaType;
                        }
                    }

                    if (verbose) {
                        console.log(
                            `  ✓ Correct media type detected: ${mediaType}`
                        );
                    }
                }
            }

            // === No TMDB Data ===
            if (!detailData) {
                results.skipped++;

                if (verbose) {
                    console.log(`  ⚠️  No data received from TMDB`);
                }

                continue;
            }

            // === Extract TMDB Data ===
            const tmdbData = extractTmdbData(
                detailData,
                mediaType,
                backfillColumns
            );

            // =========================================================
            // DRY RUN
            // =========================================================
            if (dryRun) {
                const fields = [];

                if (backfillColumns.includes('category') &&
                    tmdbData.category) {
                    fields.push('category');
                }

                if (backfillColumns.includes('genre') &&
                    tmdbData.genre?.length > 0) {
                    fields.push('genre');
                }

                if (backfillColumns.includes('language') &&
                    tmdbData.language) {
                    fields.push('language');
                }

                if (backfillColumns.includes('year') &&
                    tmdbData.year) {
                    fields.push('year');
                }

                if (backfillColumns.includes('country') &&
                    tmdbData.country?.length > 0) {
                    fields.push('country');
                }

                if (backfillColumns.includes('description') &&
                    tmdbData.description) {
                    fields.push('description');
                }

                if (backfillColumns.includes('poster_url') &&
                    tmdbData.poster_url) {
                    fields.push('poster_url');
                }

                if (backfillColumns.includes('related_entries') &&
                    tmdbData.related_entries?.length > 0) {
                    fields.push('related_entries');
                }

                if (backfillColumns.includes('rating') &&
                    tmdbData.vote_average !== null &&
                    tmdbData.vote_average !== undefined) {
                    fields.push('rating');
                }

                if (backfillColumns.includes('vote_count') &&
                    tmdbData.vote_count !== null &&
                    tmdbData.vote_count !== undefined) {
                    fields.push('vote_count');
                }

                if (backfillColumns.includes('cast') &&
                    tmdbData.full_cast?.length > 0) {
                    fields.push('cast');
                }

                if (backfillColumns.includes('director') &&
                    tmdbData.director_info) {
                    fields.push('director');
                }

                if (backfillColumns.includes('collection') &&
                    tmdbData.collection_id) {
                    fields.push('collection');
                }

                if (backfillColumns.includes('companies') &&
                    tmdbData.production_companies?.length > 0) {
                    fields.push('companies');
                }

                if (backfillColumns.includes('keywords') &&
                    tmdbData.keywords?.length > 0) {
                    fields.push('keywords');
                }

                if (backfillColumns.includes('runtime') &&
                    tmdbData.runtime) {
                    fields.push('runtime');
                }

                if (backfillColumns.includes('release_date') &&
                    tmdbData.release_date) {
                    fields.push('release_date');
                }

                if (backfillColumns.includes('imdb_id') &&
                    tmdbData.imdb_id) {
                    fields.push('imdb_id');
                }

                results.successful++;

                if (verbose) {
                    console.log(
                        `  ✓ Would update: ${
                            fields.length > 0
                                ? fields.join(', ')
                                : 'nothing'
                        }`
                    );
                }

                continue;
            }

            // =========================================================
            // FIND CURRENT ENTRY
            // =========================================================
            const entryIndex = movieData.findIndex(
                m => m.id === entry.id
            );

            if (entryIndex === -1) {
                results.skipped++;

                if (verbose) {
                    console.log(`  ⚠️  Entry no longer exists`);
                }

                continue;
            }

            const currentEntry = movieData[entryIndex];
            const currentTimestamp = new Date().toISOString();
            const changedFields = [];

            // =========================================================
            // BASIC INFORMATION
            // =========================================================

            // Category — fill only if missing
            if (
                backfillColumns.includes('category') &&
                tmdbData.category &&
                !currentEntry.category
            ) {
                currentEntry.category = tmdbData.category;
                changedFields.push('category');
            }

            // Genre — fill only if missing
            if (
                backfillColumns.includes('genre') &&
                tmdbData.genre?.length > 0 &&
                (!currentEntry.genre ||
                    currentEntry.genre.length === 0)
            ) {
                currentEntry.genre = tmdbData.genre;
                changedFields.push('genre');
            }

            // Language — fill only if missing
            if (
                backfillColumns.includes('language') &&
                tmdbData.language &&
                !currentEntry.language
            ) {
                currentEntry.language = tmdbData.language;
                changedFields.push('language');
            }

            // Year — fill only if missing
            if (
                backfillColumns.includes('year') &&
                tmdbData.year &&
                !currentEntry.year
            ) {
                currentEntry.year = tmdbData.year;
                changedFields.push('year');
            }

            // Country — fill only if missing
            if (
                backfillColumns.includes('country') &&
                tmdbData.country?.length > 0 &&
                (!currentEntry.country ||
                    currentEntry.country.length === 0)
            ) {
                currentEntry.country = tmdbData.country;
                changedFields.push('country');
            }

            // Description — fill only if missing
            if (
                backfillColumns.includes('description') &&
                tmdbData.description &&
                !currentEntry.description
            ) {
                currentEntry.description = tmdbData.description;
                changedFields.push('description');
            }

            // =========================================================
            // POSTER
            // =========================================================

            if (
                backfillColumns.includes('poster_url') &&
                tmdbData.poster_url &&
                (
                    replaceFields.includes('poster_url') ||
                    !currentEntry.poster_url
                )
            ) {
                currentEntry.poster_url = tmdbData.poster_url;
                changedFields.push('poster_url');
            }

            // =========================================================
            // RELATED ENTRIES
            // =========================================================

            if (
                backfillColumns.includes('related_entries') &&
                tmdbData.related_entries?.length > 0 &&
                (
                    replaceFields.includes('related_entries') ||
                    !currentEntry.related_entries ||
                    currentEntry.related_entries.length === 0
                )
            ) {
                currentEntry.related_entries =
                    tmdbData.related_entries;

                changedFields.push('related_entries');
            }

            // =========================================================
            // RATING
            // =========================================================

            if (
                backfillColumns.includes('rating') &&
                tmdbData.vote_average !== null &&
                tmdbData.vote_average !== undefined
            ) {
                if (
                    replaceFields.includes('tmdb_vote_average') ||
                    !currentEntry.tmdb_vote_average
                ) {
                    currentEntry.tmdb_vote_average =
                        tmdbData.vote_average;

                    changedFields.push('rating');
                }
            }

            // =========================================================
            // VOTE COUNT
            // =========================================================

            if (
                backfillColumns.includes('vote_count') &&
                tmdbData.vote_count !== null &&
                tmdbData.vote_count !== undefined
            ) {
                if (
                    replaceFields.includes('tmdb_vote_count') ||
                    !currentEntry.tmdb_vote_count
                ) {
                    currentEntry.tmdb_vote_count =
                        tmdbData.vote_count;

                    changedFields.push('vote_count');
                }
            }

            // =========================================================
            // CAST
            // =========================================================

            if (
                backfillColumns.includes('cast') &&
                tmdbData.full_cast?.length > 0 &&
                (
                    !currentEntry.full_cast ||
                    currentEntry.full_cast.length === 0
                )
            ) {
                currentEntry.full_cast = tmdbData.full_cast;
                changedFields.push('cast');
            }

            // =========================================================
            // DIRECTOR
            // =========================================================

            if (
                backfillColumns.includes('director') &&
                tmdbData.director_info &&
                !currentEntry.director_info
            ) {
                currentEntry.director_info =
                    tmdbData.director_info;

                changedFields.push('director');
            }

            // =========================================================
            // COLLECTION
            // =========================================================

            if (
                backfillColumns.includes('collection') &&
                tmdbData.collection_id
            ) {
                // Collection doesn't exist yet
                if (!currentEntry.tmdb_collection_id) {
                    currentEntry.tmdb_collection_id =
                        tmdbData.collection_id;

                    currentEntry.tmdb_collection_name =
                        tmdbData.collection_name;

                    currentEntry.tmdb_collection_total_parts =
                        tmdbData.collection_total_parts;

                    changedFields.push('collection');
                }

                // Collection exists, but total parts may have changed
                else if (
                    replaceFields.includes(
                        'tmdb_collection_total_parts'
                    ) &&
                    tmdbData.collection_total_parts !== null &&
                    tmdbData.collection_total_parts !== undefined
                ) {
                    if (
                        currentEntry.tmdb_collection_total_parts !==
                        tmdbData.collection_total_parts
                    ) {
                        currentEntry.tmdb_collection_total_parts =
                            tmdbData.collection_total_parts;

                        changedFields.push(
                            'collection (total_parts)'
                        );
                    }
                }
            }

            // =========================================================
            // PRODUCTION COMPANIES
            // =========================================================

            if (
                backfillColumns.includes('companies') &&
                tmdbData.production_companies?.length > 0 &&
                (
                    !currentEntry.production_companies ||
                    currentEntry.production_companies.length === 0
                )
            ) {
                currentEntry.production_companies =
                    tmdbData.production_companies;

                changedFields.push('companies');
            }

            // =========================================================
            // KEYWORDS
            // =========================================================

            if (
                backfillColumns.includes('keywords') &&
                tmdbData.keywords?.length > 0 &&
                (
                    !currentEntry.keywords ||
                    currentEntry.keywords.length === 0
                )
            ) {
                currentEntry.keywords = tmdbData.keywords;
                changedFields.push('keywords');
            }

            // =========================================================
            // RUNTIME
            // =========================================================

            if (
                backfillColumns.includes('runtime') &&
                tmdbData.runtime &&
                !currentEntry.runtime
            ) {
                currentEntry.runtime = tmdbData.runtime;
                changedFields.push('runtime');
            }

            // =========================================================
            // RELEASE DATE
            // =========================================================

            if (
                backfillColumns.includes('release_date') &&
                tmdbData.release_date &&
                !currentEntry.tmdb_release_date
            ) {
                currentEntry.tmdb_release_date =
                    tmdbData.release_date;

                changedFields.push('release_date');
            }

            // =========================================================
            // IMDB ID
            // =========================================================

            if (
                backfillColumns.includes('imdb_id') &&
                tmdbData.imdb_id &&
                !currentEntry.imdb_id
            ) {
                currentEntry.imdb_id = tmdbData.imdb_id;
                changedFields.push('imdb_id');
            }

            // =========================================================
            // SAVE ENTRY CHANGES
            // =========================================================

            if (changedFields.length > 0) {
                currentEntry.lastModifiedDate =
                    currentTimestamp;

                if (currentEntry._sync_state !== 'new') {
                    currentEntry._sync_state = 'edited';
                }

                results.updated.push({
                    id: entry.id,
                    name: entry.Name,
                    fields: changedFields
                });

                results.successful++;

                if (verbose) {
                    console.log(
                        `  ✓ Updated: ${changedFields.join(', ')}`
                    );
                }
            } else {
                results.skipped++;

                if (verbose) {
                    console.log(`  ⊘ No new data to add`);
                }
            }

        } catch (error) {
            results.failed++;

            const errorMsg =
                `[${i + 1}/${entriesToBackfill.length}] ` +
                `"${entry.Name}": ${error.message}`;

            console.error(`  ❌ ${errorMsg}`);

            results.errors.push(errorMsg);
        }
    }

    // =============================================================
    // SAVE TO DATABASE & REFRESH UI
    // =============================================================

    if (!dryRun && results.successful > 0) {
        try {
            if (
                typeof recalculateAndApplyAllRelationships ===
                'function'
            ) {
                recalculateAndApplyAllRelationships();
            }

            if (typeof sortMovies === 'function') {
                sortMovies(
                    currentSortColumn,
                    currentSortDirection
                );
            }

            await saveToIndexedDB();

            if (window.globalStatsData) {
                window.globalStatsData = {};
            }

            if (
                typeof checkAndNotifyNewAchievements ===
                'function'
            ) {
                await checkAndNotifyNewAchievements();
            }

            if (typeof renderMovieCards === 'function') {
                renderMovieCards();
            }

            console.log(
                `\n✅ Data saved to local database and UI updated`
            );

        } catch (error) {
            console.error(
                `⚠️  Failed to save to database:`,
                error
            );
        }
    }

    // =============================================================
    // SUMMARY
    // =============================================================

    console.log(`\n${'═'.repeat(80)}`);
    console.log(`📋 BACKFILL SUMMARY`);
    console.log(`${'═'.repeat(80)}`);
    console.log(`Total Processed:  ${results.total}`);
    console.log(`✓ Successful:     ${results.successful}`);
    console.log(`⊘ Skipped:        ${results.skipped}`);
    console.log(`❌ Failed:        ${results.failed}`);
    console.log(
        `🔍 Mode:          ${dryRun ? 'DRY RUN (No changes)' : 'LIVE (Changes saved)'}`
    );
    console.log(`${'═'.repeat(80)}\n`);

    // === Updated Entries ===
    if (results.updated.length > 0 && !dryRun) {
        console.log(
            `📝 Updated Entries (${results.updated.length}):`
        );

        results.updated.slice(0, 10).forEach(item => {
            console.log(
                `  • "${item.name}" → ${item.fields.join(', ')}`
            );
        });

        if (results.updated.length > 10) {
            console.log(
                `  ... and ${results.updated.length - 10} more`
            );
        }
    }

    // === Errors ===
    if (results.errors.length > 0) {
        console.log(
            `\n⚠️  Errors (${results.errors.length}):`
        );

        results.errors.slice(0, 5).forEach(error => {
            console.log(`  • ${error}`);
        });

        if (results.errors.length > 5) {
            console.log(
                `  ... and ${results.errors.length - 5} more`
            );
        }
    }

    console.log(
        `\n💡 Next: Run comprehensiveSync() to sync to cloud`
    );

    return results;
}
async function backfillTmdbIds(options = {}) {
    const {
        dryRun = false,
        verbose = true,
        mediaType = 'multi', // 'movie', 'tv', or 'multi'
        retryDelay = DEFAULT_RETRY_DELAY,
        maxResults = 50
    } = options;

    // ------------------------------------------------------------
    // Configuration / validation
    // ------------------------------------------------------------

    const safeRetryDelay = Math.max(retryDelay, MIN_RETRY_DELAY);

    if (retryDelay !== safeRetryDelay && retryDelay > 0) {
        console.warn(
            `⚠️ retryDelay cannot be less than ${MIN_RETRY_DELAY}ms. ` +
            `Using ${safeRetryDelay}ms`
        );
    }

    if (!Array.isArray(movieData)) {
        console.error('❌ movieData is not available or not an array');

        return {
            total: 0,
            successful: 0,
            skipped: 0,
            failed: 0,
            updated: [],
            errors: []
        };
    }

    if (typeof window.callTmdbApiDirect !== 'function') {
        console.error(
            '❌ TMDB API function not available. Make sure tmdb.js is loaded'
        );

        return {
            total: 0,
            successful: 0,
            skipped: 0,
            failed: 0,
            updated: [],
            errors: []
        };
    }

    if (!['movie', 'tv', 'multi'].includes(mediaType)) {
        console.error(
            `❌ Invalid mediaType "${mediaType}". Use "movie", "tv", or "multi".`
        );

        return {
            total: 0,
            successful: 0,
            skipped: 0,
            failed: 0,
            updated: [],
            errors: []
        };
    }

    const safeMaxResults = Math.max(0, Number(maxResults) || 0);

    // ------------------------------------------------------------
    // Find entries that need TMDB IDs
    // ------------------------------------------------------------

    const entriesToBackfill = movieData
        .filter(entry =>
            entry &&
            !entry.tmdbId &&
            entry.Name &&
            entry.Year
        )
        .slice(0, safeMaxResults);

    if (entriesToBackfill.length === 0) {
        console.log('✅ No entries found that need TMDB ID backfill');

        return {
            total: 0,
            successful: 0,
            skipped: 0,
            failed: 0,
            updated: [],
            errors: []
        };
    }

    // ------------------------------------------------------------
    // Start log
    // ------------------------------------------------------------

    console.log(
        `\n${'═'.repeat(80)}\n` +
        `🔍 TMDB ID SEARCH & BACKFILL\n` +
        `${'═'.repeat(80)}\n` +
        `📝 Entries: ${entriesToBackfill.length}\n` +
        `🔍 Type: ${mediaType}\n` +
        `⏱️ Delay: ${safeRetryDelay}ms\n` +
        `🏃 Dry run: ${dryRun ? 'YES' : 'NO'}\n` +
        `${'═'.repeat(80)}\n`
    );

    const results = {
        total: entriesToBackfill.length,
        successful: 0,
        skipped: 0,
        failed: 0,
        updated: [],
        errors: []
    };

    // ------------------------------------------------------------
    // Process each entry
    // ------------------------------------------------------------

    for (let i = 0; i < entriesToBackfill.length; i++) {
        const entry = entriesToBackfill[i];

        try {
            // Rate limiting
            if (i > 0 && safeRetryDelay > 0) {
                await new Promise(resolve =>
                    setTimeout(resolve, safeRetryDelay)
                );
            }

            const progress =
                `[${String(i + 1).padStart(3)}/${entriesToBackfill.length}]`;

            if (verbose) {
                console.log(
                    `${progress} Searching: "${entry.Name}" (${entry.Year})`
                );
            }

            // --------------------------------------------------------
            // Build correct TMDB search parameters
            // --------------------------------------------------------

            const searchParams = {
                query: String(entry.Name).trim()
            };

            if (mediaType === 'movie') {
                searchParams.primary_release_year = entry.Year;
            } else if (mediaType === 'tv') {
                searchParams.first_air_date_year = entry.Year;
            }

            // IMPORTANT:
            // /search/multi does not support movie/tv year parameters.
            // We therefore search by name and use match scoring below.
            const searchResults = await window.callTmdbApiDirect(
                `/search/${mediaType}`,
                searchParams
            );

            if (
                !searchResults ||
                !Array.isArray(searchResults.results) ||
                searchResults.results.length === 0
            ) {
                if (verbose) {
                    console.log(`  ⚠️ No results found`);
                }

                results.skipped++;
                continue;
            }

            // --------------------------------------------------------
            // Find the BEST result instead of blindly using results[0]
            // --------------------------------------------------------

            const candidates = searchResults.results
                .filter(result =>
                    result &&
                    result.id &&
                    (
                        mediaType !== 'multi' ||
                        result.media_type === 'movie' ||
                        result.media_type === 'tv'
                    )
                )
                .map(result => {
                    const resultTitle =
                        result.title ||
                        result.name ||
                        '';

                    const resultYear =
                        result.release_date
                            ? new Date(result.release_date).getFullYear()
                            : result.first_air_date
                                ? new Date(result.first_air_date).getFullYear()
                                : null;

                    const matchScore = calculateMatchScore(
                        entry.Name,
                        entry.Year,
                        resultTitle,
                        resultYear
                    );

                    return {
                        result,
                        resultTitle,
                        resultYear,
                        matchScore
                    };
                })
                .sort((a, b) => b.matchScore - a.matchScore);

            if (candidates.length === 0) {
                if (verbose) {
                    console.log(`  ⚠️ No usable movie/TV results found`);
                }

                results.skipped++;
                continue;
            }

            const bestMatch = candidates[0];

            const topResult = bestMatch.result;
            const resultTitle = bestMatch.resultTitle;
            const resultYear = bestMatch.resultYear;
            const matchScore = bestMatch.matchScore;
            const tmdbId = topResult.id;

            if (verbose) {
                console.log(
                    `  ✓ Best match: "${resultTitle}" ` +
                    `(${resultYear || 'N/A'}) - ` +
                    `ID: ${tmdbId} - ` +
                    `Match: ${matchScore.toFixed(1)}%`
                );
            }

            // --------------------------------------------------------
            // Prepare result information
            // --------------------------------------------------------

            const resultInfo = {
                id: entry.id,
                name: entry.Name,
                year: entry.Year,
                tmdbId: tmdbId,
                matchScore: matchScore
            };

            // --------------------------------------------------------
            // DRY RUN
            // --------------------------------------------------------

            if (dryRun) {
                results.updated.push(resultInfo);
                results.successful++;
                continue;
            }

            // --------------------------------------------------------
            // LIVE UPDATE
            // --------------------------------------------------------

            const entryIndex = movieData.findIndex(
                movie => movie.id === entry.id
            );

            if (entryIndex === -1) {
                results.failed++;

                const errorMsg =
                    `${progress} Entry disappeared before update: ` +
                    `"${entry.Name}" (${entry.Year})`;

                console.error(`  ❌ ${errorMsg}`);
                results.errors.push(errorMsg);

                continue;
            }

            const currentTimestamp = new Date().toISOString();

            // Only modify these TMDB-related fields.
            // All other existing fields remain untouched.
            movieData[entryIndex].tmdbId = tmdbId;
            movieData[entryIndex].tmdbMatchScore = matchScore;
            movieData[entryIndex].tmdbSearchDate = currentTimestamp;
            movieData[entryIndex].lastModifiedDate = currentTimestamp;

            // Preserve existing sync behavior.
            if (movieData[entryIndex]._sync_state !== 'new') {
                movieData[entryIndex]._sync_state = 'edited';
            }

            results.updated.push(resultInfo);
            results.successful++;

        } catch (error) {
            results.failed++;

            const errorMessage =
                error && error.message
                    ? error.message
                    : String(error);

            const errorMsg =
                `[${i + 1}/${entriesToBackfill.length}] ` +
                `"${entry.Name}" (${entry.Year}): ${errorMessage}`;

            console.error(`  ❌ ${errorMsg}`);
            results.errors.push(errorMsg);
        }
    }

    // ------------------------------------------------------------
    // Save / update application
    // ------------------------------------------------------------

    if (!dryRun && results.successful > 0) {
        try {
            if (
                typeof recalculateAndApplyAllRelationships === 'function'
            ) {
                recalculateAndApplyAllRelationships();
            }

            if (typeof sortMovies === 'function') {
                sortMovies(
                    currentSortColumn,
                    currentSortDirection
                );
            }

            await saveToIndexedDB();

            if (window.globalStatsData) {
                window.globalStatsData = {};
            }

            if (
                typeof checkAndNotifyNewAchievements === 'function'
            ) {
                await checkAndNotifyNewAchievements();
            }

            if (typeof renderMovieCards === 'function') {
                renderMovieCards();
            }

            console.log(
                `\n✅ Data saved to local database and UI updated`
            );

        } catch (error) {
            console.error(
                `⚠️ Failed to save to local database:`,
                error
            );
        }
    }

    // ------------------------------------------------------------
    // Summary
    // ------------------------------------------------------------

    console.log(
        `\n${'═'.repeat(80)}\n` +
        `📋 BACKFILL RESULTS\n` +
        `${'═'.repeat(80)}\n` +
        `Total:   ${results.total}\n` +
        `✓ Success: ${results.successful}\n` +
        `⊘ Skipped: ${results.skipped}\n` +
        `❌ Failed:  ${results.failed}\n` +
        `🔍 Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}\n` +
        `${'═'.repeat(80)}\n`
    );

    if (results.updated.length > 0) {
        console.log(
            `📝 ${dryRun ? 'Would update' : 'Updated'} ` +
            `${results.updated.length} entries:`
        );

        results.updated.slice(0, 10).forEach(item => {
            console.log(
                `  • "${item.name}" (${item.year}) → ` +
                `${item.tmdbId} ` +
                `(${item.matchScore.toFixed(1)}%)`
            );
        });

        if (results.updated.length > 10) {
            console.log(
                `  ... +${results.updated.length - 10} more`
            );
        }
    }

    if (results.errors.length > 0) {
        console.log(`\n⚠️ Errors:`);

        results.errors.slice(0, 5).forEach(error => {
            console.log(`  • ${error}`);
        });

        if (results.errors.length > 5) {
            console.log(
                `  ... +${results.errors.length - 5} more`
            );
        }
    }

    console.log(
        '\n💡 Next: Run backfillTmdbData() to fill other fields\n'
    );

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

    const total = movieData.length;

    const withTmdbId = movieData.filter(entry => entry.tmdbId);
    const withoutTmdbId = movieData.filter(entry => !entry.tmdbId);

    const withoutNameYear = withoutTmdbId.filter(
        entry => !entry.Name || !entry.Year
    );

    const searchable = withoutTmdbId.length - withoutNameYear.length;
    const unsearchable = withoutNameYear.length;

    const missingRating = withTmdbId.filter(
        e => !e.tmdb_vote_average
    ).length;

    const missingCast = withTmdbId.filter(
        e => !e.full_cast || e.full_cast.length === 0
    ).length;

    const missingDirector = withTmdbId.filter(
        e => !e.director_info
    ).length;

    const missingCollection = withTmdbId.filter(
        e => !e.tmdb_collection_id
    ).length;

    const missingCompanies = withTmdbId.filter(
        e => !e.production_companies ||
             e.production_companies.length === 0
    ).length;

    const percentage = (value, totalValue) =>
        totalValue > 0
            ? ((value / totalValue) * 100).toFixed(1)
            : '0.0';

    const completeRating = withTmdbId.length - missingRating;
    const completeCast = withTmdbId.length - missingCast;
    const completeDirector = withTmdbId.length - missingDirector;
    const completeCollection = withTmdbId.length - missingCollection;
    const completeCompanies = withTmdbId.length - missingCompanies;

    console.log(
        `\n${'═'.repeat(80)}\n` +
        `📊 BACKFILL STATUS\n` +
        `${'═'.repeat(80)}\n` +

        `🆔 TMDB IDs:\n` +
        `  Total: ${total}\n` +
        `  ✓ With ID: ${withTmdbId.length} ` +
        `(${percentage(withTmdbId.length, total)}%)\n` +
        `  ❌ Missing: ${withoutTmdbId.length}\n` +
        `     └─ Searchable: ${searchable}\n` +
        `     └─ Unsearchable: ${unsearchable}\n\n` +

        `📋 DATA (${withTmdbId.length} entries):\n` +

        `  ⭐ Rating: ${completeRating}/${withTmdbId.length} ` +
        `(${percentage(completeRating, withTmdbId.length)}%)\n` +

        `  👥 Cast: ${completeCast}/${withTmdbId.length} ` +
        `(${percentage(completeCast, withTmdbId.length)}%)\n` +

        `  🎬 Director: ${completeDirector}/${withTmdbId.length} ` +
        `(${percentage(completeDirector, withTmdbId.length)}%)\n` +

        `  🎞️ Collection: ${completeCollection}/${withTmdbId.length} ` +
        `(${percentage(completeCollection, withTmdbId.length)}%)\n` +

        `  🏢 Companies: ${completeCompanies}/${withTmdbId.length} ` +
        `(${percentage(completeCompanies, withTmdbId.length)}%)\n` +

        `\n${'═'.repeat(80)}\n`
    );

    return {
        total,
        withTmdbId: withTmdbId.length,
        withoutTmdbId: withoutTmdbId.length,

        searchable,
        unsearchable,

        missingData: {
            rating: missingRating,
            cast: missingCast,
            director: missingDirector,
            collection: missingCollection,
            companies: missingCompanies
        }
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
