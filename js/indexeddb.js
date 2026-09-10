/* js/indexeddb.js */
// START CHUNK: Open IndexedDB Database
// Holds a single in-flight promise to prevent concurrent open races
let _dbOpenPromise = null;

async function openDatabase() {
    if (!window.indexedDB) {
        console.error("IndexedDB not supported by this browser.");
        showToast("Browser Incompatible", "Local data storage (IndexedDB) is not supported. App may not work correctly.", "error");
        throw new Error("IndexedDB not supported.");
    }

    // Reuse an already-open, validated connection
    if (db && db.objectStoreNames.contains(STORE_NAME)) {
        return db;
    }

    // Coalesce concurrent calls into a single open operation
    if (_dbOpenPromise) {
        return _dbOpenPromise;
    }

    _dbOpenPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            const tempDb = event.target.result;
            if (!tempDb.objectStoreNames.contains(STORE_NAME)) {
                tempDb.createObjectStore(STORE_NAME);
            }
            console.log("IndexedDB upgrade needed and processed.");
        };

        request.onblocked = () => {
            console.warn("IndexedDB open blocked. Close other tabs using this app.");
        };

        request.onsuccess = (event) => {
            const openedDb = event.target.result;

            // Guard: verify the store actually exists (handles corrupt/partial states)
            if (!openedDb.objectStoreNames.contains(STORE_NAME)) {
                console.warn("IndexedDB opened but store missing. Deleting and rebuilding DB...");
                openedDb.close();
                db = null;
                _dbOpenPromise = null;

                const deleteRequest = indexedDB.deleteDatabase(DB_NAME);
                deleteRequest.onsuccess = () => {
                    console.log("Corrupt DB deleted. Reopening fresh...");
                    openDatabase().then(resolve).catch(reject);
                };
                deleteRequest.onerror = (e) => {
                    console.error("Failed to delete corrupt DB:", e.target.error);
                    reject(e.target.error);
                };
                return;
            }

            db = openedDb;
            console.log("IndexedDB opened successfully.");
            resolve(db);
        };

        request.onerror = (event) => {
            _dbOpenPromise = null;
            console.error("IndexedDB error:", event.target.error);
            showToast("Local Cache Error", "Could not open local data cache. Offline features might be limited.", "error");
            reject(event.target.error);
        };
    }).finally(() => {
        // Clear the in-flight promise once settled (success or fail)
        _dbOpenPromise = null;
    });

    return _dbOpenPromise;
}
// END CHUNK: Open IndexedDB Database

// START CHUNK: Clear Local Cache
async function clearLocalMovieCache(userId = null) {
    if (!db) {
        console.warn("Database not open. Cannot clear cache."); 
        try {
            await openDatabase(); // Attempt to open if not already
            if (!db) return Promise.reject("Database could not be opened to clear cache.");
        } catch (error) {
            return Promise.reject("Failed to open database to clear cache.");
        }
    }
    return new Promise((resolve, reject) => {
        try {
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            
            // USE PASSED userId OR FALLBACK to current (if still exists) OR guest key
            const effectiveUserId = userId || window.currentSupabaseUser?.id;
            const storageKey = effectiveUserId ? 'userMovieData_' + effectiveUserId : IDB_USER_DATA_KEY;
            
            const request = store.delete(storageKey);

            request.onsuccess = () => {
                console.log(`Local movie cache (${storageKey}) cleared from IndexedDB.`);
                resolve();
            };
            request.onerror = (event) => {
                console.error("Error clearing local movie cache from IndexedDB:", event.target.error);
                reject(event.target.error);
            };
        } catch (e) {
            console.error("Exception during IndexedDB clear transaction:", e);
            reject(e);
        }
    });
}

// START CHUNK: Abandoned Data Recovery
async function downloadAbandonedData() {
    if (!db) {
        try { await openDatabase(); } catch (e) { return; }
    }
    
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAllKeys();
        
        request.onsuccess = async () => {
            const allKeys = request.result;
            const currentKey = window.currentSupabaseUser ? 'userMovieData_' + window.currentSupabaseUser.id : IDB_USER_DATA_KEY;
            
            const abandonedKeys = allKeys.filter(key => key !== currentKey);
            
            if (abandonedKeys.length === 0) {
                showToast("No Abandoned Data", "No other data found in local storage.", "info");
                return resolve();
            }
            
            let combinedData = [];
            for (const key of abandonedKeys) {
                const data = await new Promise((res) => {
                    const getReq = store.get(key);
                    getReq.onsuccess = () => {
                        try {
                            const parsed = JSON.parse(getReq.result);
                            res(Array.isArray(parsed) ? parsed : []);
                        } catch (e) { res([]); }
                    };
                    getReq.onerror = () => res([]);
                });
                combinedData = combinedData.concat(data);
            }
            
            if (combinedData.length === 0) {
                showToast("Empty Orphan Data", "Managed to find storage blocks, but they were empty or unreadable.", "warning");
                return resolve();
            }
            
            // Remove duplicates by ID across all orphaned sets
            const uniqueMap = new Map();
            combinedData.forEach(item => { if (item && item.id) uniqueMap.set(item.id, item); });
            const finalData = Array.from(uniqueMap.values());

            // Trigger Download
            const dataStr = JSON.stringify(finalData, null, 2);
            const blob = new Blob([dataStr], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `keepmoviez_abandoned_recovery_${new Date().toISOString().slice(0,10)}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            showToast("Recovery Success", `Downloaded ${finalData.length} entries from ${abandonedKeys.length} orphan blocks.`, "success");
            resolve();
        };
        
        request.onerror = (err) => {
            console.error("Failed to fetch all keys:", err);
            showToast("Recovery Failed", "Could not scan local database.", "error");
            reject(err);
        };
    });
}
// END CHUNK: Abandoned Data Recovery
