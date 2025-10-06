/* app.js */
// START CHUNK: Card Interaction and Multi-Select
window.handleCardClick = function(event) {
    if (longPressOccurred) {
        event.preventDefault();
        event.stopPropagation();
        longPressOccurred = false;
        return;
    }
    const card = event.target.closest('.movie-card');
    if (!card) return;
    const movieId = card.dataset.movieId;

    if (isMultiSelectMode) {
        toggleCardSelection(movieId);
        return;
    }

    const targetClasses = event.target.classList;
    const parentClasses = event.target.parentElement.classList;

    if (targetClasses.contains('edit-btn') || parentClasses.contains('edit-btn')) {
        prepareEditModal(movieId);
    } else if (targetClasses.contains('delete-btn') || parentClasses.contains('delete-btn')) {
        showDeleteConfirmationModal(movieId);
    } else if (targetClasses.contains('view-btn') || parentClasses.contains('view-btn')) {
        openDetailsModal(movieId);
    } else {
        openDetailsModal(movieId); // Default action for clicking the card body
    }
}

window.handleCardMouseDown = function(event) {
    if ((event.button !== undefined && event.button !== 0) || !event.target.closest('.movie-card')) return;
    if (longPressTimer) clearTimeout(longPressTimer);
    longPressOccurred = false;
    const card = event.target.closest('.movie-card');
    const movieId = card.dataset.movieId;
    longPressTimer = setTimeout(() => {
        if (!isMultiSelectMode) {
            enableMultiSelectMode(movieId);
            longPressOccurred = true;
        }
        longPressTimer = null;
    }, LONG_PRESS_DURATION);
}

window.handleCardMouseUp = function() {
    if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
    }
}

function enableMultiSelectMode(initialMovieId) {
    isMultiSelectMode = true;
    selectedEntryIds = [initialMovieId];
    document.getElementById('multiSelectActionsBar').style.display = 'flex';
    document.getElementById('addNewEntryBtn').style.display = 'none';
    document.body.classList.add('multi-select-active');
    renderMovieCards();
    updateMultiSelectCount();
    showToast("Multi-Select Mode", "Long press on a card to start selection. Tap to add/remove.", "info");
}

window.disableMultiSelectMode = function() {
    isMultiSelectMode = false;
    selectedEntryIds = [];
    document.getElementById('multiSelectActionsBar').style.display = 'none';
    document.getElementById('addNewEntryBtn').style.display = 'block';
    document.body.classList.remove('multi-select-active');
    renderMovieCards();
}

function toggleCardSelection(movieId) {
    const index = selectedEntryIds.indexOf(movieId);
    if (index > -1) {
        selectedEntryIds.splice(index, 1);
    } else {
        selectedEntryIds.push(movieId);
    }
    const card = document.querySelector(`.movie-card[data-movie-id="${movieId}"]`);
    if (card) {
        card.classList.toggle('selected');
    }
    updateMultiSelectCount();
    if (selectedEntryIds.length === 0) {
        disableMultiSelectMode();
    }
}

function updateMultiSelectCount() {
    document.getElementById('multiSelectCount').textContent = `${selectedEntryIds.length} selected`;
}
// END CHUNK: Card Interaction and Multi-Select

