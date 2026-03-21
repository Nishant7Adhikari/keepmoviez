/* js/indexeddb.js */
// START CHUNK: Open IndexedDB Database
async function openDatabase() {
    return new Promise((resolve, reject) => {
        if (!window.indexedDB) {
            console.error("IndexedDB not supported by this browser.");
            showToast("Browser Incompatible", "Local data storage (IndexedDB) is not supported. App may not work correctly.", "error");
            return reject("IndexedDB not supported.");
        }

        // FIX: Reuse existing connection to prevent deadlock on reload/re-init
        if (db) {
            resolve(db);
            return;
        }

        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            const tempDb = event.target.result;
            if (!tempDb.objectStoreNames.contains(STORE_NAME)) {
                tempDb.createObjectStore(STORE_NAME); // Key-value store, key will be IDB_USER_DATA_KEY
            }
            console.log("IndexedDB upgrade needed and processed.");
        };

        request.onsuccess = (event) => {
            db = event.target.result; // Assign to global 'db'
            console.log("IndexedDB opened successfully.");
            resolve(db);
        };

        request.onerror = (event) => {
            console.error("IndexedDB error:", event.target.error);
            showToast("Local Cache Error", "Could not open local data cache. Offline features might be limited.", "error");
            reject(event.target.error);
        };
    });
}
// END CHUNK: Open IndexedDB Database

// START CHUNK: Clear Local Cache
async function clearLocalMovieCache() {
    if (!db) {
        console.warn("Database not open. Cannot clear cache."); // Changed from error to warn
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
            const storageKey = window.currentSupabaseUser ? 'userMovieData_' + window.currentSupabaseUser.id : IDB_USER_DATA_KEY;
            const request = store.delete(storageKey); // Clears specific user data in the object store

            request.onsuccess = () => {
                console.log("Local movie cache cleared from IndexedDB.");
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
