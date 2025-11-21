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
            const request = store.clear(); // Clears all data in the object store

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
// END CHUNK: Clear Local Cache
