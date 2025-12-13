// supabase.js
// START CHUNK: 1: Supabase Data Transformation Helpers
function localEntryToSupabaseFormat(localEntry, userId) {
    if (!localEntry || !localEntry.id || !userId) { console.error("Invalid input to localEntryToSupabaseFormat", { localEntry, userId }); return null; }
    
    const entryToFormat = { ...localEntry };
    delete entryToFormat._sync_state;

    let lastModified = entryToFormat.lastModifiedDate || new Date().toISOString();
    try { const dateObj = new Date(lastModified); if (isNaN(dateObj.getTime())) throw new Error(`Invalid date: ${lastModified}`); lastModified = dateObj.toISOString(); }
    catch (e) { console.warn(`Invalid lastModifiedDate for ${entryToFormat.id}, using current. Original: ${entryToFormat.lastModifiedDate}. Error: ${e.message}`); lastModified = new Date().toISOString(); }
    
    const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;
    const watchHistoryWithUUIDs = (entryToFormat.watchHistory || []).map(wh => {
        if (!wh || typeof wh !== 'object') return null;
        const ratingValue = (wh.rating !== null && wh.rating !== undefined && String(wh.rating).trim() !== '') ? parseFloat(wh.rating) : null;
        return { ...wh, watchId: (wh.watchId && uuidRegex.test(wh.watchId)) ? wh.watchId : generateUUID(), rating: isNaN(ratingValue) ? null : ratingValue };
    }).filter(Boolean);
    
    const parseNumeric = (value, isFloat = false) => { if (value === null || value === undefined || String(value).trim() === '') return null; const num = isFloat ? parseFloat(value) : parseInt(value, 10); return isNaN(num) ? null : num; };
    const runtimeValue = (typeof entryToFormat.runtime === 'object' || typeof entryToFormat.runtime === 'number') ? entryToFormat.runtime : parseNumeric(entryToFormat.runtime);

    const supabaseRow = {
        id: entryToFormat.id, user_id: userId, name: entryToFormat.Name || 'Untitled Entry', category: entryToFormat.Category || 'Movie', genre: entryToFormat.Genre || '', status: entryToFormat.Status || 'To Watch',
        seasons_completed: parseNumeric(entryToFormat.seasonsCompleted), current_season_episodes_watched: parseNumeric(entryToFormat.currentSeasonEpisodesWatched),
        recommendation: entryToFormat.Recommendation || null, overall_rating: parseNumeric(entryToFormat.overallRating, true),
        personal_recommendation: entryToFormat.personalRecommendation || null, language: entryToFormat.Language || null, year: parseNumeric(entryToFormat.Year), country: entryToFormat.Country || null,
        description: entryToFormat.Description || null, poster_url: entryToFormat['Poster URL'] || null, watch_history: watchHistoryWithUUIDs,
        related_entries: Array.isArray(entryToFormat.relatedEntries) ? entryToFormat.relatedEntries : [], do_not_recommend_daily: entryToFormat.doNotRecommendDaily || false,
        last_modified_date: lastModified, tmdb_id: parseNumeric(entryToFormat.tmdbId), tmdb_media_type: entryToFormat.tmdbMediaType || null,
        keywords: Array.isArray(entryToFormat.keywords) ? entryToFormat.keywords : [], tmdb_collection_id: parseNumeric(entryToFormat.tmdb_collection_id),
        tmdb_collection_name: entryToFormat.tmdb_collection_name || null, tmdb_collection_total_parts: parseNumeric(entryToFormat.tmdb_collection_total_parts), director_info: entryToFormat.director_info || null,
        full_cast: Array.isArray(entryToFormat.full_cast) ? entryToFormat.full_cast : [], production_companies: Array.isArray(entryToFormat.production_companies) ? entryToFormat.production_companies : [],
        tmdb_vote_average: parseNumeric(entryToFormat.tmdb_vote_average, true), tmdb_vote_count: parseNumeric(entryToFormat.tmdb_vote_count), runtime: runtimeValue,
        is_deleted: entryToFormat.is_deleted || false,
        imdb_id: entryToFormat.imdb_id || null
    };
    return supabaseRow;
}

