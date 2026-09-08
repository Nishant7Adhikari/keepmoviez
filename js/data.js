/* data.js */
// START CHUNK: Save Data to IndexedDB
async function saveToIndexedDB() {
    if (!db) {
        console.warn("IndexedDB not open. Attempting to open before saving...");
        try {
            await openDatabase();
            if (!db) {
                showToast("Local Save Failed", "Cannot connect to local database. Changes not saved locally.", "error");
                return;
            }
        } catch (e) {
            showToast("Local Save Failed", `Error connecting to local database: ${e.message}. Changes not saved.`, "error");
            return;
        }
    }
    if (!Array.isArray(movieData)) {
        console.error("movieData is not an array. Cannot save to IndexedDB.");
        showToast("Data Error", "Invalid data format. Cannot save locally.", "error");
        return;
    }

    try {
        const dataToStore = JSON.stringify(movieData);
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const storageKey = window.currentSupabaseUser ? 'userMovieData_' + window.currentSupabaseUser.id : IDB_USER_DATA_KEY;
        const request = store.put(dataToStore, storageKey);

        return new Promise((resolve, reject) => {
            request.onsuccess = () => {
                // --- MODIFIED: Auto-Sync Hook ---
                const syncModeKey = window.currentSupabaseUser ? window.currentSupabaseUser.id + '_sync_mode' : 'keepmoviez_sync_mode';
                const currentSyncMode = localStorage.getItem(syncModeKey);
                const isOnline = navigator.onLine;

                if (window.isModalSyncHold) {
                    // Modal sync-hold is active: bypass auto-sync timer
                    resolve();
                    return;
                }

                if (currentSyncMode === 'normal' && isOnline && !window.isSyncingInProgress) {
                    console.log("Auto-Sync Triggered after local save.");
                    // Debounce/Throttle this slightly to avoid rapid-fire syncs on batch edits
                    if (window.autoSyncTimer) clearTimeout(window.autoSyncTimer);
                    window.autoSyncTimer = setTimeout(() => {
                        if (typeof comprehensiveSync === 'function') {
                            comprehensiveSync(true); // true = silent mode
                        }
                    }, 2000); // 2 second delay to let user finish typing or batch operations finish
                }

                resolve();
            };
            request.onerror = (event) => {
                console.error("Error saving to IndexedDB (local cache):", event.target.error);
                showToast("Local Cache Error", "Could not save data locally.", "warning");
                reject(event.target.error);
            };
            transaction.onerror = (event) => {
                console.error("IndexedDB transaction error during save:", event.target.error);
                reject(event.target.error);
            };
        });
    } catch (e) {
        console.error("Exception during IndexedDB save process:", e);
        showToast("Local Cache Error", `Could not save data locally due to an exception: ${e.message}`, "warning");
        return Promise.reject(e);
    }
}
// END CHUNK: Save Data to IndexedDB

// START CHUNK: Load Data from IndexedDB
async function loadFromIndexedDB() {
    if (!db) {
        console.warn("IndexedDB not open. Attempting to open before loading...");
        try {
            await openDatabase();
            if (!db) return [];
        } catch (e) {
            console.error("Failed to open database for loading:", e);
            return [];
        }
    }
    try {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const storageKey = window.currentSupabaseUser ? 'userMovieData_' + window.currentSupabaseUser.id : IDB_USER_DATA_KEY;
        const request = store.get(storageKey);

        return await new Promise((resolve, reject) => {
            request.onsuccess = (event) => {
                const jsonData = event.target.result;
                if (jsonData) {
                    try {
                        let parsedData = JSON.parse(jsonData);
                        if (Array.isArray(parsedData)) {
                            // --- MODIFIED: Filter out soft-deleted entries and heal missing Status on load ---
                            parsedData = parsedData.filter(entry => !entry.is_deleted).map(entry => {
                                if (entry && (!entry.Status || entry.Status === "N/A" || typeof entry.Status !== "string")) {
                                    entry.Status = (Array.isArray(entry.watchHistory) && entry.watchHistory.length > 0) ? "Watched" : "To Watch";
                                }
                                return entry;
                            });
                            resolve(parsedData);
                        } else {
                            resolve([]);
                        }
                    } catch (e) {
                        console.error("Error parsing cached data from IndexedDB:", e);
                        showToast(
                            "CRITICAL: Local Cache Corrupted",
                            "Your local data was unreadable and has been cleared to prevent further issues. Please sync with the cloud to restore your data.",
                            "error",
                            0,
                            null
                        );

                        const writeTransaction = db.transaction([STORE_NAME], 'readwrite');
                        const writeStore = writeTransaction.objectStore(STORE_NAME);
                        const storageKey = window.currentSupabaseUser ? 'userMovieData_' + window.currentSupabaseUser.id : IDB_USER_DATA_KEY;
                        writeStore.delete(storageKey);

                        resolve([]);
                    }
                } else {
                    resolve([]);
                }
            };
            request.onerror = (event) => {
                console.error("Error fetching from IndexedDB (local cache):", event.target.error);
                showToast("Local Cache Error", "Failed to load data from local cache.", "error");
                reject(event.target.error);
            };
        });
    } catch (e) {
        console.error("IndexedDB local cache load process failed:", e);
        showToast("Local Cache Error", "Failed to load data from local cache.", "error");
        return [];
    }
}
// END CHUNK: Load Data from IndexedDB