// START CHUNK: Entry Form Submission and Save Logic
window.handleFormSubmit = async function(event) {
    event.preventDefault();
    if (!formFieldsGlob) { console.error("formFieldsGlob not initialized!"); return; }
    showLoading("Saving entry...");
    try {
        const nameValue = formFieldsGlob.name.value.trim();
        if (!nameValue) { showToast("Validation Error", "Name is required.", "error"); formFieldsGlob.name.focus(); hideLoading(); return; }
        const yearVal = formFieldsGlob.year.value.trim();
        if (yearVal && (isNaN(parseInt(yearVal)) || parseInt(yearVal) < 1800 || parseInt(yearVal) > new Date().getFullYear() + 20)) {
            showToast("Validation Error", "Valid year required.", "error"); formFieldsGlob.year.focus(); hideLoading(); return;
        }

        const { finalized: namesArray } = parseInputForAutocomplete(formFieldsGlob.relatedEntriesNames.value.trim());
        const directRelatedEntriesIds = namesArray.map(name => movieData.find(m => m && m.Name && String(m.Name).toLowerCase() === String(name).toLowerCase())?.id).filter(id => id);
        const entryFormEl = document.getElementById('entryForm');
        const cachedTmdbData = entryFormEl && entryFormEl._tempTmdbData ? entryFormEl._tempTmdbData : {};
        const countryInput = formFieldsGlob.country.value.trim();
        let countryCodeToStore = countryInput.toUpperCase();
        if (countryInput.length > 3) { for (const [code, name] of Object.entries(countryCodeToNameMap)) { if (name.toLowerCase() === countryInput.toLowerCase()) { countryCodeToStore = code; break; } } }
        
        const editId = document.getElementById('editEntryId').value;

        const entry = {
            Name: nameValue, Category: formFieldsGlob.category.value, Genre: Array.isArray(selectedGenres) ? selectedGenres.join(', ') : '', Status: formFieldsGlob.status.value,
            seasonsCompleted: (formFieldsGlob.status.value === 'Continue' && formFieldsGlob.category.value === 'Series') ? parseInt(formFieldsGlob.seasonsCompleted.value, 10) || 0 : null,
            currentSeasonEpisodesWatched: (formFieldsGlob.status.value === 'Continue' && formFieldsGlob.category.value === 'Series') ? parseInt(formFieldsGlob.currentSeasonEpisodesWatched.value, 10) || 0 : null,
            Recommendation: (formFieldsGlob.status.value === 'Watched' || formFieldsGlob.status.value === 'Continue') ? formFieldsGlob.recommendation.value : '',
            overallRating: (formFieldsGlob.status.value === 'Watched' || formFieldsGlob.status.value === 'Continue') ? formFieldsGlob.overallRating.value : '',
            personalRecommendation: formFieldsGlob.personalRecommendation.value, Language: formFieldsGlob.language.value.trim(), Year: yearVal, Country: countryCodeToStore,
            Description: formFieldsGlob.description.value.trim(), 'Poster URL': formFieldsGlob.posterUrl.value.trim(), 
            watchHistory: JSON.parse(document.getElementById('currentWatchHistory').value || '[]'), relatedEntries: [...new Set(directRelatedEntriesIds)],
            lastModifiedDate: new Date().toISOString(), doNotRecommendDaily: false,
            tmdbId: document.getElementById('tmdbId').value || null, tmdbMediaType: document.getElementById('tmdbMediaType').value || null,
            ...cachedTmdbData,
            // --- NEW: Add sync state properties ---
            is_deleted: false, // Always false when saving
            _sync_state: editId ? 'edited' : 'new'
        };

        // ### Cleaned Up Runtime Logic ###
        if (entry.Category === 'Series') {
            const seasons = parseInt(formFieldsGlob.runtimeSeriesSeasons.value, 10);
            const episodes = parseInt(formFieldsGlob.runtimeSeriesEpisodes.value, 10);
            const avgEp = parseInt(formFieldsGlob.runtimeSeriesAvgEp.value, 10);
            
            if (!isNaN(seasons) || !isNaN(episodes) || !isNaN(avgEp)) {
                entry.runtime = {
                    seasons: !isNaN(seasons) ? seasons : null,
                    episodes: !isNaN(episodes) ? episodes : null,
                    episode_run_time: !isNaN(avgEp) ? avgEp : null
                };
            }
        } else { // Movie, Documentary, Special
            const runtime = parseInt(formFieldsGlob.runtimeMovie.value, 10);
            if (!isNaN(runtime)) {
                entry.runtime = runtime;
            }
        }

        if (editId) { const existingEntry = movieData.find(m => m && m.id === editId); if (existingEntry) entry.doNotRecommendDaily = existingEntry.doNotRecommendDaily; }
        
        const isDuplicate = movieData.some(m => m && m.Name && String(m.Name).toLowerCase() === entry.Name.toLowerCase() && m.id !== editId && !m.is_deleted);
        if (isDuplicate) {
            pendingEntryForConfirmation = entry; pendingEditIdForConfirmation = editId;
            $('#duplicateNameConfirmModal').modal('show');
            hideLoading(); return;
        }
        await proceedWithEntrySave(entry, editId);
    } catch (error) { console.error("Error in handleFormSubmit:", error); showToast("Save Error", `Error: ${error.message}`, "error"); hideLoading(); }
}

