/* io2.js */

let smartImportState = {
    fileName: '',
    analyzedEntries: [],
    newEntries: [],
    updateEntries: [],
    overwriteEntries: [],
    skippedEntries: []
};

// Main function to start the smart import process
async function initiateSmartImport(dataFromFile, fileName) {
    smartImportState = {
        fileName: fileName,
        analyzedEntries: [],
        newEntries: [],
        updateEntries: [],
        overwriteEntries: [],
        skippedEntries: []
    };

    const localIdMap = new Map(movieData.map(entry => [entry.id, entry]));
    const localTmdbIdMap = new Map(movieData.filter(entry => entry.tmdbId).map(entry => [String(entry.tmdbId), entry]));
    const localNameYearMap = new Map(movieData.map(entry => [`${(entry.Name || '').toLowerCase()}|${entry.Year || ''}`, entry]));

    for (const row of dataFromFile) {
        if (typeof row !== 'object' || row === null || !row.Name) {
            smartImportState.skippedEntries.push({ entry: row, reason: 'Invalid or missing Name' });
            continue;
        }

        const fileEntry = normalizeImportedRow(row);
        let match = null;
        let matchType = 'none';

        // Hierarchy of matching
        if (fileEntry.id && localIdMap.has(fileEntry.id)) {
            match = localIdMap.get(fileEntry.id);
            matchType = 'UUID Match';
        } else if (fileEntry.tmdbId && localTmdbIdMap.has(String(fileEntry.tmdbId))) {
            match = localTmdbIdMap.get(String(fileEntry.tmdbId));
            matchType = 'TMDB ID Match';
        } else {
            const nameYearKey = `${(fileEntry.Name || '').toLowerCase()}|${fileEntry.Year || ''}`;
            if (localNameYearMap.has(nameYearKey)) {
                match = localNameYearMap.get(nameYearKey);
                matchType = 'Name + Year Match';
            }
        }

        smartImportState.analyzedEntries.push({ fileEntry, existingEntry: match, matchType });
    }

    populateImportSummary();
    hideLoading();
    $('#smartImportModal').modal('show');

    $('#confirmImportBtn').off('click').on('click', processSmartImport);
    $('#cancelImportBtn').off('click').on('click', () => {
        showToast("Import Canceled", "No changes were made to your library.", "info");
    });
}

function populateImportSummary() {
    const summaryDiv = document.getElementById('importSummary');
    const { analyzedEntries } = smartImportState;
    
    const newCount = analyzedEntries.filter(e => e.matchType === 'none').length;
    const matchCount = analyzedEntries.filter(e => e.matchType !== 'none').length;
    const skippedCount = smartImportState.skippedEntries.length;
    const totalCount = analyzedEntries.length + skippedCount;

    summaryDiv.innerHTML = `
        <h5>Analysis of "${smartImportState.fileName}"</h5>
        <ul class="list-group">
            <li class="list-group-item d-flex justify-content-between align-items-center">
                Total Rows in File
                <span class="badge badge-secondary badge-pill">${totalCount}</span>
            </li>
            <li class="list-group-item d-flex justify-content-between align-items-center">
                <i class="fas fa-plus-circle text-success mr-2"></i> New Entries Found
                <span class="badge badge-success badge-pill">${newCount}</span>
            </li>
            <li class="list-group-item d-flex justify-content-between align-items-center">
                <i class="fas fa-sync-alt text-info mr-2"></i> Potential Matches Found
                <span class="badge badge-info badge-pill">${matchCount}</span>
            </li>
            <li class="list-group-item d-flex justify-content-between align-items-center">
                <i class="fas fa-exclamation-triangle text-warning mr-2"></i> Invalid/Skipped Rows
                <span class="badge badge-warning badge-pill">${skippedCount}</span>
            </li>
        </ul>
    `;
}