// START CHUNK: Legacy LocalStorage Cleanup
async function migrateVeryOldLocalStorageData() {
    try {
        const ancientLocalStorageKey = 'myMovieTrackerData';
        const storedData = localStorage.getItem(ancientLocalStorageKey);

        if (storedData) {
            console.log("Found very old localStorage data. Attempting to parse.");
            let parsedData;
            try {
                parsedData = JSON.parse(storedData);
            } catch (e) {
                console.error("Could not parse very old localStorage data. Removing it.", e);
                localStorage.removeItem(ancientLocalStorageKey);
                showToast("Old Data Cleanup", "Invalid old data found in localStorage and removed.", "warning");
                return false;
            }

            if (Array.isArray(parsedData) && parsedData.length > 0) {
                console.warn("Data from very old localStorage version found. This data is NOT automatically migrated. Please use CSV/JSON import if this data is important. The old data has been removed from localStorage to prevent issues.", parsedData.slice(0, 5));
                showToast("Old Data Found & Removed", "Remnants of a very old data version were cleared from localStorage. Please use import if needed.", "info", 7000);
            }
            localStorage.removeItem(ancientLocalStorageKey);

            localStorage.removeItem(DAILY_RECOMMENDATION_ID_KEY.replace('_v2', ''));
            localStorage.removeItem(DAILY_RECOMMENDATION_DATE_KEY.replace('_v2', ''));
            localStorage.removeItem(DAILY_REC_SKIP_COUNT_KEY.replace('_v2', ''));
            return true;
        }
    } catch (e) {
        console.error("Error during very old localStorage data cleanup:", e);
    }
    return false;
}
// END CHUNK: Legacy LocalStorage Cleanup

// START CHUNK: Relationship Graph Integrity Check
function recalculateAndApplyAllRelationships() {
    if (!Array.isArray(movieData) || movieData.length === 0) return;

    const adj = new Map();
    const movieIds = new Set(movieData.filter(m => m && m.id).map(m => m.id));
    const movieMap = new Map();

    // Step 1: Build adjacency list and movie map from existing relationships
    movieData.forEach(movie => {
        if (!movie || !movie.id) return;
        movieMap.set(movie.id, movie);
        if (!adj.has(movie.id)) adj.set(movie.id, new Set());

        const validRelatedIds = (movie.relatedEntries || [])
            .filter(id => id && movieIds.has(id) && id !== movie.id);

        validRelatedIds.forEach(relatedId => {
            adj.get(movie.id).add(relatedId);
            if (!adj.has(relatedId)) adj.set(relatedId, new Set());
            adj.get(relatedId).add(movie.id); // Ensure bidirectionality
        });
        movie.relatedEntries = validRelatedIds;
    });

    // Step 2: Find connected components via BFS and assign relatedEntries directly (O(N) instead of O(N^2))
    // Performance optimization: Direct component assignment eliminates O(N^2) searching across allComponents.
    const visited = new Set();

    movieData.forEach(movie => {
        if (!movie || !movie.id || visited.has(movie.id)) return;

        const currentComponent = [];
        const queue = [movie.id];
        visited.add(movie.id);

        let head = 0;
        while (head < queue.length) {
            const nodeId = queue[head++];
            if (!nodeId) continue;
            currentComponent.push(nodeId);

            const neighbors = adj.get(nodeId);
            if (neighbors) {
                neighbors.forEach(neighborId => {
                    if (neighborId && !visited.has(neighborId)) {
                        visited.add(neighborId);
                        queue.push(neighborId);
                    }
                });
            }
        }

        // Direct assignment per component
        if (currentComponent.length === 1) {
            const m = movieMap.get(currentComponent[0]);
            if (m) m.relatedEntries = [];
        } else {
            currentComponent.forEach(id => {
                const m = movieMap.get(id);
                if (m) {
                    m.relatedEntries = currentComponent.filter(otherId => otherId !== id);
                }
            });
        }
    });
}