window.proceedWithEntrySave = async function(entryToSave, idToEdit) {
    try {
        if (!idToEdit) {
            entryToSave.id = entryToSave.id || generateUUID();
            movieData.push(entryToSave);
            showToast("Entry Added", `"${entryToSave.Name}" added locally.`, "success", undefined, DO_NOT_SHOW_AGAIN_KEYS.ENTRY_ADDED);
            
            // LOGGING FOR WATCHLIST GROWTH: Log if a new item is added directly to the watchlist
            if (entryToSave.Status === 'To Watch') {
                logWatchlistActivity('added');
            }
        } else {
            const existingIndex = movieData.findIndex(m => m && m.id === idToEdit);
            if (existingIndex !== -1) {
                // LOGGING FOR WATCHLIST GROWTH: Log if an item is completed
                const oldStatus = movieData[existingIndex].Status;
                const newStatus = entryToSave.Status;
                if (oldStatus === 'To Watch' && newStatus === 'Watched') {
                    logWatchlistActivity('completed');
                }

                // Preserve original sync state if it was 'new'
                const originalSyncState = movieData[existingIndex]._sync_state;
                movieData[existingIndex] = { ...movieData[existingIndex], ...entryToSave, id: idToEdit };
                if (originalSyncState === 'new') {
                    movieData[existingIndex]._sync_state = 'new';
                }
            } else {
                showToast("Update Error", "Entry to update not found.", "error"); hideLoading(); return;
            }
            showToast("Entry Updated", `"${entryToSave.Name}" updated locally.`, "success", undefined, DO_NOT_SHOW_AGAIN_KEYS.ENTRY_UPDATED);
        }
        recalculateAndApplyAllRelationships();
        sortMovies(currentSortColumn, currentSortDirection);
        renderMovieCards();
        await saveToIndexedDB();
        $('#entryModal').modal('hide');
        pendingEntryForConfirmation = null; pendingEditIdForConfirmation = null;

        await checkAndNotifyNewAchievements();
        
        if (entryToSave.tmdb_collection_id) await propagateCollectionDataUpdate(entryToSave);

    } catch (error) {
        console.error("Error in proceedWithEntrySave:", error);
        showToast("Save Error", `Error: ${error.message}`, "error");
    } finally {
        hideLoading();
    }
}
// END CHUNK: Entry Form Submission and Save Logic

// START CHUNK: Deletion Logic
// REMOVED: The old localStorage-based deletion queue is no longer needed.

window.performDeleteEntry = async function() {
    if (!movieIdToDelete) { showToast("Error", "No entry selected.", "error"); $('#confirmDeleteModal').modal('hide'); return; }
    showLoading("Deleting entry locally...");
    try {
        const entryIndex = movieData.findIndex(m => m && m.id === movieIdToDelete);
        if (entryIndex === -1) {
            showToast("Error", "Entry not found for deletion.", "error");
            return;
        }

        const movieName = movieData[entryIndex].Name || "The entry";
        
        // --- NEW: Soft Delete Logic ---
        movieData[entryIndex].is_deleted = true;
        movieData[entryIndex]._sync_state = 'deleted';
        movieData[entryIndex].lastModifiedDate = new Date().toISOString();

        // Update relationships of other entries pointing to this one
        movieData.forEach(movie => { 
            if (movie && movie.relatedEntries && movie.relatedEntries.includes(movieIdToDelete)) { 
                movie.relatedEntries = movie.relatedEntries.filter(id => id !== movieIdToDelete); 
                movie.lastModifiedDate = new Date().toISOString(); 
                if (movie._sync_state !== 'new') {
                    movie._sync_state = 'edited';
                }
            } 
        });
        
        recalculateAndApplyAllRelationships();
        renderMovieCards(); // This will now hide the soft-deleted entry
        await saveToIndexedDB();
        showToast("Entry Deleted", `${movieName} removed locally. Sync with cloud to finalize.`, "warning", undefined, DO_NOT_SHOW_AGAIN_KEYS.ENTRY_DELETED);

        // REMOVED: No automatic sync
        // if (currentSupabaseUser) await comprehensiveSync(true);

    } catch (error) { console.error("Error deleting entry:", error); showToast("Delete Failed", `Error: ${error.message}`, "error", 7000);
    } finally { movieIdToDelete = null; $('#confirmDeleteModal').modal('hide'); hideLoading(); }
}