async function processSmartImport() {
    showLoading("Importing data locally...");
    const strategy = $('input[name="importStrategy"]:checked').val();
    const { analyzedEntries } = smartImportState;
    const currentTimestamp = new Date().toISOString();

    let appendedCount = 0;
    let updatedCount = 0;
    
    const backfillableFields = [
        'runtime', 'keywords', 'tmdb_collection_id', 'tmdb_collection_name', 
        'tmdb_collection_total_parts', 'tmdb_release_date', 'director_info', 'full_cast', 
        'production_companies', 'tmdb_vote_average', 'tmdb_vote_count', 
        'relatedEntries', 'Genre', 'Country', 'Language'
    ];

    for (const item of analyzedEntries) {
        const { fileEntry, existingEntry, matchType } = item;

        if (matchType === 'none') {
            fileEntry._sync_state = 'new';
            fileEntry.is_deleted = false;
            fileEntry.lastModifiedDate = currentTimestamp;
            movieData.push(fileEntry);
            appendedCount++;
        } else {
            const index = movieData.findIndex(e => e.id === existingEntry.id);
            if (index === -1) continue;

            let entryModified = false;

            if (strategy === 'update_matches') {
                const existingLMD = new Date(existingEntry.lastModifiedDate || 0).getTime();
                const fileLMD = new Date(fileEntry.lastModifiedDate || 0).getTime();
                if (fileLMD > existingLMD) {
                    movieData[index] = { ...existingEntry, ...fileEntry, id: existingEntry.id };
                    entryModified = true;
                }
            } else if (strategy === 'overwrite_all') {
                movieData[index] = { ...existingEntry, ...fileEntry, id: existingEntry.id };
                entryModified = true;
            } 
            else if (strategy === 'backfill_missing') {
                const targetEntry = movieData[index];
                let backfilledSomething = false;

                backfillableFields.forEach(field => {
                    const existingValue = targetEntry[field];
                    const fileValue = fileEntry[field];

                    const isExistingEmpty = (
                        existingValue === null ||
                        existingValue === undefined ||
                        existingValue === '' ||
                        (Array.isArray(existingValue) && existingValue.length === 0) ||
                        (typeof existingValue === 'object' && existingValue !== null && Object.keys(existingValue).length === 0)
                    );
                    
                    const isFileValuePresent = (
                        fileValue !== null &&
                        fileValue !== undefined &&
                        fileValue !== ''
                    );
                    
                    if (isExistingEmpty && isFileValuePresent) {
                        targetEntry[field] = fileValue;
                        backfilledSomething = true;
                    }
                });

                if (backfilledSomething) {
                    entryModified = true;
                }
            }

            if (entryModified) {
                updatedCount++;
                movieData[index].lastModifiedDate = currentTimestamp;
                if (movieData[index]._sync_state !== 'new') {
                    movieData[index]._sync_state = 'edited';
                }
            }
        }
    }

    if (appendedCount > 0 || updatedCount > 0) {
        recalculateAndApplyAllRelationships();
        sortMovies(currentSortColumn, currentSortDirection);
        await saveToIndexedDB();
        
        // FIX: Clear stats cache and update achievements so UI reflects new data immediately
        if(window.globalStatsData) window.globalStatsData = {};
        if(typeof checkAndNotifyNewAchievements === 'function') await checkAndNotifyNewAchievements();

        renderMovieCards();
        showToast("Import Complete", `${appendedCount} new entries added, ${updatedCount} entries updated. Sync with cloud to save changes.`, "success");
    } else {
        showToast("Import Complete", "No new changes were made based on your selected strategy.", "info");
    }

    $('#smartImportModal').modal('hide');
    hideLoading();
}