function supabaseEntryToLocalFormat(supabaseEntry) {
    if (!supabaseEntry || !supabaseEntry.id) { console.error("Invalid Supabase entry to supabaseEntryToLocalFormat.", supabaseEntry); return null; }
    const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;
    const watchHistoryWithUUIDs = (supabaseEntry.watch_history || []).map(wh => {
        if (!wh || typeof wh !== 'object') return null;
        return { ...wh, watchId: (wh.watchId && uuidRegex.test(wh.watchId)) ? wh.watchId : generateUUID(), rating: (wh.rating !== null && wh.rating !== undefined) ? String(wh.rating) : '' };
    }).filter(Boolean);
    const formatNumericToString = (value) => (value !== null && value !== undefined && typeof value !== 'object') ? String(value) : '';
    let localRuntime = null;
    if (typeof supabaseEntry.runtime === 'number') { localRuntime = supabaseEntry.runtime; } else if (typeof supabaseEntry.runtime === 'object' && supabaseEntry.runtime !== null) { localRuntime = supabaseEntry.runtime; }
    return {
        id: supabaseEntry.id, Name: supabaseEntry.name || 'Untitled (from Cloud)', Category: supabaseEntry.category || 'Movie', Genre: supabaseEntry.genre || '', Status: supabaseEntry.status || 'To Watch',
        seasonsCompleted: supabaseEntry.seasons_completed, currentSeasonEpisodesWatched: supabaseEntry.current_season_episodes_watched,
        Recommendation: supabaseEntry.recommendation || '', overallRating: formatNumericToString(supabaseEntry.overall_rating),
        personalRecommendation: supabaseEntry.personal_recommendation || '', Language: supabaseEntry.language || '', Year: formatNumericToString(supabaseEntry.year),
        Country: supabaseEntry.country || '', Description: supabaseEntry.description || '', 'Poster URL': supabaseEntry.poster_url || '',
        watchHistory: watchHistoryWithUUIDs, relatedEntries: Array.isArray(supabaseEntry.related_entries) ? supabaseEntry.related_entries : [],
        doNotRecommendDaily: supabaseEntry.do_not_recommend_daily || false, lastModifiedDate: supabaseEntry.last_modified_date ? new Date(supabaseEntry.last_modified_date).toISOString() : new Date(0).toISOString(),
        tmdbId: formatNumericToString(supabaseEntry.tmdb_id), tmdbMediaType: supabaseEntry.tmdb_media_type || null,
        keywords: Array.isArray(supabaseEntry.keywords) ? supabaseEntry.keywords : [],
        tmdb_collection_id: supabaseEntry.tmdb_collection_id !== null ? supabaseEntry.tmdb_collection_id : null,
        tmdb_collection_name: supabaseEntry.tmdb_collection_name || null, tmdb_collection_total_parts: supabaseEntry.tmdb_collection_total_parts, director_info: supabaseEntry.director_info || null,
        full_cast: Array.isArray(supabaseEntry.full_cast) ? supabaseEntry.full_cast : [],
        production_companies: Array.isArray(supabaseEntry.production_companies) ? supabaseEntry.production_companies : [],
        tmdb_vote_average: supabaseEntry.tmdb_vote_average !== null ? parseFloat(supabaseEntry.tmdb_vote_average) : null,
        tmdb_vote_count: supabaseEntry.tmdb_vote_count !== null ? parseInt(supabaseEntry.tmdb_vote_count) : null,
        runtime: localRuntime,
        is_deleted: supabaseEntry.is_deleted || false,
        imdb_id: supabaseEntry.imdb_id || null,
        _sync_state: 'synced'
    };
}
// END CHUNK: 1: Supabase Data Transformation Helpers