window.performBatchDelete = async function() {
    if (!isMultiSelectMode || selectedEntryIds.length === 0) return;
    const idsToDelete = [...selectedEntryIds]; const numToDelete = idsToDelete.length;
    showLoading(`Deleting ${numToDelete} entries locally...`);
    try {
        const currentTimestamp = new Date().toISOString();
        let changesMade = false;

        // --- NEW: Batch Soft Delete Logic ---
        idsToDelete.forEach(deletedId => {
            const entryIndex = movieData.findIndex(m => m && m.id === deletedId);
            if (entryIndex !== -1) {
                movieData[entryIndex].is_deleted = true;
                movieData[entryIndex]._sync_state = 'deleted';
                movieData[entryIndex].lastModifiedDate = currentTimestamp;
                changesMade = true;
            }
        });

        // Update relationships
        movieData.forEach(movie => {
            if (movie && movie.relatedEntries) {
                const originalCount = movie.relatedEntries.length;
                movie.relatedEntries = movie.relatedEntries.filter(id => !idsToDelete.includes(id));
                if (movie.relatedEntries.length < originalCount) {
                    movie.lastModifiedDate = currentTimestamp;
                     if (movie._sync_state !== 'new') {
                        movie._sync_state = 'edited';
                    }
                }
            }
        });

        if (changesMade) {
            recalculateAndApplyAllRelationships();
            await saveToIndexedDB();
            renderMovieCards();
            showToast("Local Deletion", `${numToDelete} entries removed locally. Sync with cloud to finalize.`, "warning");
        }
        
        // REMOVED: No automatic sync
        // if (currentSupabaseUser) await comprehensiveSync(true);

    } catch (error) { console.error("Batch delete error:", error); showToast("Batch Delete Failed", `Error: ${error.message}`, "error", 7000);
    } finally { disableMultiSelectMode(); $('#confirmDeleteModal').modal('hide'); hideLoading(); }
}
// END CHUNK: Deletion Logic

// START CHUNK: Global Data Management (Erase, Check/Repair)
window.performDataCheckAndRepair = async function() {
    showLoading("Performing data integrity checks...");
    try {
        let issues = []; let changesMade = false;
        const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;
        const allValidIds = new Set(movieData.map(m => m.id));

        for (let i = movieData.length - 1; i >= 0; i--) {
            let entry = movieData[i];
            if (!entry) { issues.push(`Removed null entry at index ${i}.`); movieData.splice(i, 1); changesMade = true; continue; }
            let entryModified = false;
            if (!entry.id || !uuidRegex.test(entry.id)) { issues.push(`Entry "${entry.Name || 'Unnamed'}" had invalid ID. Regenerated.`); entry.id = generateUUID(); entryModified = true; }
            if (Array.isArray(entry.relatedEntries)) {
                const originalCount = entry.relatedEntries.length;
                entry.relatedEntries = entry.relatedEntries.filter(id => allValidIds.has(id));
                if (entry.relatedEntries.length < originalCount) { issues.push(`Entry "${entry.Name}": Removed ${originalCount - entry.relatedEntries.length} orphaned related entries.`); entryModified = true; }
            }
            if (entryModified) { entry.lastModifiedDate = new Date().toISOString(); if(entry._sync_state !== 'new') entry._sync_state = 'edited'; changesMade = true; }
        }
        if (changesMade) recalculateAndApplyAllRelationships();
        let message = issues.length > 0 ? `Data check complete. Found and fixed ${issues.length} issue(s).` : "Data check complete. No integrity issues found!";
        if (changesMade) {
            message += ` Changes saved locally. Please sync with the cloud.`;
            await saveToIndexedDB(); renderMovieCards();
        }
        showToast(issues.length > 0 ? "Data Integrity Issues Found" : "Data Integrity Check", message, issues.length > 0 ? "warning" : "success", 7000);
    } catch (error) { console.error("Error during data check/repair:", error); showToast("Repair Error", `Failed: ${error.message}`, "error");
    } finally { hideLoading(); }
}
// END CHUNK: Global Data Management (Erase, Check/Repair)

