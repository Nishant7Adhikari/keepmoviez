/* js/app.js */
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

    const target = event.target;
    const parent = event.target.parentElement;

    if (target.matches('.edit-btn, .edit-btn *')) {
        prepareEditModal(movieId);
    } else if (target.matches('.delete-btn, .delete-btn *')) {
        showDeleteConfirmationModal(movieId);
    } else if (target.matches('.view-btn, .view-btn *')) {
        openDetailsModal(movieId);
    } else if (target.matches('.quick-update-btn, .quick-update-btn *')) {
        prepareQuickUpdateModal(movieId);
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

// START CHUNK: Data Sorting and Filtering Logic (Moved from ui.js)
function sortMovies(column, direction) {
    if (!Array.isArray(movieData)) { console.error("movieData is not an array. Cannot sort."); return; }
    movieData.sort((a, b) => {
        if (!a && !b) return 0; if (!a) return 1; if (!b) return -1;
        let valA, valB;
        const ascEmpty = Infinity;
        const descEmpty = -Infinity;

        switch (column) {
            case 'LastWatchedDate':
                const latestA = getLatestWatchInstance(a.watchHistory);
                const latestB = getLatestWatchInstance(b.watchHistory);
                valA = latestA ? new Date(latestA.date).getTime() : (direction === 'asc' ? ascEmpty : descEmpty);
                valB = latestB ? new Date(latestB.date).getTime() : (direction === 'asc' ? ascEmpty : descEmpty);
                break;
            case 'lastModifiedDate':
                valA = a.lastModifiedDate ? new Date(a.lastModifiedDate).getTime() : (direction === 'asc' ? ascEmpty : descEmpty);
                valB = b.lastModifiedDate ? new Date(b.lastModifiedDate).getTime() : (direction === 'asc' ? ascEmpty : descEmpty);
                break;
            case 'Year':
                valA = a.Year && !isNaN(parseInt(a.Year, 10)) ? parseInt(a.Year, 10) : (direction === 'asc' ? ascEmpty : descEmpty);
                valB = b.Year && !isNaN(parseInt(b.Year, 10)) ? parseInt(b.Year, 10) : (direction === 'asc' ? ascEmpty : descEmpty);
                break;
            case 'overallRating':
                valA = a.overallRating && a.overallRating !== '' ? parseFloat(a.overallRating) : -1;
                valB = b.overallRating && b.overallRating !== '' ? parseFloat(b.overallRating) : -1;
                break;
            default: // Name
                valA = String(a[column] || '').toLowerCase().trim();
                valB = String(b[column] || '').toLowerCase().trim();
                break;
        }
        
        let comparison = 0;
        if (valA < valB) comparison = -1;
        else if (valA > valB) comparison = 1;

        if (comparison === 0 && column !== 'Name') {
            const nameA = String(a.Name || '').toLowerCase();
            const nameB = String(b.Name || '').toLowerCase();
            if (nameA < nameB) return -1;
            if (nameA > nameB) return 1;
            return 0;
        }
        
        return direction === 'asc' ? comparison : -comparison;
    });
}

function applyFilters(data) {
    let filteredData = data.filter(m => !m.is_deleted);

    if (filterQuery) {
        const lowerFilterQuery = filterQuery.toLowerCase();
        filteredData = filteredData.filter(movie => {
            if (!movie) return false;
            return (movie.Name && String(movie.Name).toLowerCase().includes(lowerFilterQuery)) ||
                   (movie.Year && String(movie.Year).toLowerCase().includes(lowerFilterQuery)) ||
                   (movie.Status && String(movie.Status).toLowerCase().includes(lowerFilterQuery)) ||
                   (movie.Genre && String(movie.Genre).toLowerCase().includes(lowerFilterQuery));
        });
    }
    
    if (activeFilters.category !== 'all') filteredData = filteredData.filter(m => m.Category === activeFilters.category);
    if (activeFilters.country !== 'all') filteredData = filteredData.filter(m => m.Country === activeFilters.country);
    if (activeFilters.language !== 'all') filteredData = filteredData.filter(m => m.Language === activeFilters.language);
    
    if (activeFilters.genres.length > 0) {
        filteredData = filteredData.filter(m => {
            if (!m.Genre) return false;
            const movieGenres = m.Genre.split(',').map(g => g.trim());
            if (activeFilters.genreLogic === 'AND') {
                return activeFilters.genres.every(filterGenre => movieGenres.includes(filterGenre));
            } else { // OR logic
                return activeFilters.genres.some(filterGenre => movieGenres.includes(filterGenre));
            }
        });
    }

    return filteredData;
}
// END CHUNK: Data Sorting and Filtering Logic

// START CHUNK: Entry Form Submission and Save Logic
window.handleFormSubmit = async function(event, saveAction = 'quickSave') {
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
        const newTmdbId = document.getElementById('tmdbId').value || null;

        // FIX: STRICT CONFLICT CHECKING (TMDB ID & Title/Year)
        if (newTmdbId) {
            // Check if another entry (not the one we are editing) has this TMDB ID
            const exactTmdbMatch = movieData.find(m => m.tmdbId == newTmdbId && m.id !== editId && !m.is_deleted);
            if (exactTmdbMatch) {
                showToast("Data Conflict", `Entry "${exactTmdbMatch.Name}" already exists with this TMDB ID. Please use search in Edit Mode instead.`, "error", 6000);
                hideLoading();
                return; // Hard block
            }
        }

        // Check for Name + Year conflict (Soft Block)
        const isDuplicateNameYear = movieData.some(m => 
            m.id !== editId && 
            !m.is_deleted && 
            m.Name.toLowerCase() === nameValue.toLowerCase() && 
            m.Year == yearVal
        );

        if (isDuplicateNameYear) {
             // We use a specialized confirmation modal logic, or native confirm for simplicity in this chunk
             if(!confirm(`Possible Duplicate: "${nameValue}" (${yearVal}) already exists. Do you want to save it anyway?`)) {
                 hideLoading();
                 return;
             }
        }

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
            tmdbId: newTmdbId, tmdbMediaType: document.getElementById('tmdbMediaType').value || null,
            ...cachedTmdbData,
            is_deleted: false,
            _sync_state: editId ? 'edited' : 'new'
        };

        if (entry.Category === 'Series') {
            const seasons = parseInt(formFieldsGlob.runtimeSeriesSeasons.value, 10);
            const episodes = parseInt(formFieldsGlob.runtimeSeriesEpisodes.value, 10);
            const avgEp = parseInt(formFieldsGlob.runtimeSeriesAvgEp.value, 10);
            if (!isNaN(seasons) || !isNaN(episodes) || !isNaN(avgEp)) {
                entry.runtime = { seasons: !isNaN(seasons) ? seasons : null, episodes: !isNaN(episodes) ? episodes : null, episode_run_time: !isNaN(avgEp) ? avgEp : null };
            }
        } else {
            const runtime = parseInt(formFieldsGlob.runtimeMovie.value, 10);
            if (!isNaN(runtime)) entry.runtime = runtime;
        }

        if (editId) { const existingEntry = movieData.find(m => m && m.id === editId); if (existingEntry) entry.doNotRecommendDaily = existingEntry.doNotRecommendDaily; }
        
        // Fallback simple name check for confirm modal (legacy support)
        const isDuplicateNameOnly = movieData.some(m => m && m.Name && String(m.Name).toLowerCase() === entry.Name.toLowerCase() && m.id !== editId && !m.is_deleted && !isDuplicateNameYear); // Skip if we already confirmed Name+Year
        if (isDuplicateNameOnly) {
            pendingEntryForConfirmation = entry; pendingEditIdForConfirmation = editId;
            $('#duplicateNameConfirmModal').modal('show');
            hideLoading(); return;
        }
        await proceedWithEntrySave(entry, editId, saveAction);
    } catch (error) { console.error("Error in handleFormSubmit:", error); showToast("Save Error", `Error: ${error.message}`, "error"); hideLoading(); }
}