//START CHUNK: 2: Comprehensive Two-Way Sync (REWRITTEN)
async function comprehensiveSync(silent = false) {
    if (!window.supabaseClient || !currentSupabaseUser) {
        if (!silent) showToast("Not Logged In", "Please log in to sync data.", "error");
        return { success: false, error: "Not logged in" };
    }
    if (!navigator.onLine) {
        if (!silent) showToast("Offline", "You are offline. Sync will resume when you reconnect.", "warning");
        return { success: false, error: "Offline" };
    }
    if (!silent) showLoading("Syncing with cloud...");

    try {
        let changesMade = false;
        let pushedCount = 0, pulledCount = 0, deletedCount = 0;

        if (!silent) showLoading("Analyzing local changes...");
        const entriesToCreate = movieData.filter(e => e._sync_state === 'new');
        const entriesToUpdate = movieData.filter(e => e._sync_state === 'edited');
        const entriesToDelete = movieData.filter(e => e._sync_state === 'deleted');

        if (entriesToDelete.length > 0) {
            if (!silent) showLoading(`Syncing ${entriesToDelete.length} deletions...`);
            const { error } = await window.supabaseClient.from('movie_entries')
                .update({ is_deleted: true, last_modified_date: new Date().toISOString() })
                .in('id', entriesToDelete.map(e => e.id));
            if (error) throw new Error(`Syncing deletions failed: ${error.message}`);
            deletedCount = entriesToDelete.length;
            changesMade = true;
        }

        const entriesToUpsert = [...entriesToCreate, ...entriesToUpdate];
        if (entriesToUpsert.length > 0) {
            if (!silent) showLoading(`Uploading ${entriesToUpsert.length} changes...`);
            const supabaseFormatted = entriesToUpsert.map(e => localEntryToSupabaseFormat(e, currentSupabaseUser.id)).filter(Boolean);
            if (supabaseFormatted.length > 0) {
                const { error } = await window.supabaseClient.from('movie_entries').upsert(supabaseFormatted);
                if (error) throw new Error(`Uploading changes failed: ${error.message}`);
                pushedCount = entriesToUpsert.length;
                changesMade = true;
            }
        }

        if (!silent) showLoading("Checking for remote updates...");
        const { data: remoteState, error: fetchError } = await window.supabaseClient
            .from('movie_entries')
            .select('id, last_modified_date')
            .eq('user_id', currentSupabaseUser.id)
            .eq('is_deleted', false);
        if (fetchError) throw new Error(`Fetching remote state failed: ${fetchError.message}`);
        const remoteStateMap = new Map(remoteState.map(e => [e.id, e.last_modified_date]));

        const localStateMap = new Map(movieData.map(e => [e.id, e.lastModifiedDate]));
        const idsToPull = [];

        for (const [id, remoteLMD] of remoteStateMap.entries()) {
            const localLMD = localStateMap.get(id);
            if (!localLMD || new Date(remoteLMD) > new Date(localLMD)) {
                idsToPull.push(id);
            }
        }

        if (idsToPull.length > 0) {
            if (!silent) showLoading(`Downloading ${idsToPull.length} remote updates...`);
            const { data: entriesToPullData, error: pullError } = await window.supabaseClient
                .from('movie_entries')
                .select('*')
                .in('id', idsToPull)
                .eq('user_id', currentSupabaseUser.id)
                .eq('is_deleted', false);
            if (pullError) throw new Error(`Downloading remote entries failed: ${pullError.message}`);
            
            pulledCount = entriesToPullData.length;
            changesMade = true;

            const localDataMap = new Map(movieData.map(e => [e.id, e]));
            entriesToPullData.forEach(remoteEntry => {
                localDataMap.set(remoteEntry.id, supabaseEntryToLocalFormat(remoteEntry));
            });
            movieData = Array.from(localDataMap.values());
        }

        if (changesMade) {
            movieData = movieData.filter(e => !e.is_deleted);
            movieData.forEach(e => e._sync_state = 'synced');
            
            recalculateAndApplyAllRelationships();
            sortMovies(currentSortColumn, currentSortDirection);
            await saveToIndexedDB();
            
            // FIX: Clear stats cache and update achievements so UI reflects new data
            if(window.globalStatsData) window.globalStatsData = {};
            if(typeof checkAndNotifyNewAchievements === 'function') await checkAndNotifyNewAchievements();

            if (!silent) renderMovieCards();
        }
        
        const summary = `Pulled: ${pulledCount}, Pushed: ${pushedCount}, Deleted: ${deletedCount}`;
        if (changesMade) {
            showToast("Sync Complete", summary, "success");
        } else if (!silent) {
            showToast("All Synced", "Your data is up-to-date.", "info");
        }

        incrementLocalStorageCounter('sync_count_achievement');
        return { success: true, summary };

    } catch (error) {
        console.error("Error during comprehensiveSync:", error);
        if (!silent) showToast("Sync Failed", `${error.message}`, "error", 10000);
        return { success: false, error: error.message };
    } finally {
        if (!silent) hideLoading();
    }
}
// END CHUNK: 2

