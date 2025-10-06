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
        const request = store.put(dataToStore, IDB_USER_DATA_KEY);

        return new Promise((resolve, reject) => {
            request.onsuccess = () => {
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
        const request = store.get(IDB_USER_DATA_KEY);

        return await new Promise((resolve, reject) => {
            request.onsuccess = (event) => {
                const jsonData = event.target.result;
                if (jsonData) {
                    try {
                        let parsedData = JSON.parse(jsonData);
                        if (Array.isArray(parsedData)) {
                            // --- MODIFIED: Filter out soft-deleted entries on load ---
                            parsedData = parsedData.filter(entry => !entry.is_deleted);
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
                        writeStore.delete(IDB_USER_DATA_KEY);
                        
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
    const movieIds = new Set(movieData.map(m => m.id));

    // Step 1: Build adjacency list from existing relationships
    movieData.forEach(movie => {
        if (!movie || !movie.id) return;
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

    // Step 2: Find all connected components using Breadth-First Search (BFS)
    const visited = new Set();
    const allComponents = [];

    movieData.forEach(movie => {
        if (!movie || !movie.id || visited.has(movie.id)) return;

        const currentComponent = new Set();
        const queue = [movie.id];
        visited.add(movie.id);

        let head = 0;
        while(head < queue.length) {
            const nodeId = queue[head++];
            if(!nodeId) continue;
            currentComponent.add(nodeId);

            const neighbors = adj.get(nodeId) || new Set();
            neighbors.forEach(neighborId => {
                if (neighborId && !visited.has(neighborId)) {
                    visited.add(neighborId);
                    queue.push(neighborId);
                }
            });
        }
        if (currentComponent.size > 0) allComponents.push(Array.from(currentComponent));
    });

    // Step 3: Update each movie's relatedEntries to be its entire component (minus itself)
    movieData.forEach(movie => {
        if (!movie || !movie.id) return;
        const component = allComponents.find(comp => comp.includes(movie.id));
        if (component) {
            movie.relatedEntries = component.filter(id => id && id !== movie.id && movieIds.has(id));
        } else {
            movie.relatedEntries = (movie.relatedEntries || []).filter(id => id && id !== movie.id && movieIds.has(id));
        }
    });
}