// START CHUNK: Batch Edit Logic
window.handleBatchEditFormSubmit = async function(event) {
    event.preventDefault();
    if (!isMultiSelectMode || selectedEntryIds.length === 0) return;
    
    const changes = {};
    const getVal = (id) => document.getElementById(id).value;
    const isChecked = (id) => document.getElementById(id).checked;

    if (isChecked('batchEditApply_Status')) changes.Status = getVal('batchEditStatus');
    if (isChecked('batchEditApply_Category')) changes.Category = getVal('batchEditCategory');
    if (isChecked('batchEditApply_AddGenre')) changes.addGenre = getVal('batchEditAddGenre').trim();
    if (isChecked('batchEditApply_RemoveGenre')) changes.removeGenre = getVal('batchEditRemoveGenre').trim();
    if (isChecked('batchEditApply_OverallRating')) changes.overallRating = getVal('batchEditOverallRating');
    if (isChecked('batchEditApply_Recommendation')) changes.Recommendation = getVal('batchEditRecommendation');
    if (isChecked('batchEditApply_PersonalRecommendation')) changes.personalRecommendation = getVal('batchEditPersonalRecommendation');
    if (isChecked('batchEditApply_Country')) changes.Country = getVal('batchEditCountry').trim().toUpperCase();
    if (isChecked('batchEditApply_Language')) changes.Language = getVal('batchEditLanguage').trim();

    if (isChecked('batchEditApply_Year')) {
        const yearStr = getVal('batchEditYear').trim();
        const parsedYear = parseInt(yearStr, 10);
        changes.Year = yearStr === '' ? null : (isNaN(parsedYear) ? entry.Year : parsedYear); // Keep old value if new is invalid
    }

    if (Object.keys(changes).length === 0 && !changes.addGenre && !changes.removeGenre) {
        showToast("No Changes", "Check a box to apply its value.", "info");
        return;
    }
    
    showLoading(`Applying batch edits to ${selectedEntryIds.length} entries...`);
    try {
        let changesMadeCount = 0;
        const currentLMD = new Date().toISOString();
        
        selectedEntryIds.forEach(id => {
            const entryIndex = movieData.findIndex(m => m.id === id);
            if (entryIndex === -1) return;
            
            let entry = movieData[entryIndex];
            let entryModified = false;

            // LOGGING FOR WATCHLIST GROWTH: Detect and log completions during batch edit
            if ('Status' in changes) {
                const oldStatus = entry.Status;
                const newStatus = changes.Status;
                if (oldStatus === 'To Watch' && newStatus === 'Watched') {
                    logWatchlistActivity('completed');
                }
            }

            const standardKeys = ['Status', 'Category', 'overallRating', 'Recommendation', 'personalRecommendation', 'Year', 'Country', 'Language'];
            standardKeys.forEach(key => {
                if (key in changes && entry[key] !== changes[key]) {
                    entry[key] = changes[key];
                    entryModified = true;
                }
            });

            if ('addGenre' in changes && changes.addGenre) {
                let genres = new Set((entry.Genre || '').split(',').map(g => g.trim()).filter(Boolean));
                if (!genres.has(changes.addGenre)) { genres.add(changes.addGenre); entry.Genre = Array.from(genres).sort().join(', '); entryModified = true; }
            }

            if ('removeGenre' in changes && changes.removeGenre) {
                let genres = new Set((entry.Genre || '').split(',').map(g => g.trim()).filter(Boolean));
                if (genres.has(changes.removeGenre)) { genres.delete(changes.removeGenre); entry.Genre = Array.from(genres).sort().join(', '); entryModified = true; }
            }
            
            if (entryModified) {
                entry.lastModifiedDate = currentLMD;
                if (entry._sync_state !== 'new') { // Don't overwrite 'new' status
                    entry._sync_state = 'edited';
                }
                changesMadeCount++;
            }
        });

        if (changesMadeCount > 0) {
            await saveToIndexedDB();
            renderMovieCards();
            showToast("Batch Edit Complete", `${changesMadeCount} of ${selectedEntryIds.length} entries updated locally.`, "success");
        } else {
            showToast("No Changes Applied", "Entries already had the specified values.", "info");
        }
        $('#batchEditModal').modal('hide');
        disableMultiSelectMode();
    } catch (error) { console.error("Error in batch edit:", error); showToast("Batch Edit Error", `Failed: ${error.message}`, "error");
    } finally { hideLoading(); }
}
// END CHUNK: Batch Edit Logic

// START CHUNK: Recommendation Modal Actions
window.markDailyRecCompleted = async function(event) {
    const movieId = event.target.closest('button').dataset.movieId;
    const movieIndex = movieData.findIndex(m => m.id === movieId);
    if (movieIndex !== -1) {
        movieData[movieIndex].Status = 'Watched';
        movieData[movieIndex].lastModifiedDate = new Date().toISOString();
        if(!Array.isArray(movieData[movieIndex].watchHistory)) movieData[movieIndex].watchHistory = [];
        movieData[movieIndex].watchHistory.push({ watchId: generateUUID(), date: new Date().toISOString().slice(0,10), rating: '', notes: 'Marked as Watched from Daily Recommendation' });
        
        // --- NEW: Mark as edited for sync ---
        if (movieData[movieIndex]._sync_state !== 'new') {
            movieData[movieIndex]._sync_state = 'edited';
        }

        incrementLocalStorageCounter('daily_rec_watched_achievement');
        
        await saveToIndexedDB();
        renderMovieCards();
        showToast("Great!", `Marked "${movieData[movieIndex].Name}" as Watched.`, "success");

        // REMOVED: No automatic sync
        // if(currentSupabaseUser) await comprehensiveSync(true);
    }
}