// START CHUNK: Force Pull
async function forcePullFromSupabase() {
    if (!window.supabaseClient || !currentSupabaseUser) {
        showToast("Not Logged In", "Please log in to perform this action.", "error");
        return;
    }
    showLoading("Force Pulling... Erasing local data...");

    try {
        // Step 1: Fetch ALL data from the cloud for the current user
        const { data: cloudData, error: fetchError } = await window.supabaseClient
            .from('movie_entries')
            .select('*')
            .eq('user_id', currentSupabaseUser.id)
            .eq('is_deleted', false);
        
        if (fetchError) throw new Error(`Could not fetch cloud data: ${fetchError.message}`);
        
        showLoading(`Found ${cloudData.length} entries in cloud. Replacing local data...`);

        // Step 2: Transform the cloud data into the local format
        const newLocalData = cloudData.map(entry => supabaseEntryToLocalFormat(entry));

        // Step 3: Completely replace the local movieData array
        movieData = newLocalData;

        // Step 4: Ensure graph integrity and save to IndexedDB
        recalculateAndApplyAllRelationships();
        sortMovies(currentSortColumn, currentSortDirection);
        await saveToIndexedDB();

        // FIX: Clear stats cache and update achievements
        if(window.globalStatsData) window.globalStatsData = {};
        if(typeof checkAndNotifyNewAchievements === 'function') await checkAndNotifyNewAchievements();

        // Step 5: Re-render the UI and provide feedback
        renderMovieCards();
        showToast("Force Pull Complete", "Your local data now matches the cloud.", "success");

    } catch (error) {
        console.error("Error during Force Pull:", error);
        showToast("Force Pull Failed", `Error: ${error.message}`, "error");
    } finally {
        hideLoading();
    }
}
// END CHUNK: Force Pull

// START CHUNK: Force Push
async function forcePushToSupabase() {
    if (!window.supabaseClient || !currentSupabaseUser) {
        showToast("Not Logged In", "Please log in to perform this action.", "error");
        return;
    }
    showLoading("Force Pushing... Deleting cloud data...");

    try {
        const userId = currentSupabaseUser.id;
        
        // Step 1: Delete all existing records for this user in Supabase.
        const { error: deleteError } = await window.supabaseClient
            .from('movie_entries')
            .delete()
            .eq('user_id', userId);

        if (deleteError) throw new Error(`Could not clear cloud data: ${deleteError.message}`);

        showLoading("Cloud data cleared. Uploading local collection...");

        // Step 2: Prepare the entire local database for upload (excluding soft-deleted items)
        const localDataToPush = movieData
            .filter(entry => !entry.is_deleted)
            .map(entry => localEntryToSupabaseFormat(entry, userId))
            .filter(Boolean);

        if (localDataToPush.length > 0) {
            // Step 3: Insert all local records into the now-empty cloud table.
            const { error: insertError } = await window.supabaseClient
                .from('movie_entries')
                .insert(localDataToPush);

            if (insertError) throw new Error(`Could not upload local data: ${insertError.message}`);
        }

        // Step 4: Mark all local data as 'synced'
        movieData.forEach(entry => {
            if (!entry.is_deleted) {
                entry._sync_state = 'synced';
            }
        });
        await saveToIndexedDB(); // Save the new sync states locally

        showToast("Force Push Complete", `Successfully uploaded ${localDataToPush.length} entries. Your cloud data now matches this device.`, "success");

    } catch (error) {
        console.error("Error during Force Push:", error);
        showToast("Force Push Failed", `Error: ${error.message}`, "error");
    } finally {
        hideLoading();
    }
}
// END CHUNK: Force Push

