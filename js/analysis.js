/* analysis.js */
// START CHUNK: Comprehensive Statistics Engine
function calculateAllStatistics(currentMovieData) {
    if (!Array.isArray(currentMovieData) || currentMovieData.length === 0) {
        return {}; // Return empty object if no data
    }

    const stats = {};
    const achievementData = {};
    let totalWatchTimeMinutes = 0;
    let toWatchTotalMinutes = 0;

    const isWatchedOrContinue = (movie) => movie.Status === 'Watched' || movie.Status === 'Continue';
    // Helper for strict "Watched" status
    const isStrictlyWatched = (movie) => movie.Status === 'Watched';

    // --- Single Pass Data Aggregation ---
    const categoryCounts = {}, statusCounts = {}, overallRatingCounts = {}, watchInstanceRatingCounts = {};
    const singleGenreCounts = {}, watchedGenreCounts = {}, genreRatingsSum = {}, genreRatedEntriesCount = {};
    const countryCounts = {}, languageCounts = {};
    const actorCounts = {}, directorCounts = {}, productionCompanyCounts = {}, tmdbCollectionCounts = {};
    const watchesByYear = {}, watchesByMonth = {}, rewatchCountsPerTitle = {}, weekendCounts = {};
    const genreCombinationsCounts = {}, categoryRatingsSum = {}, categoryRatedEntriesCount = {}, studioRatingsSum = {}, studioRatedEntriesCount = {};
    
    const uniqueGenresWatched = new Set(), uniqueCountriesWatched = new Set(), uniqueLanguagesWatched = new Set(), uniqueDecadesWatched = new Set();
    const allWatchInstances = [];
    
    let ratedTitlesCount = 0, highlyRecCount = 0, fiveStarCount = 0, longSeriesCount = 0;
    let pre1980Count = 0, recent5YearsCount = 0, detailedDescriptionCount = 0, manualLinksCount = 0, hiddenGemCount = 0;
    const currentYear = new Date().getFullYear();
    const directorWatchCounts = new Map(), studioWatchCounts = new Map();
    const genreWatchesByDate = {}; // For short-term streak
    
    // Special Title Trackers
    let yourNameWatched = false;

    currentMovieData.forEach(movie => {
        if (!movie || !movie.id) return;

        // --- REFINED: Total Watch Time Calculation ---
        const watchHistoryCount = Array.isArray(movie.watchHistory) ? movie.watchHistory.length : 0;
        
        if (movie.Category === 'Series') {
            // For Series, count its runtime only ONCE, based on its status.
            if (movie.Status === 'Watched' && movie.runtime && typeof movie.runtime === 'object' && movie.runtime.episodes && movie.runtime.episode_run_time) {
                totalWatchTimeMinutes += movie.runtime.episodes * movie.runtime.episode_run_time;
            } else if (movie.Status === 'Continue' && movie.runtime && typeof movie.runtime === 'object' && typeof movie.seasonsCompleted === 'number' && typeof movie.currentSeasonEpisodesWatched === 'number') {
                const { seasons, episodes, episode_run_time: episodeRunTime } = movie.runtime;
                if (seasons > 0 && episodes > 0 && episodeRunTime > 0) {
                    const avgEpisodesPerSeason = episodes / seasons;
                    const totalEpisodesWatched = (movie.seasonsCompleted * avgEpisodesPerSeason) + movie.currentSeasonEpisodesWatched;
                    totalWatchTimeMinutes += totalEpisodesWatched * episodeRunTime;
                }
            }
        } else {
            // For Movies/Docs/Specials: If 'Watched', count runtime at least once.
            // If multiple watch instances exist, count for each one.
            if (movie.Status === 'Watched' && typeof movie.runtime === 'number' && movie.runtime > 0) {
                const multiplier = Math.max(1, watchHistoryCount);
                totalWatchTimeMinutes += movie.runtime * multiplier;
            }
        }

        // --- "To Watch" list runtime calculation ---
        if (movie.Status === 'To Watch') {
            if (movie.Category === 'Series' && movie.runtime && typeof movie.runtime === 'object' && movie.runtime.episodes && movie.runtime.episode_run_time) {
                toWatchTotalMinutes += movie.runtime.episodes * movie.runtime.episode_run_time;
            } else if (typeof movie.runtime === 'number' && movie.runtime > 0) {
                toWatchTotalMinutes += movie.runtime;
            }
        }

        categoryCounts[movie.Category || 'N/A'] = (categoryCounts[movie.Category || 'N/A'] || 0) + 1;
        statusCounts[movie.Status || 'N/A'] = (statusCounts[movie.Status || 'N/A'] || 0) + 1;
        if(movie.Description && movie.Description.length > 30) detailedDescriptionCount++;
        if(Array.isArray(movie.relatedEntries)) manualLinksCount += movie.relatedEntries.length;

        // Special Title Checks
        if (isWatchedOrContinue(movie)) {
            const titleLower = (movie.Name || '').toLowerCase().trim();
            if (titleLower === 'your name' || titleLower === 'your name.' || titleLower === 'kimi no na wa' || titleLower === 'kimi no na wa.') {
                yourNameWatched = true;
            }
        }

        if (isWatchedOrContinue(movie)) {
            const overallRatingKey = (movie.overallRating && String(movie.overallRating).trim() !== '') ? String(movie.overallRating) : 'N/A';
            if (overallRatingKey !== 'N/A') {
                ratedTitlesCount++;
                if (overallRatingKey === '5') fiveStarCount++;
                const categoryKey = movie.Category || 'N/A';
                categoryRatingsSum[categoryKey] = (categoryRatingsSum[categoryKey] || 0) + parseFloat(movie.overallRating);
                categoryRatedEntriesCount[categoryKey] = (categoryRatedEntriesCount[categoryKey] || 0) + 1;
            }
            if (movie.Recommendation === 'Highly Recommended') highlyRecCount++;
            
            if (movie.Category === 'Series' && movie.runtime && typeof movie.runtime === 'object') {
                const numEps = movie.runtime.episodes || 0;
                if(movie.runtime.seasons >= 3 || numEps >= 40) longSeriesCount++;
            }

            if (movie.Genre) {
                const genres = movie.Genre.split(',').map(g => g.trim()).filter(Boolean);
                if (genres.length > 1) {
                    const combinationKey = genres.sort().join(', ');
                    genreCombinationsCounts[combinationKey] = (genreCombinationsCounts[combinationKey] || 0) + 1;
                }
                genres.forEach(g => {
                    singleGenreCounts[g] = (singleGenreCounts[g] || 0) + 1;
                    watchedGenreCounts[g] = (watchedGenreCounts[g] || 0) + 1;
                    uniqueGenresWatched.add(g);
                    if (overallRatingKey !== 'N/A') {
                        genreRatingsSum[g] = (genreRatingsSum[g] || 0) + parseFloat(movie.overallRating);
                        genreRatedEntriesCount[g] = (genreRatedEntriesCount[g] || 0) + 1;
                    }
                });
            }

            // Only count countries and languages if status is "Watched" for achievements
            if (isStrictlyWatched(movie)) {
                if (movie.Country) movie.Country.split(',').map(c => c.trim()).filter(Boolean).forEach(c => { countryCounts[c] = (countryCounts[c] || 0) + 1; uniqueCountriesWatched.add(c); });
                if (movie.Language) movie.Language.split(',').map(l => l.trim()).filter(Boolean).forEach(l => { languageCounts[l] = (languageCounts[l] || 0) + 1; uniqueLanguagesWatched.add(l); });
            }
            
            if (movie.Year) {
                const yearNum = parseInt(movie.Year, 10);
                if(!isNaN(yearNum)) {
                    if (isStrictlyWatched(movie)) {
                         uniqueDecadesWatched.add(Math.floor(yearNum / 10) * 10);
                         if(yearNum < 1980) pre1980Count++;
                         // Fixed logic: Recent 5 years calculation
                         if(yearNum >= (currentYear - 5)) recent5YearsCount++;
                    }
                }
            }
            
            if (Array.isArray(movie.full_cast)) movie.full_cast.slice(0, 10).forEach(p => { if (p && p.name) actorCounts[p.name] = (actorCounts[p.name] || 0) + 1; });
            if (movie.director_info && movie.director_info.name) {
                directorCounts[movie.director_info.name] = (directorCounts[movie.director_info.name] || 0) + 1;
                directorWatchCounts.set(movie.director_info.name, (directorWatchCounts.get(movie.director_info.name) || 0) + 1);
            }
            if (Array.isArray(movie.production_companies)) movie.production_companies.slice(0, 5).forEach(c => {
                if (c && c.name) {
                    productionCompanyCounts[c.name] = (productionCompanyCounts[c.name] || 0) + 1;
                    studioWatchCounts.set(c.name, (studioWatchCounts.get(c.name) || 0) + 1);
                    if (overallRatingKey !== 'N/A') {
                        studioRatingsSum[c.name] = (studioRatingsSum[c.name] || 0) + parseFloat(movie.overallRating);
                        studioRatedEntriesCount[c.name] = (studioRatedEntriesCount[c.name] || 0) + 1;
                    }
                }
            });

            if(movie.tmdb_collection_id) tmdbCollectionCounts[movie.tmdb_collection_id] = (tmdbCollectionCounts[movie.tmdb_collection_id] || 0) + 1;
            if (movie.tmdb_vote_count < 1000 && movie.tmdb_vote_average > 7.0) hiddenGemCount++;
            overallRatingCounts[overallRatingKey] = (overallRatingCounts[overallRatingKey] || 0) + 1;
        }

        if (watchHistoryCount > 0) {
            // Only count rewatches for Movies (Category not Series)
            if (movie.Category !== 'Series') {
                rewatchCountsPerTitle[movie.id] = watchHistoryCount;
            }

            movie.watchHistory.forEach(wh => {
                if (!wh || !wh.date) return;
                try {
                    const d = new Date(wh.date);
                    if (isNaN(d.getTime())) return;
                    const dateStr = d.toISOString().slice(0, 10);
                    allWatchInstances.push({ date: dateStr, genre: movie.Genre, time: d.getHours(), movie: movie });

                    const ratingKey = (wh.rating && String(wh.rating).trim() !== '') ? String(wh.rating) : 'N/A';
                    watchInstanceRatingCounts[ratingKey] = (watchInstanceRatingCounts[ratingKey] || 0) + 1;

                    const y = d.getFullYear().toString();
                    const ymISO = `${y}-${(d.getMonth() + 1).toString().padStart(2, '0')}`;
                    watchesByYear[y] = watchesByYear[y] || { instances: 0, titles: new Set(), ratingsSum: 0, ratedCount: 0 };
                    watchesByYear[y].instances++; watchesByYear[y].titles.add(movie.Name);
                    if (ratingKey !== 'N/A') { watchesByYear[y].ratingsSum += parseFloat(wh.rating); watchesByYear[y].ratedCount++; }
                    
                    watchesByMonth[ymISO] = watchesByMonth[ymISO] || { instances: 0, titles: new Set(), month_year_iso: ymISO, month_year_label: `${d.toLocaleString('default', { month: 'short' })} ${y}`, ratingsSum: 0, ratedCount: 0 };
                    watchesByMonth[ymISO].instances++; watchesByMonth[ymISO].titles.add(movie.Name);
                    if (ratingKey !== 'N/A') {
                        watchesByMonth[ymISO].ratingsSum += parseFloat(wh.rating);
                        watchesByMonth[ymISO].ratedCount++;
                    }
                    
                    const dayOfWeek = d.getDay();
                    if (dayOfWeek === 0 || dayOfWeek === 6) {
                        const sat = new Date(d);
                        if (dayOfWeek === 0) sat.setDate(d.getDate() - 1);
                        const weekendIdentifier = sat.toISOString().slice(0, 10);
                        weekendCounts[weekendIdentifier] = (weekendCounts[weekendIdentifier] || 0) + 1;
                    }
                    
                    if(movie.Genre) {
                        movie.Genre.split(',').map(g=>g.trim()).forEach(g => {
                            if(!genreWatchesByDate[g]) genreWatchesByDate[g] = new Set();
                            genreWatchesByDate[g].add(dateStr);
                        });
                    }
                } catch(e) { console.warn(`Could not parse watch history date for entry "${movie.Name}": ${wh.date}`); }
            });
        }
    });

    achievementData.total_entries = currentMovieData.length;
    achievementData.total_titles_watched = currentMovieData.filter(isWatchedOrContinue).length;
    achievementData.distinct_titles_rewatched = Object.values(rewatchCountsPerTitle).filter(c => c > 1).length;
    achievementData.single_title_rewatch_count = Math.max(0, ...Object.values(rewatchCountsPerTitle));
    achievementData.category_watched_count = {};
    Object.keys(categoryCounts).forEach(cat => { achievementData.category_watched_count[cat] = currentMovieData.filter(m => isWatchedOrContinue(m) && m.Category === cat).length; });
    achievementData.long_series_watched_count = longSeriesCount;
    achievementData.genre_watched_count = watchedGenreCounts;
    achievementData.genre_variety_count = uniqueGenresWatched.size;
    achievementData.rated_titles_count = ratedTitlesCount;
    achievementData.specific_rating_count = { '5': fiveStarCount };
    achievementData.recommendation_level_count = { 'Highly Recommended': highlyRecCount };
    achievementData.decade_variety_count = uniqueDecadesWatched.size;
    achievementData.pre_year_watched_count = pre1980Count;
    achievementData.recent_years_watched_count = recent5YearsCount;
    achievementData.status_count = statusCounts;
    achievementData.status_count_active = { 'Continue': statusCounts['Continue'] || 0 };
    achievementData.weekend_watch_streak = Math.max(0, ...Object.values(weekendCounts));
    
    const sortedDates = [...new Set(allWatchInstances.map(wi => wi.date))].sort();
    let maxStreak = 0, currentStreak = 0;
    if(sortedDates.length > 0) {
        maxStreak = 1; currentStreak = 1;
        for (let i = 1; i < sortedDates.length; i++) {
            const date1 = new Date(sortedDates[i-1]);
            const date2 = new Date(sortedDates[i]);
            const diffTime = Math.abs(date2 - date1);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            if (diffDays === 1) currentStreak++; else currentStreak = 1;
            if (currentStreak > maxStreak) maxStreak = currentStreak;
        }
    }
    achievementData.consecutive_daily_watch_streak = maxStreak;

    achievementData.country_variety_count = uniqueCountriesWatched.size;
    achievementData.language_variety_count = uniqueLanguagesWatched.size;
    achievementData.time_of_day_watch = {
        night: allWatchInstances.filter(wi => wi.time >= 0 && wi.time < 4).length,
        early_morning: allWatchInstances.filter(wi => wi.time >= 5 && wi.time < 8).length,
    };
    achievementData.detailed_description_count = detailedDescriptionCount;
    achievementData.tmdb_collection_streak_count = Math.max(0, ...Object.values(tmdbCollectionCounts));
    achievementData.director_streak_count = Math.max(0, ...directorWatchCounts.values());
    achievementData.studio_streak_count = Math.max(0, ...studioWatchCounts.values());
    achievementData.manual_links_count = Math.floor(manualLinksCount / 2);
    
    let themedSpreeCount = 0;
    for(const genre in genreWatchesByDate) {
        const dates = Array.from(genreWatchesByDate[genre]).sort();
        if(dates.length < 3) continue;
        for(let i=0; i <= dates.length - 3; i++) {
            const firstDate = new Date(dates[i]);
            const thirdDate = new Date(dates[i+2]);
            if((thirdDate - firstDate) / (1000 * 3600 * 24) <= 7) {
                themedSpreeCount++; break;
            }
        }
    }
    achievementData.genre_streak_short_term = themedSpreeCount;
    achievementData.hidden_gem_count = hiddenGemCount;
    achievementData.special_title_watch = {
        your_name: yourNameWatched ? 1 : 0
    };

    achievementData.active_days_count = JSON.parse(localStorage.getItem('app_usage_dates_achievement') || '[]').length;
    achievementData.sync_count = parseInt(localStorage.getItem('sync_count_achievement') || '0');
    achievementData.stats_modal_opened_count = parseInt(localStorage.getItem('stats_modal_opened_count') || '0');
    achievementData.daily_recommendation_watched_count = parseInt(localStorage.getItem('daily_rec_watched_achievement') || '0');

    // --- Final Stats Object Construction ---
    stats.achievementData = achievementData;
    stats.totalEntries = achievementData.total_entries;
    stats.totalTitlesWatched = achievementData.total_titles_watched;

    // Return raw minutes for flexible formatting in the UI
    stats.totalWatchTimeMinutes = totalWatchTimeMinutes;
    stats.toWatchTotalMinutes = toWatchTotalMinutes;
    
    const formatCounts = (countsObj) => Object.entries(countsObj).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));
    stats.categories = formatCounts(categoryCounts);
    stats.statuses = formatCounts(statusCounts);
    
    const totalRatedSum = Object.entries(overallRatingCounts).reduce((sum, [rating, count]) => rating !== 'N/A' ? sum + (parseFloat(rating) * count) : sum, 0);
    const totalRatedCount = Object.entries(overallRatingCounts).reduce((sum, [rating, count]) => rating !== 'N/A' ? sum + count : sum, 0);
    stats.avgOverallRating = totalRatedCount > 0 ? (totalRatedSum / totalRatedCount).toFixed(2) : 'N/A';
    stats.totalWatchInstances = allWatchInstances.length;
    stats.topRatedGenresOverall = Object.keys(genreRatedEntriesCount).map(g => ({ label: g, value: (genreRatingsSum[g] / genreRatedEntriesCount[g]).toFixed(2), count: genreRatedEntriesCount[g] })).filter(g => g.count > 1).sort((a,b) => b.value - a.value || b.count - a.count);
    stats.watchesByYear = Object.entries(watchesByYear).map(([year, data]) => ({ year, instances: data.instances, unique_titles: data.titles.size, avg_rating: data.ratedCount > 0 ? (data.ratingsSum / data.ratedCount).toFixed(2) : 'N/A' })).sort((a,b) => b.year - a.year);

    // **FIXED**: Correctly calculate the size of the unique titles set.
    stats.watchesByMonth = Object.values(watchesByMonth)
        .map(monthData => ({
            ...monthData,
            unique_titles: monthData.titles.size 
        }))
        .sort((a, b) => new Date(b.month_year_iso) - new Date(a.month_year_iso));

    stats.avgRatingByMonth = Object.values(watchesByMonth).filter(m => m.ratedCount > 0).map(m => ({ label: m.month_year_label, value: (m.ratingsSum / m.ratedCount).toFixed(2), iso: m.month_year_iso })).sort((a, b) => new Date(a.iso) - new Date(b.iso));
    stats.topSingleGenres = formatCounts(watchedGenreCounts);
    stats.genreCombinations = formatCounts(genreCombinationsCounts).filter(c => c.value > 1);
    const sortRatings = (a, b) => (b.rating === 'N/A' ? -1 : parseFloat(b.rating)) - (a.rating === 'N/A' ? -1 : parseFloat(a.rating));
    stats.overallRatingDistributionData = Object.entries(overallRatingCounts).map(([rating, count]) => ({ label: getRatingTextLabel(rating), value: count, rating })).sort(sortRatings);
    stats.watchInstanceRatingDistributionData = Object.entries(watchInstanceRatingCounts).map(([rating, count]) => ({ label: getRatingTextLabel(rating), value: count, rating })).sort(sortRatings);
    stats.avgOverallRatingByCategory = Object.keys(categoryRatedEntriesCount).map(c => ({ label: c, value: `${(categoryRatingsSum[c] / categoryRatedEntriesCount[c]).toFixed(2)} avg (${categoryRatedEntriesCount[c]})`})).sort((a,b) => a.label.localeCompare(b.label));
    stats.mostWatchedActors = formatCounts(actorCounts);
    stats.mostWatchedDirectors = formatCounts(directorCounts);
    stats.mostFrequentProductionCompanies = formatCounts(productionCompanyCounts);
    stats.avgRatingByStudio = Object.keys(studioRatedEntriesCount).filter(s => studioRatedEntriesCount[s] >= 2).map(s => ({ label: s, value: (studioRatingsSum[s] / studioRatedEntriesCount[s]).toFixed(2), count: studioRatedEntriesCount[s] })).sort((a,b) => b.value - a.value || b.count - a.count);
    stats.topCountries = Object.entries(countryCounts).map(([code, count]) => ({ label: getCountryFullName(code), value: count })).sort((a,b) => b.value - a.value || a.label.localeCompare(b.label));
    stats.topLanguages = formatCounts(languageCounts);
    
    // --- Pace & Prediction Calculations ---
    const now = new Date();
    const calculatePace = (days) => {
        const cutoffDate = new Date(now.getTime() - (days * 24 * 60 * 60 * 1000));
        let minutesInPeriod = 0;
        allWatchInstances.filter(wi => new Date(wi.date) >= cutoffDate).forEach(wi => {
            const movie = wi.movie;
            if (!movie) return;
            if (movie.Category === 'Series') { /* Series are not re-counted in pace for rewatches */ } 
            else if (typeof movie.runtime === 'number' && movie.runtime > 0) {
                minutesInPeriod += movie.runtime;
            }
        });
        return minutesInPeriod / days;
    };
    
    const pace30 = calculatePace(30);
    const pace90 = calculatePace(90);
    const pace365 = calculatePace(365);

    const getPredictionDays = (pace) => {
        if (pace <= 0 || toWatchTotalMinutes <= 0) return null;
        return toWatchTotalMinutes / pace;
    };

    stats.estimatedCompletionTimeMinutes = toWatchTotalMinutes;
    stats.completionPredictionDays30 = getPredictionDays(pace30);
    stats.completionPredictionDays90 = getPredictionDays(pace90);
    stats.completionPredictionDays365 = getPredictionDays(pace365);

    // --- Watchlist Growth Calculation ---
    try {
        const log = JSON.parse(localStorage.getItem('watchlistActivityLog_v1') || '[]');
        if(Array.isArray(log)) {
            const cutoffDate30 = new Date(now.getTime() - (30 * 24 * 60 * 60 * 1000));
            const dailyChanges = {};
            let netChange = 0;
            
            for (let i = 29; i >= 0; i--) {
                const date = new Date(now.getTime() - (i * 24 * 60 * 60 * 1000));
                const dateStr = date.toISOString().slice(0, 10);
                dailyChanges[dateStr] = 0;
            }

            log.forEach(item => {
                if (new Date(item.date) >= cutoffDate30) {
                    if (dailyChanges[item.date] !== undefined) {
                        dailyChanges[item.date] += (item.type === 'completed' ? -1 : 1);
                    }
                }
            });

            const chartLabels = [], chartData = [];
            let cumulativeChange = 0;
            Object.keys(dailyChanges).sort().forEach(dateStr => {
                cumulativeChange += dailyChanges[dateStr];
                chartLabels.push(new Date(dateStr).toLocaleDateString(undefined, {month: 'short', day: 'numeric'}));
                chartData.push(cumulativeChange);
                netChange += dailyChanges[dateStr];
            });

            stats.watchlistGrowth30 = `${netChange >= 0 ? '+' : ''}${netChange} items`;
            stats.watchlistGrowthChartData = { labels: chartLabels, data: chartData };
        } else {
            stats.watchlistGrowth30 = "N/A";
            stats.watchlistGrowthChartData = null;
        }
    } catch(e) {
        stats.watchlistGrowth30 = "N/A";
        stats.watchlistGrowthChartData = null;
    }

    // --- Normalized Pace Calculation ---
    const getNormalizedPaceData = (days) => {
        const cutoffDate = new Date(now.getTime() - (days * 24 * 60 * 60 * 1000));
        const relevantInstances = allWatchInstances.filter(wi => new Date(wi.date) >= cutoffDate);
        const bins = Array(10).fill(0);
        
        relevantInstances.forEach(wi => {
            const dayIndex = Math.floor((new Date(wi.date) - cutoffDate) / (1000 * 60 * 60 * 24));
            const binIndex = Math.min(9, Math.floor(dayIndex / (days / 10)));
            bins[binIndex]++;
        });

        for (let i = 1; i < bins.length; i++) {
            bins[i] += bins[i-1];
        }
        return [0, ...bins]; // Start at 0
    };

    stats.normalizedPaceData = {
        labels: ['Start', '10%', '20%', '30%', '40%', '50%', '60%', '70%', '80%', '90%', 'End'],
        datasets: [
            { label: 'Last 30 Days', data: getNormalizedPaceData(30) },
            { label: 'Last 90 Days', data: getNormalizedPaceData(90) },
            { label: 'Last 365 Days', data: getNormalizedPaceData(365) }
        ]
    };
    
    return stats;
}
// END CHUNK: Comprehensive Statistics Engine