window.markDailyRecSkipped = async function(event) {
    let dailyRecSkipCount = parseInt(localStorage.getItem(DAILY_REC_SKIP_COUNT_KEY) || '0');
    dailyRecSkipCount++;
    localStorage.setItem(DAILY_REC_SKIP_COUNT_KEY, dailyRecSkipCount.toString());
    localStorage.removeItem(DAILY_RECOMMENDATION_ID_KEY); // Invalidate current pick

    showToast("Skipped", "Getting you a new recommendation...", "info");
    
    $('#dailyRecommendationModal').modal('hide');
    $('#dailyRecommendationModal').one('hidden.bs.modal', async () => {
        showLoading("Getting next pick...");
        await displayDailyRecommendationModal();
        hideLoading();
        $('#dailyRecommendationModal').modal('show');
    });
}
// END CHUNK: Recommendation Modal Actions

// START CHUNK: Achievement and Usage Helpers
function incrementLocalStorageCounter(key) {
    if (!key) return;
    try {
        let count = parseInt(localStorage.getItem(key) || '0');
        if (isNaN(count)) count = 0;
        localStorage.setItem(key, (count + 1).toString());
    } catch (e) {
        console.error(`Failed to increment localStorage counter for key: ${key}`, e);
    }
}

function recordUniqueDateForAchievement(key) {
    if (!key) return;
    try {
        const today = new Date().toISOString().slice(0, 10);
        let dates = JSON.parse(localStorage.getItem(key) || '[]');
        if (!Array.isArray(dates)) dates = [];
        if (!dates.includes(today)) {
            dates.push(today);
            localStorage.setItem(key, JSON.stringify(dates));
        }
    } catch (e) {
        console.error(`Failed to record unique date for key: ${key}`, e);
    }
}
window.checkAndNotifyNewAchievements = async function(isInitialLoad = false) {
    if (movieData.length === 0) {
        knownUnlockedAchievements.clear();
        return;
    }
    
    const stats = calculateAllStatistics(movieData);
    let unlockedCountForMeta = 0;
    const currentlyUnlocked = new Set();
    
    ACHIEVEMENTS.forEach(ach => {
        if (ach.type !== 'meta_achievement_count') {
            const { isAchieved } = checkAchievement(ach, stats);
            if (isAchieved) {
                unlockedCountForMeta++;
                currentlyUnlocked.add(ach.id);
            }
        }
    });

    stats.unlockedCountForMeta = unlockedCountForMeta;

    ACHIEVEMENTS.forEach(ach => {
        if (ach.type === 'meta_achievement_count') {
            const { isAchieved } = checkAchievement(ach, stats);
            if (isAchieved) {
                currentlyUnlocked.add(ach.id);
            }
        }
    });

    if (isInitialLoad) {
        knownUnlockedAchievements = currentlyUnlocked;
        return;
    }

    const newlyUnlocked = [...currentlyUnlocked].filter(id => !knownUnlockedAchievements.has(id));

    if (newlyUnlocked.length > 0) {
        newlyUnlocked.forEach((id, index) => {
            const achievement = ACHIEVEMENTS.find(ach => ach.id === id);
            if (achievement) {
                const toastActions = [{
                    label: 'View Achievements',
                    className: 'btn-outline-light',
                    onClick: () => {
                        if (typeof displayAchievementsModal === 'function' && typeof $ !== 'undefined') {
                            displayAchievementsModal();
                            $('#achievementsModal').modal('show');
                        }
                    }
                }];
                setTimeout(() => { 
                    showToast(
                        `🏆 Achievement Unlocked!`,
                        `<strong>${achievement.name}</strong><br><small>${achievement.description}</small>`,
                        'success',
                        0,
                        null,
                        toastActions
                    );
                }, 500 * index);
            }
        });
    }

    knownUnlockedAchievements = currentlyUnlocked;
}