// START CHUNK: 3: Authentication and Application State
let currentSupabaseUser = null;
let isAppInitializing = false; // Global flag to prevent race conditions

async function initAuth() {
    showLoading("Initializing...");
    try {
        if (!window.supabaseClient) {
            await resetAppForLogout("Cloud service is not available. Running in offline mode.");
            return;
        }

        const handleUserSession = async (user) => {
            // Prevent double-initialization if already running
            if (isAppInitializing) {
                console.log("Initialization in progress. Skipping duplicate trigger.");
                return;
            }

            // If user is already loaded and UI visible, do nothing (prevents reload loops)
            if (user?.id === currentSupabaseUser?.id && appContent.style.display === 'block') {
                return;
            }

            if (user) {
                try {
                    isAppInitializing = true; // Lock
                    await openDatabase();
                    await initializeApp();
                } catch (dbError) {
                    console.error("CRITICAL: Could not open IndexedDB.", dbError);
                    await resetAppForLogout(`Failed to connect to local database: ${dbError.message}`);
                } finally {
                    isAppInitializing = false; // Unlock
                }
            } else {
                await resetAppForLogout("Your session has ended. Please log in.");
            }
        };
        
        let recoveryToken = null;
        if (window.location.hash.includes('type=recovery')) {
             const params = new URLSearchParams(window.location.hash.substring(1));
             recoveryToken = params.get('access_token');
        }

        if (recoveryToken) {
            console.log("Password recovery token found.");
            document.getElementById('supabaseAuthForm').style.display = 'none';
            document.getElementById('passwordSetupSection').style.display = 'block';
            document.getElementById('authContainer').style.display = 'flex';
            document.getElementById('appContent').style.display = 'none';
            hideLoading();
            return; 
        }

        // Listener for future state changes
        window.supabaseClient.auth.onAuthStateChange(async (event, session) => {
            if (window.location.hash) {
                window.history.replaceState(null, null, window.location.pathname + window.location.search);
            }

            const user = session?.user || null;
            const previousUserId = currentSupabaseUser?.id;
            currentSupabaseUser = user;
            if (typeof updateSyncButtonState === 'function') updateSyncButtonState();

            if (event === 'SIGNED_OUT') {
                await resetAppForLogout("You have been logged out.");
            } else if (event === 'PASSWORD_RECOVERY') {
                document.getElementById('supabaseAuthForm').style.display = 'block';
                document.getElementById('passwordSetupSection').style.display = 'none';
                showToast("Success", "Your password has been updated. Please log in.", "success");
            } else if (user && user.id !== previousUserId) {
                // Only trigger if the user CHANGED. 
                // The initial load is handled by the explicit check below.
                await handleUserSession(user);
            }
        });

        // FIX: TIMEOUT RACE CONDITION & LOCAL FALLBACK
        // If getSession hangs, default to local mode immediately rather than waiting forever or crashing.
        const sessionPromise = window.supabaseClient.auth.getSession();
        const timeoutPromise = new Promise((resolve) => {
            setTimeout(() => {
                console.log("Auth check timed out. Defaulting to local mode.");
                resolve({ data: { session: null }, error: null }); 
            }, 2000); // 2 second timeout
        });

        const { data: { session } } = await Promise.race([sessionPromise, timeoutPromise]);

        if (session?.user) {
            currentSupabaseUser = session.user;
            if (typeof updateSyncButtonState === 'function') updateSyncButtonState();
            await handleUserSession(session.user);
        } else {
            // FIX: If not logged in (or offline), attempt to load local data anyway
            // instead of showing login screen with no data.
            console.log("No session found or offline. Loading local data...");
            await openDatabase(); // Ensure DB is open
            await initializeApp(); 
        }

    } catch (error) {
        console.error("Authentication initialization failed:", error);
        // Fallback to local on error
        await initializeApp();
    }
}