// START CHUNK: Achievement Checker
function checkAchievement(achievement, stats) {
    if (!stats) return { isAchieved: false, progress: 0 };
    let progress = 0;
    const achType = achievement.type;
    const statBlock = stats.achievementData; // Check against the dedicated achievement block

    if (!statBlock || !statBlock.hasOwnProperty(achType)) {
        // Handle meta-achievements separately
        if (achType === 'meta_achievement_count') {
             progress = stats.unlockedCountForMeta || 0;
             return { isAchieved: progress >= achievement.threshold, progress };
        }
        return { isAchieved: false, progress: 0 };
    }
    const statValue = statBlock[achType];
    
    switch(achType) {
        case 'category_watched_count':
        case 'genre_watched_count':
        case 'status_count':
        case 'status_count_active':
            progress = statValue[achievement.category || achievement.genre || achievement.status] || 0;
            break;
        case 'specific_rating_count':
            progress = statValue[achievement.rating] || 0;
            break;
        case 'recommendation_level_count':
            progress = statValue[achievement.recommendation] || 0;
            break;
        case 'time_of_day_watch':
            progress = statValue[achievement.period] > 0 ? 1 : 0;
            break;
        case 'special_title_watch':
             progress = statValue['your_name'] || 0;
             break;
        case 'tmdb_collection_completed_count': // This is a complex case, simplified here
        case 'pre_year_watched_count':
        case 'recent_years_watched_count':
        case 'detailed_description_count':
        case 'hidden_gem_count':
        case 'genre_streak_short_term':
        default:
            progress = statValue || 0;
            break;
    }
    
    return { isAchieved: progress >= achievement.threshold, progress };
}
// END CHUNK: Achievement Checker