function normalizeImportedRow(row) {
    const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;
    let entryId = row.id || row.Id || row.ID;
    
    if (!entryId || typeof entryId !== 'string' || !uuidRegex.test(entryId)) {
        entryId = generateUUID();
    }
    
    let relatedEntriesFromFile = [];
    if (typeof row.relatedEntries === 'string' && row.relatedEntries.trim()) {
        relatedEntriesFromFile = row.relatedEntries.split(',').map(id => id.trim()).filter(Boolean);
    } else if (Array.isArray(row.relatedEntries)) {
        relatedEntriesFromFile = row.relatedEntries.filter(Boolean);
    }

    const newEntry = {
        id: entryId,
        Name: String(row.Name || '').trim(),
        Category: String(row.Category || 'Movie').trim(),
        Genre: String(row.Genre || '').trim(),
        Status: String(row.Status || 'To Watch').trim(),
        seasonsCompleted: row.seasonsCompleted || null,
        currentSeasonEpisodesWatched: row.currentSeasonEpisodesWatched || null,
        Recommendation: String(row.Recommendation || '').trim(),
        overallRating: String(row.overallRating || '').trim(),
        personalRecommendation: String(row.personalRecommendation || '').trim(),
        Language: String(row.Language || '').trim(),
        Year: String(row.Year || '').trim(),
        Country: String(row.Country || '').trim(),
        Description: String(row.Description || '').trim(),
        'Poster URL': String(row['Poster URL'] || row.poster_url || '').trim(),
        watchHistory: [],
        relatedEntries: relatedEntriesFromFile,
        lastModifiedDate: row.lastModifiedDate || new Date().toISOString(),
        tmdbId: String(row.tmdbId || '').trim() || null,
        tmdbMediaType: row.tmdbMediaType || null,
        tmdb_release_date: row.tmdb_release_date || null,
        imdb_id: String(row.imdb_id || '').trim() || null,
        runtime: (typeof row.runtime === 'string' && row.runtime.startsWith('{')) ? JSON.parse(row.runtime) : (row.runtime || null),
        keywords: (typeof row.keywords === 'string' && row.keywords.startsWith('[')) ? JSON.parse(row.keywords) : (Array.isArray(row.keywords) ? row.keywords : []),
        director_info: (typeof row.director_info === 'string' && row.director_info.startsWith('{')) ? JSON.parse(row.director_info) : (row.director_info || null),
        full_cast: (typeof row.full_cast === 'string' && row.full_cast.startsWith('[')) ? JSON.parse(row.full_cast) : (Array.isArray(row.full_cast) ? row.full_cast : []),
        production_companies: (typeof row.production_companies === 'string' && row.production_companies.startsWith('[')) ? JSON.parse(row.production_companies) : (Array.isArray(row.production_companies) ? row.production_companies : [])
    };
    
    if (typeof row.watchHistory === 'string' && row.watchHistory.startsWith('[')) {
        try { newEntry.watchHistory = JSON.parse(row.watchHistory); } catch (e) { /* ignore */ }
    } else if (Array.isArray(row.watchHistory)) {
        newEntry.watchHistory = row.watchHistory;
    }

    return newEntry;
}

function generateAndDownloadFile(downloadType) {
    if (!Array.isArray(movieData) || movieData.length === 0) {
        showToast("No Data", `No data to download.`, "info"); return;
    }

    const dataForExport = movieData
        .filter(entry => !entry.is_deleted)
        .map(entry => {
            const cleanEntry = { ...entry };
            delete cleanEntry._sync_state;
            delete cleanEntry.is_deleted;
            // Ensure complex objects are stringified for CSV
            if (downloadType === 'csv') {
                for (const key in cleanEntry) {
                    if (typeof cleanEntry[key] === 'object' && cleanEntry[key] !== null) {
                        cleanEntry[key] = JSON.stringify(cleanEntry[key]);
                    }
                }
            }
            return cleanEntry;
        });

    if (dataForExport.length === 0) {
        showToast("No Data", "No visible entries to download.", "info"); return;
    }

    let fileContent, fileMimeType, fileName;

    if (downloadType === 'csv') {
        fileContent = Papa.unparse(dataForExport, { header: true });
        fileMimeType = 'text/csv;charset=utf-8;';
        fileName = 'keepmoviez_log.csv';
    } else if (downloadType === 'json') {
        fileContent = JSON.stringify(dataForExport, null, 2);
        fileMimeType = 'application/json;charset=utf-8;';
        fileName = 'keepmoviez_log.json';
    } else {
        return;
    }

    const blob = new Blob([fileContent], { type: fileMimeType });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
}