async function initializeApp() {
    showLoading("Loading your collection...");
    try {
        // 1. Load data from IndexedDB (fast local load)
        movieData = await loadFromIndexedDB();
        console.log(`Loaded ${movieData.length} entries from local cache.`);
        
        // STRICT SYNC POLICY:
        // No auto-sync on load. 
        // The app will rely entirely on the local IndexedDB cache until the user clicks "Sync".
        if (currentSupabaseUser) {
             console.log("User logged in. Ready for manual sync.");
        }

        // 2. Process and Render UI
        if (typeof recalculateAndApplyAllRelationships === 'function') recalculateAndApplyAllRelationships();
        sortMovies(currentSortColumn, currentSortDirection);
        if (typeof renderMovieCards === 'function') renderMovieCards();
        if (typeof populateGenreDropdown === 'function') populateGenreDropdown();
        
        await window.checkAndNotifyNewAchievements(true);

        if (typeof migrateVeryOldLocalStorageData === 'function') {
            await migrateVeryOldLocalStorageData();
        }

        // 3. Show the main UI
        if (authContainer) authContainer.style.display = 'none';
        if (appContent) appContent.style.display = 'block';

    } catch (error) {
        console.error("Critical error during app initialization:", error);
        showToast("Application Start Failed", `Error: ${error.message}`, "error", 0);
        await resetAppForLogout(`Failed to start: ${error.message}`);
    } finally {
        hideLoading();
    }
}

async function resetAppForLogout(message) {
    console.warn("Resetting application UI. Message:", message); 
    if (currentSupabaseUser) {
        sessionStorage.removeItem(`hasSynced_${currentSupabaseUser.id}`);
    }
    
    // FIX: DO NOT CLEAR MOVIE DATA FROM MEMORY OR DISK ON LOGOUT
    // movieData = []; 
    currentSupabaseUser = null;
    
    // FIX: CRITICAL - COMMENTED OUT TO PREVENT DATA LOSS FOR OFFLINE USERS
    // if (typeof clearLocalMovieCache === 'function') await clearLocalMovieCache(); 

    if (typeof destroyCharts === 'function') destroyCharts(chartInstances);
    
    // If we have data, stay in "Offline/Guest" mode rather than showing login screen
    if (movieData && movieData.length > 0) {
        showToast("Logged Out", "You are now working in local/offline mode.", "info");
        document.getElementById('menuLoggedInUserEmail').textContent = "Not logged in (Local Mode)";
        if (typeof updateSyncButtonState === 'function') updateSyncButtonState();
        hideLoading();
        return; 
    }

    if (window.isMultiSelectMode && typeof window.disableMultiSelectMode === 'function') window.disableMultiSelectMode();
    if (typeof $ !== 'undefined' && $.fn.modal) $('.modal.show').modal('hide');
    document.getElementById('appMenu')?.classList.remove('show');
    document.getElementById('appMenuBackdrop')?.classList.remove('show');
    if (typeof renderMovieCards === 'function') renderMovieCards();
    if (appContent) appContent.style.display = 'none';
    if (authContainer) authContainer.style.display = 'flex';
    
    const authMessageEl = document.getElementById('authMessage');
    if (authMessageEl) authMessageEl.textContent = message;
    const passwordInput = document.getElementById('supabasePassword');
    if (passwordInput) passwordInput.value = '';
    const authErrorDiv = document.getElementById('authError');
    if (authErrorDiv) { authErrorDiv.textContent = ''; authErrorDiv.style.display = 'none'; }

    // FORCE loading overlay to hide
    hideLoading();
    
    if (message !== "Please log in to continue.") {
        showToast("Session Ended", message, "info");
    }
}
// END CHUNK: 3: Authentication and Application State

// START CHUNK: 4: User Authentication Actions