window.proceedWithEntrySave = async function(entryToSave, idToEdit, saveAction) {
    let savedEntryId = idToEdit;
    try {
        if (!idToEdit) {
            entryToSave.id = entryToSave.id || generateUUID();
            savedEntryId = entryToSave.id;
            movieData.push(entryToSave);
            
            const toastActions = (saveAction === 'quickSave' || saveAction === 'saveAndAddAnother') ? [{
                label: 'Edit Details',
                className: 'btn-outline-light btn-sm',
                onClick: () => prepareEditModal(savedEntryId)
            }] : [];
            
            showToast("Entry Added", `"${entryToSave.Name}" added locally.`, "success", undefined, DO_NOT_SHOW_AGAIN_KEYS.ENTRY_ADDED, toastActions);
            
            if (entryToSave.Status === 'To Watch') logWatchlistActivity('added');
        } else {
            const existingIndex = movieData.findIndex(m => m && m.id === idToEdit);
            if (existingIndex !== -1) {
                const oldStatus = movieData[existingIndex].Status;
                const newStatus = entryToSave.Status;
                if (oldStatus === 'To Watch' && newStatus === 'Watched') logWatchlistActivity('completed');

                const originalSyncState = movieData[existingIndex]._sync_state;
                movieData[existingIndex] = { ...movieData[existingIndex], ...entryToSave, id: idToEdit };
                if (originalSyncState === 'new') movieData[existingIndex]._sync_state = 'new';
            } else {
                showToast("Update Error", "Entry to update not found.", "error"); hideLoading(); return;
            }
            showToast("Entry Updated", `"${entryToSave.Name}" updated.`, "success", undefined, DO_NOT_SHOW_AGAIN_KEYS.ENTRY_UPDATED);
        }
        recalculateAndApplyAllRelationships();
        sortMovies(currentSortColumn, currentSortDirection);
        renderMovieCards();
        await saveToIndexedDB();
        
        // Handle post-save actions
        switch(saveAction) {
            case 'saveAndAddAnother':
                $('#entryModal').modal('hide');
                $('#entryModal').one('hidden.bs.modal', prepareAddModal);
                break;
            case 'saveAndEdit':
                $('#entryModal').modal('hide');
                $('#entryModal').one('hidden.bs.modal', () => prepareEditModal(savedEntryId));
                break;
            case 'quickSave':
            default:
                 $('#entryModal').modal('hide');
                break;
        }

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

// START CHUNK: Quick Update Save Logic
window.handleQuickUpdateSave = async function(event) {
    event.preventDefault();
    showLoading("Saving progress...");

    try {
        const entryId = document.getElementById('quickUpdateEntryId').value;
        const entryIndex = movieData.findIndex(m => m && m.id === entryId);
        if (entryIndex === -1) {
            throw new Error("Entry not found to update.");
        }

        const movie = movieData[entryIndex];
        const isSeries = movie.Category === 'Series';

        const watchDate = document.getElementById('quickUpdateDate').value;
        const watchRating = document.getElementById('quickUpdateRating').value;
        const watchNotes = document.getElementById('quickUpdateNotes').value.trim();

        if (!watchDate) {
            throw new Error("Watch Date is required.");
        }

        // Always create a new watch record for this session
        const newWatchRecord = {
            watchId: generateUUID(),
            date: watchDate,
            rating: watchRating,
            notes: watchNotes
        };
        if (!Array.isArray(movie.watchHistory)) movie.watchHistory = [];
        movie.watchHistory.push(newWatchRecord);

        if (isSeries) {
            const isFinished = document.getElementById('quickUpdateFinishedToggle').checked;
            movie.seasonsCompleted = parseInt(document.getElementById('quickUpdateSeasons').value, 10) || movie.seasonsCompleted || 0;
            movie.currentSeasonEpisodesWatched = parseInt(document.getElementById('quickUpdateEpisodes').value, 10) || movie.currentSeasonEpisodesWatched || 0;

            if (isFinished) {
                movie.Status = 'Watched';
                movie.overallRating = document.getElementById('quickUpdateOverallRating').value;
                movie.Recommendation = document.getElementById('quickUpdateRecommendation').value;
                movie.personalRecommendation = document.getElementById('quickUpdatePersonalRecommendation').value;
                if (movie.Status === 'To Watch') logWatchlistActivity('completed');
            } else {
                movie.Status = 'Continue'; // Ensure status is Continue if it was To Watch
            }

        } else { // It's a Movie/Doc/Special
            movie.Status = 'Watched';
            movie.overallRating = watchRating; // Prefer overall selection, fallback to watch rating
            movie.Recommendation = document.getElementById('quickUpdateRecommendation').value || '';
            movie.personalRecommendation = document.getElementById('quickUpdatePersonalRecommendation').value || '';
            if (movie.Status === 'To Watch') logWatchlistActivity('completed');
        }

        movie.lastModifiedDate = new Date().toISOString();
        if (movie._sync_state !== 'new') {
            movie._sync_state = 'edited';
        }

        await saveToIndexedDB();
        renderMovieCards();
        await checkAndNotifyNewAchievements();

        $('#quickUpdateModal').modal('hide');
        showToast("Progress Updated", `"${movie.Name}" has been updated.`, "success");

    } catch (error) {
        console.error("Error in handleQuickUpdateSave:", error);
        showToast("Update Failed", error.message, "error");
    } finally {
        hideLoading();
    }
}
// END CHUNK: Quick Update Save Logic

// START CHUNK: Deletion Logic
window.performDeleteEntry = async function() {
    if (!movieIdToDelete) { showToast("Error", "No entry selected.", "error"); $('#confirmDeleteModal').modal('hide'); return; }
    showLoading("Deleting entry locally...");
    try {
        const entryIndex = movieData.findIndex(m => m && m.id === movieIdToDelete);
        if (entryIndex === -1) { showToast("Error", "Entry not found for deletion.", "error"); return; }
        const movieName = movieData[entryIndex].Name || "The entry";
        movieData[entryIndex].is_deleted = true;
        movieData[entryIndex]._sync_state = 'deleted';
        movieData[entryIndex].lastModifiedDate = new Date().toISOString();

        movieData.forEach(movie => { 
            if (movie && movie.relatedEntries && movie.relatedEntries.includes(movieIdToDelete)) { 
                movie.relatedEntries = movie.relatedEntries.filter(id => id !== movieIdToDelete); 
                movie.lastModifiedDate = new Date().toISOString(); 
                if (movie._sync_state !== 'new') movie._sync_state = 'edited';
            } 
        });
        
        recalculateAndApplyAllRelationships();
        renderMovieCards();
        await saveToIndexedDB();
        showToast("Entry Deleted", `${movieName} removed locally. Sync with cloud to finalize.`, "warning", undefined, DO_NOT_SHOW_AGAIN_KEYS.ENTRY_DELETED);

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

        idsToDelete.forEach(deletedId => {
            const entryIndex = movieData.findIndex(m => m && m.id === deletedId);
            if (entryIndex !== -1) {
                movieData[entryIndex].is_deleted = true;
                movieData[entryIndex]._sync_state = 'deleted';
                movieData[entryIndex].lastModifiedDate = currentTimestamp;
                changesMade = true;
            }
        });

        movieData.forEach(movie => {
            if (movie && movie.relatedEntries) {
                const originalCount = movie.relatedEntries.length;
                movie.relatedEntries = movie.relatedEntries.filter(id => !idsToDelete.includes(id));
                if (movie.relatedEntries.length < originalCount) {
                    movie.lastModifiedDate = currentTimestamp;
                     if (movie._sync_state !== 'new') movie._sync_state = 'edited';
                }
            }
        });

        if (changesMade) {
            recalculateAndApplyAllRelationships();
            await saveToIndexedDB();
            renderMovieCards();
            showToast("Local Deletion", `${numToDelete} entries removed locally. Sync with cloud to finalize.`, "warning");
        }
    } catch (error) { console.error("Batch delete error:", error); showToast("Batch Delete Failed", `Error: ${error.message}`, "error", 7000);
    } finally { disableMultiSelectMode(); $('#confirmDeleteModal').modal('hide'); hideLoading(); }
}
// END CHUNK: Deletion Logic

// START CHUNK: Global Data Management (Check/Repair)
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
// END CHUNK: Global Data Management (Check/Repair)

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
    if (isChecked('batchEditApply_Year')) { const yearStr = getVal('batchEditYear').trim(); const parsedYear = parseInt(yearStr, 10); changes.Year = yearStr === '' ? null : (isNaN(parsedYear) ? entry.Year : parsedYear); }

    if (Object.keys(changes).length === 0 && !changes.addGenre && !changes.removeGenre) { showToast("No Changes", "Check a box to apply its value.", "info"); return; }
    
    showLoading(`Applying batch edits to ${selectedEntryIds.length} entries...`);
    try {
        let changesMadeCount = 0;
        const currentLMD = new Date().toISOString();
        
        selectedEntryIds.forEach(id => {
            const entryIndex = movieData.findIndex(m => m.id === id);
            if (entryIndex === -1) return;
            let entry = movieData[entryIndex];
            let entryModified = false;
            if ('Status' in changes) { const oldStatus = entry.Status, newStatus = changes.Status; if (oldStatus === 'To Watch' && newStatus === 'Watched') logWatchlistActivity('completed'); }
            const standardKeys = ['Status', 'Category', 'overallRating', 'Recommendation', 'personalRecommendation', 'Year', 'Country', 'Language'];
            standardKeys.forEach(key => { if (key in changes && entry[key] !== changes[key]) { entry[key] = changes[key]; entryModified = true; } });
            if ('addGenre' in changes && changes.addGenre) { let genres = new Set((entry.Genre || '').split(',').map(g => g.trim()).filter(Boolean)); if (!genres.has(changes.addGenre)) { genres.add(changes.addGenre); entry.Genre = Array.from(genres).sort().join(', '); entryModified = true; } }
            if ('removeGenre' in changes && changes.removeGenre) { let genres = new Set((entry.Genre || '').split(',').map(g => g.trim()).filter(Boolean)); if (genres.has(changes.removeGenre)) { genres.delete(changes.removeGenre); entry.Genre = Array.from(genres).sort().join(', '); entryModified = true; } }
            if (entryModified) { entry.lastModifiedDate = currentLMD; if (entry._sync_state !== 'new') entry._sync_state = 'edited'; changesMadeCount++; }
        });

        if (changesMadeCount > 0) { await saveToIndexedDB(); renderMovieCards(); showToast("Batch Edit Complete", `${changesMadeCount} of ${selectedEntryIds.length} entries updated locally.`, "success"); }
        else { showToast("No Changes Applied", "Entries already had the specified values.", "info"); }
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
        if (movieData[movieIndex]._sync_state !== 'new') movieData[movieIndex]._sync_state = 'edited';
        incrementLocalStorageCounter('daily_rec_watched_achievement');
        await saveToIndexedDB();
        renderMovieCards();
        showToast("Great!", `Marked "${movieData[movieIndex].Name}" as Watched.`, "success");
    }
}

window.markDailyRecSkipped = async function(event) {
    let dailyRecSkipCount = parseInt(localStorage.getItem(DAILY_REC_SKIP_COUNT_KEY) || '0');
    dailyRecSkipCount++;
    localStorage.setItem(DAILY_REC_SKIP_COUNT_KEY, dailyRecSkipCount.toString());
    localStorage.removeItem(DAILY_RECOMMENDATION_ID_KEY);
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
    } catch (e) { console.error(`Failed to increment localStorage counter for key: ${key}`, e); }
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
    } catch (e) { console.error(`Failed to record unique date for key: ${key}`, e); }
}
window.checkAndNotifyNewAchievements = async function(isInitialLoad = false) {
    if (movieData.length === 0) { knownUnlockedAchievements.clear(); return; }
    const stats = calculateAllStatistics(movieData);
    let unlockedCountForMeta = 0;
    const currentlyUnlocked = new Set();
    
    ACHIEVEMENTS.forEach(ach => { if (ach.type !== 'meta_achievement_count') { const { isAchieved } = checkAchievement(ach, stats); if (isAchieved) { unlockedCountForMeta++; currentlyUnlocked.add(ach.id); } } });
    stats.unlockedCountForMeta = unlockedCountForMeta;
    ACHIEVEMENTS.forEach(ach => { if (ach.type === 'meta_achievement_count') { const { isAchieved } = checkAchievement(ach, stats); if (isAchieved) currentlyUnlocked.add(ach.id); } });

    if (isInitialLoad) { knownUnlockedAchievements = currentlyUnlocked; return; }

    const newlyUnlocked = [...currentlyUnlocked].filter(id => !knownUnlockedAchievements.has(id));
    if (newlyUnlocked.length > 0) {
        newlyUnlocked.forEach((id, index) => {
            const achievement = ACHIEVEMENTS.find(ach => ach.id === id);
            if (achievement) {
                const toastActions = [{
                    label: 'View Achievements', className: 'btn-outline-light',
                    onClick: () => { if (typeof displayAchievementsModal === 'function' && typeof $ !== 'undefined') { displayAchievementsModal(); $('#achievementsModal').modal('show'); } }
                }];
                setTimeout(() => { showToast(`🏆 Achievement Unlocked!`, `<strong>${achievement.name}</strong><br><small>${achievement.description}</small>`, 'success', 0, null, toastActions); }, 500 * index);
            }
        });
    }
    knownUnlockedAchievements = currentlyUnlocked;
}
// END CHUNK: Achievement and Usage Helpers