// NEW: Helper function for client-side auth validation
function validateAuthForm(email, password, isSignUp = false) {
    const authErrorDiv = document.getElementById('authError');
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!email || !password) {
        authErrorDiv.textContent = "Email and password cannot be empty.";
        authErrorDiv.style.display = 'block';
        return false;
    }
    if (!emailRegex.test(email)) {
        authErrorDiv.textContent = "Please enter a valid email address.";
        authErrorDiv.style.display = 'block';
        return false;
    }
    if (password.length < 6) {
        authErrorDiv.textContent = "Password must be at least 6 characters long.";
        authErrorDiv.style.display = 'block';
        return false;
    }
    
    authErrorDiv.style.display = 'none';
    return true;
}


async function supabaseSignInUser(email, password) {
    const authErrorDiv = document.getElementById('authError');
    if (!validateAuthForm(email, password)) return; // MODIFIED: Added validation
    
    showLoading("Signing in...");
    try {
        const { error } = await window.supabaseClient.auth.signInWithPassword({ email, password });
        if (error) throw error;
    } catch (error) {
        console.error("Sign in error:", error);
        if (authErrorDiv) { authErrorDiv.textContent = error.message; authErrorDiv.style.display = 'block'; }
        showToast("Login Failed", error.message, "error");
    } finally {
        hideLoading();
    }
}

async function supabaseSignInWithGoogle() {
    showLoading("Redirecting to Google...");
    try {
        // MODIFIED: Use a clean redirect URL without the hash
        const cleanRedirectTo = window.location.origin + window.location.pathname;
        const { error } = await window.supabaseClient.auth.signInWithOAuth({
            provider: 'google',
            options: {
                redirectTo: cleanRedirectTo, 
            },
        });
        if (error) throw error;
    } catch (error) {
        console.error("Google sign in error:", error);
        showToast("Google Sign-In Failed", error.message, "error");
        hideLoading();
    }
}

async function supabaseSignUpUser(email, password) {
    const authErrorDiv = document.getElementById('authError');
    if (!validateAuthForm(email, password, true)) return; // MODIFIED: Added validation
    
    showLoading("Creating account...");
    try {
        const { error } = await window.supabaseClient.auth.signUp({ email, password });
        if (error) throw error;
        showToast("Account Created", "Please check your email to verify your account.", "success", 10000);
        const authMessageEl = document.getElementById('authMessage');
        if (authMessageEl) authMessageEl.textContent = "Verification email sent! Please check your inbox.";
    } catch (error) {
        console.error("Sign up error:", error);
        if (authErrorDiv) { authErrorDiv.textContent = error.message; authErrorDiv.style.display = 'block'; }
        showToast("Sign Up Failed", error.message, "error");
    } finally {
        hideLoading();
    }
}
async function supabaseSignOutUser() {
    showLoading("Signing out...");
    try {
        const { error } = await window.supabaseClient.auth.signOut();
        if (error && error.name !== 'AuthSessionMissingError') throw error;
    } catch (error) {
        console.error("Sign out error:", error);
        showToast("Logout Error", error.message, "error");
    } finally {
        hideLoading();
    }
}
async function supabaseSendPasswordResetEmail(email) {
    const authErrorDiv = document.getElementById('authError');
    authErrorDiv.style.display = 'none';

    // NEW: Client-side validation for the email field
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
         authErrorDiv.textContent = "Please enter a valid email address.";
         authErrorDiv.style.display = 'block';
         return;
    }
    
    showLoading("Sending reset link...");
    try {
        // MODIFIED: Use a clean redirect URL without the hash
        const cleanRedirectTo = window.location.origin + window.location.pathname;
        const { error } = await window.supabaseClient.auth.resetPasswordForEmail(email, { redirectTo: cleanRedirectTo });
        if (error) throw error;
        showToast("Check Your Email", "A password reset link has been sent.", "success", 8000);
        const authMessageEl = document.getElementById('authMessage');
        if (authMessageEl) authMessageEl.textContent = "Password reset link sent! Please check your inbox.";
    } catch (error) {
        console.error("Password reset error:", error);
        if (authErrorDiv) { authErrorDiv.textContent = error.message; authErrorDiv.style.display = 'block'; }
        showToast("Reset Failed", error.message, "error");
    } finally {
        hideLoading();
    }
}

async function supabaseUpdateUserPassword(newPassword) {
    const errorDiv = document.getElementById('passwordResetError');
    errorDiv.style.display = 'none';
    showLoading("Updating password...");
    try {
        const { error } = await window.supabaseClient.auth.updateUser({ password: newPassword });
        if (error) throw error;
        // The onAuthStateChange listener will handle the success message and UI swap
    } catch (error) {
        console.error("Password update error:", error);
        errorDiv.textContent = error.message;
        errorDiv.style.display = 'block';
        showToast("Update Failed", error.message, "error");
    } finally {
        hideLoading();
    }
}
// END CHUNK: 4

//START CHUNK: 5: High-Level Data Actions (REWRITTEN)
async function eraseAllData() {
    const scopeElement = document.getElementById('eraseDataScope');
    if (!scopeElement) {
        showToast("Error", "Erase scope UI missing.", "error");
        return;
    }
    const scope = scopeElement.value;
    if (!confirm(`ERASING DATA: Scope: "${scope}". This is IRREVERSIBLE. Are you sure?`)) {
        $('#confirmEraseDataModal').modal('hide');
        return;
    }

    let message = "", eraseLocalCache = false, eraseCloudData = false;
    
    switch (scope) {
        case 'local':
            message = "Erasing local cache...";
            eraseLocalCache = true;
            break;
        case 'cloud':
            if (!currentSupabaseUser) {
                showToast("Not Logged In", "Cannot erase cloud data.", "error");
                $('#confirmEraseDataModal').modal('hide');
                return;
            }
            message = "Marking all cloud data for deletion...";
            eraseCloudData = true;
            break;
        case 'both':
            message = "Erasing local and cloud data...";
            eraseLocalCache = true;
            if (currentSupabaseUser) {
                eraseCloudData = true;
            } else {
                showToast("Cloud Skipped", "Not logged in. Only local data will be erased.", "warning", 4000);
            }
            break;
        default:
            showToast("Error", "Invalid erase scope.", "error");
            $('#confirmEraseDataModal').modal('hide');
            return;
    }

    showLoading(message);
    try {
        if (eraseCloudData) {
            const { error: updateError } = await window.supabaseClient
                .from('movie_entries')
                .update({ is_deleted: true, last_modified_date: new Date().toISOString() })
                .eq('user_id', currentSupabaseUser.id);
            if (updateError) {
                throw new Error(`Cloud erase (soft-delete) failed: ${updateError.message}`);
            }
            showToast("Cloud Data Erased", "All cloud entries marked for deletion.", "warning");
        }

        if (eraseLocalCache) {
            if (typeof clearLocalMovieCache === 'function') await clearLocalMovieCache();
            if (currentSupabaseUser) localStorage.removeItem(`hasSynced_${currentSupabaseUser.id}`);
            movieData = [];
            const keysToClear = [DAILY_RECOMMENDATION_ID_KEY, DAILY_RECOMMENDATION_DATE_KEY, DAILY_REC_SKIP_COUNT_KEY, ...Object.values(DO_NOT_SHOW_AGAIN_KEYS)];
            keysToClear.forEach(key => { if (key) localStorage.removeItem(key); });
            showToast("Local Cache Erased", "Local data and settings cleared.", "warning", undefined, DO_NOT_SHOW_AGAIN_KEYS.DATA_ERASED);
        }

        $('#confirmEraseDataModal').modal('hide');
        if (typeof renderMovieCards === 'function') renderMovieCards();

        // If user erased cloud but not local, a sync will now correctly clear their local data.
        if (eraseCloudData && !eraseLocalCache && currentSupabaseUser) {
            showToast("Cloud Cleared", "Syncing to update local device...", "info");
            await comprehensiveSync();
        }

    } catch (error) {
        console.error("Error erasing data:", error);
        showToast("Erase Failed", `Failed: ${error.message}.`, "error", 7000);
    } finally {
        hideLoading();
    }
}
