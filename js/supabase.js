// supabase.js
// START CHUNK: 1: Supabase Data Transformation Helpers
function localEntryToSupabaseFormat(localEntry, userId) {
  if (!localEntry || !localEntry.id || !userId) {
    console.error("Invalid input to localEntryToSupabaseFormat", {
      localEntry,
      userId,
    });
    return null;
  }

  const entryToFormat = { ...localEntry };
  delete entryToFormat._sync_state;

  let lastModified = entryToFormat.lastModifiedDate || new Date().toISOString();
  try {
    const dateObj = new Date(lastModified);
    if (isNaN(dateObj.getTime()))
      throw new Error(`Invalid date: ${lastModified}`);
    lastModified = dateObj.toISOString();
  } catch (e) {
    console.warn(
      `Invalid lastModifiedDate for ${entryToFormat.id}, using current. Original: ${entryToFormat.lastModifiedDate}. Error: ${e.message}`,
    );
    lastModified = new Date().toISOString();
  }

  const uuidRegex =
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;
  const watchHistoryWithUUIDs = (entryToFormat.watchHistory || [])
    .map((wh) => {
      if (!wh || typeof wh !== "object") return null;
      const ratingValue =
        wh.rating !== null &&
        wh.rating !== undefined &&
        String(wh.rating).trim() !== ""
          ? parseFloat(wh.rating)
          : null;
      return {
        ...wh,
        watchId:
          wh.watchId && uuidRegex.test(wh.watchId)
            ? wh.watchId
            : generateUUID(),
        rating: isNaN(ratingValue) ? null : ratingValue,
      };
    })
    .filter(Boolean);

  const parseNumeric = (value, isFloat = false) => {
    if (value === null || value === undefined || String(value).trim() === "")
      return null;
    const num = isFloat ? parseFloat(value) : parseInt(value, 10);
    return isNaN(num) ? null : num;
  };
  const runtimeValue =
    typeof entryToFormat.runtime === "object" ||
    typeof entryToFormat.runtime === "number"
      ? entryToFormat.runtime
      : parseNumeric(entryToFormat.runtime);

  const supabaseRow = {
    id: entryToFormat.id,
    user_id: userId,
    name: entryToFormat.Name || "Untitled Entry",
    category: entryToFormat.Category || "Movie",
    genre: entryToFormat.Genre || "",
    status: entryToFormat.Status || "To Watch",
    seasons_completed: parseNumeric(entryToFormat.seasonsCompleted),
    current_season_episodes_watched: parseNumeric(
      entryToFormat.currentSeasonEpisodesWatched,
    ),
    recommendation: entryToFormat.Recommendation || null,
    overall_rating: parseNumeric(entryToFormat.overallRating, true),
    personal_recommendation: entryToFormat.personalRecommendation || null,
    language: entryToFormat.Language || null,
    year: parseNumeric(entryToFormat.Year),
    country: entryToFormat.Country || null,
    description: entryToFormat.Description || null,
    poster_url: entryToFormat["Poster URL"] || null,
    watch_history: watchHistoryWithUUIDs,
    related_entries: Array.isArray(entryToFormat.relatedEntries)
      ? entryToFormat.relatedEntries
      : [],
    do_not_recommend_daily: entryToFormat.doNotRecommendDaily || false,
    last_modified_date: lastModified,
    tmdb_id: parseNumeric(entryToFormat.tmdbId),
    tmdb_release_date: entryToFormat.tmdb_release_date || null,
    tmdb_media_type: entryToFormat.tmdbMediaType || null,
    keywords: Array.isArray(entryToFormat.keywords)
      ? entryToFormat.keywords
      : [],
    tmdb_collection_id: parseNumeric(entryToFormat.tmdb_collection_id),
    tmdb_collection_name: entryToFormat.tmdb_collection_name || null,
    tmdb_collection_total_parts: parseNumeric(
      entryToFormat.tmdb_collection_total_parts,
    ),
    director_info: entryToFormat.director_info || null,
    full_cast: Array.isArray(entryToFormat.full_cast)
      ? entryToFormat.full_cast
      : [],
    production_companies: Array.isArray(entryToFormat.production_companies)
      ? entryToFormat.production_companies
      : [],
    tmdb_vote_average: parseNumeric(entryToFormat.tmdb_vote_average, true),
    tmdb_vote_count: parseNumeric(entryToFormat.tmdb_vote_count),
    runtime: runtimeValue,
    is_deleted: entryToFormat.is_deleted || false,
    imdb_id: entryToFormat.imdb_id || null,
  };
  return supabaseRow;
}

function supabaseEntryToLocalFormat(supabaseEntry) {
  if (!supabaseEntry || !supabaseEntry.id) {
    console.error(
      "Invalid Supabase entry to supabaseEntryToLocalFormat.",
      supabaseEntry,
    );
    return null;
  }
  const uuidRegex =
    /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;
  const watchHistoryWithUUIDs = (supabaseEntry.watch_history || [])
    .map((wh) => {
      if (!wh || typeof wh !== "object") return null;
      return {
        ...wh,
        watchId:
          wh.watchId && uuidRegex.test(wh.watchId)
            ? wh.watchId
            : generateUUID(),
        rating:
          wh.rating !== null && wh.rating !== undefined
            ? String(wh.rating)
            : "",
      };
    })
    .filter(Boolean);
  const formatNumericToString = (value) =>
    value !== null && value !== undefined && typeof value !== "object"
      ? String(value)
      : "";
  let localRuntime = null;
  if (typeof supabaseEntry.runtime === "number") {
    localRuntime = supabaseEntry.runtime;
  } else if (
    typeof supabaseEntry.runtime === "object" &&
    supabaseEntry.runtime !== null
  ) {
    localRuntime = supabaseEntry.runtime;
  }
  return {
    id: supabaseEntry.id,
    Name: supabaseEntry.name || "Untitled (from Cloud)",
    Category: supabaseEntry.category || "Movie",
    Genre: supabaseEntry.genre || "",
    Status: supabaseEntry.status || "To Watch",
    seasonsCompleted: supabaseEntry.seasons_completed,
    currentSeasonEpisodesWatched: supabaseEntry.current_season_episodes_watched,
    Recommendation: supabaseEntry.recommendation || "",
    overallRating: formatNumericToString(supabaseEntry.overall_rating),
    personalRecommendation: supabaseEntry.personal_recommendation || "",
    Language: supabaseEntry.language || "",
    Year: formatNumericToString(supabaseEntry.year),
    Country: supabaseEntry.country || "",
    Description: supabaseEntry.description || "",
    "Poster URL": supabaseEntry.poster_url || "",
    watchHistory: watchHistoryWithUUIDs,
    relatedEntries: Array.isArray(supabaseEntry.related_entries)
      ? supabaseEntry.related_entries
      : [],
    doNotRecommendDaily: supabaseEntry.do_not_recommend_daily || false,
    lastModifiedDate: supabaseEntry.last_modified_date
      ? new Date(supabaseEntry.last_modified_date).toISOString()
      : new Date(0).toISOString(),
    tmdbId: formatNumericToString(supabaseEntry.tmdb_id),
    tmdb_release_date: supabaseEntry.tmdb_release_date || null,
    tmdbMediaType: supabaseEntry.tmdb_media_type || null,
    keywords: Array.isArray(supabaseEntry.keywords)
      ? supabaseEntry.keywords
      : [],
    tmdb_collection_id:
      supabaseEntry.tmdb_collection_id !== null
        ? supabaseEntry.tmdb_collection_id
        : null,
    tmdb_collection_name: supabaseEntry.tmdb_collection_name || null,
    tmdb_collection_total_parts: supabaseEntry.tmdb_collection_total_parts,
    director_info: supabaseEntry.director_info || null,
    full_cast: Array.isArray(supabaseEntry.full_cast)
      ? supabaseEntry.full_cast
      : [],
    production_companies: Array.isArray(supabaseEntry.production_companies)
      ? supabaseEntry.production_companies
      : [],
    tmdb_vote_average:
      supabaseEntry.tmdb_vote_average !== null
        ? parseFloat(supabaseEntry.tmdb_vote_average)
        : null,
    tmdb_vote_count:
      supabaseEntry.tmdb_vote_count !== null
        ? parseInt(supabaseEntry.tmdb_vote_count)
        : null,
    runtime: localRuntime,
    is_deleted: supabaseEntry.is_deleted || false,
    imdb_id: supabaseEntry.imdb_id || null,
    _sync_state: "synced",
  };
}
// END CHUNK: 1: Supabase Data Transformation Helpers

//START CHUNK: 2: Comprehensive Two-Way Sync (REWRITTEN)
async function comprehensiveSync(silent = false) {
  if (!window.supabaseClient || !currentSupabaseUser) {
    if (!silent)
      showToast("Not Logged In", "Please log in to sync data.", "error");
    return { success: false, error: "Not logged in" };
  }
  if (!navigator.onLine) {
    if (!silent)
      showToast(
        "Offline",
        "You are offline. Sync will resume when you reconnect.",
        "warning",
      );
    return { success: false, error: "Offline" };
  }
  // --- NEW: Strict Privacy Mode Guard ---
  const currentSyncMode = localStorage.getItem("keepmoviez_sync_mode");
  if (currentSyncMode === "strict_privacy") {
    if (!silent)
      showToast(
        "Privacy Mode Enabled",
        "Sync is disabled in Strict Privacy Mode.",
        "info",
      );
    return { success: false, error: "Privacy Locked" };
  }

  // --- NEW: Sync Lock to prevent loops ---
  if (window.isSyncingInProgress) {
    console.warn("Sync already in progress. Skipping.");
    return { success: false, error: "Locked" };
  }
  window.isSyncingInProgress = true;

  if (!silent) showLoading("Syncing with cloud...");

  try {
    let changesMade = false;
    let pushedCount = 0,
      pulledCount = 0,
      deletedCount = 0;

    if (!silent) showLoading("Analyzing local changes...");
    const entriesToCreate = movieData.filter((e) => e._sync_state === "new");
    const entriesToUpdate = movieData.filter((e) => e._sync_state === "edited");
    const entriesToDelete = movieData.filter(
      (e) => e._sync_state === "deleted",
    );

    if (entriesToDelete.length > 0) {
      if (!silent)
        showLoading(`Syncing ${entriesToDelete.length} deletions...`);
      const { error } = await window.supabaseClient
        .from("movie_entries")
        .update({
          is_deleted: true,
          last_modified_date: new Date().toISOString(),
        })
        .in(
          "id",
          entriesToDelete.map((e) => e.id),
        );
      if (error) throw new Error(`Syncing deletions failed: ${error.message}`);
      deletedCount = entriesToDelete.length;
      changesMade = true;
    }

    const entriesToUpsert = [...entriesToCreate, ...entriesToUpdate];
    if (entriesToUpsert.length > 0) {
      if (!silent)
        showLoading(`Uploading ${entriesToUpsert.length} changes...`);
      const supabaseFormatted = entriesToUpsert
        .map((e) => localEntryToSupabaseFormat(e, currentSupabaseUser.id))
        .filter(Boolean);
      if (supabaseFormatted.length > 0) {
        const { error } = await window.supabaseClient
          .from("movie_entries")
          .upsert(supabaseFormatted);
        if (error)
          throw new Error(`Uploading changes failed: ${error.message}`);
        pushedCount = entriesToUpsert.length;
        changesMade = true;
      }
    }

    if (!silent) showLoading("Checking for remote updates...");
    const { data: remoteState, error: fetchError } = await window.supabaseClient
      .from("movie_entries")
      .select("id, last_modified_date")
      .eq("user_id", currentSupabaseUser.id)
      .eq("is_deleted", false);
    if (fetchError)
      throw new Error(`Fetching remote state failed: ${fetchError.message}`);
    const remoteStateMap = new Map(
      remoteState.map((e) => [e.id, e.last_modified_date]),
    );

    const localStateMap = new Map(
      movieData.map((e) => [e.id, e.lastModifiedDate]),
    );
    const idsToPull = [];

    for (const [id, remoteLMD] of remoteStateMap.entries()) {
      const localLMD = localStateMap.get(id);
      if (!localLMD || new Date(remoteLMD) > new Date(localLMD)) {
        idsToPull.push(id);
      }
    }

    if (idsToPull.length > 0) {
      if (!silent)
        showLoading(`Downloading ${idsToPull.length} remote updates...`);
      const { data: entriesToPullData, error: pullError } =
        await window.supabaseClient
          .from("movie_entries")
          .select("*")
          .in("id", idsToPull)
          .eq("user_id", currentSupabaseUser.id)
          .eq("is_deleted", false);
      if (pullError)
        throw new Error(
          `Downloading remote entries failed: ${pullError.message}`,
        );

      pulledCount = entriesToPullData.length;
      changesMade = true;

      const localDataMap = new Map(movieData.map((e) => [e.id, e]));
      entriesToPullData.forEach((remoteEntry) => {
        localDataMap.set(
          remoteEntry.id,
          supabaseEntryToLocalFormat(remoteEntry),
        );
      });
      movieData = Array.from(localDataMap.values());
    }

    if (changesMade) {
      movieData = movieData.filter((e) => !e.is_deleted);
      movieData.forEach((e) => (e._sync_state = "synced"));

      recalculateAndApplyAllRelationships();
      sortMovies(currentSortColumn, currentSortDirection);
      await saveToIndexedDB();

      // FIX: Clear stats cache and update achievements so UI reflects new data
      if (window.globalStatsData) window.globalStatsData = {};

      if (!silent) renderMovieCards();
    }

    const summary = `Pulled: ${pulledCount}, Pushed: ${pushedCount}, Deleted: ${deletedCount}`;

    // --- NEW: Update Last Synced Time on Success ---
    const now = new Date().toISOString();
    localStorage.setItem("last_synced_time", now);

    // Update UI Text if function exists (reusing logic from main.js implicitly via event or direct DOM manip if needed,
    // but main.js handles onload. We should try to update it live.)
    const lastSyncedText = document.getElementById("lastSyncedText");
    if (lastSyncedText) {
      const dateObj = new Date(now);
      const dateStr = dateObj.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      });
      const timeStr = dateObj.toLocaleTimeString(undefined, {
        hour: "2-digit",
        minute: "2-digit",
      });
      lastSyncedText.textContent = `Last Synced: ${dateStr}, ${timeStr}`;
    }

    if (changesMade) {
      showToast("Sync Complete", summary, "success");
    } else if (!silent) {
      showToast("All Synced", "Your data is up-to-date.", "info");
    }

    incrementLocalStorageCounter("sync_count_achievement");

    // Clear Pending Changes List
    if (typeof clearModifiedEntriesList === "function")
      clearModifiedEntriesList();

    return { success: true, summary };
  } catch (error) {
    console.error("Error during comprehensiveSync:", error);
    if (!silent) showToast("Sync Failed", `${error.message}`, "error", 10000);
    return { success: false, error: error.message };
  } finally {
    window.isSyncingInProgress = false; // Release Lock
    if (!silent) hideLoading();
  }
}
// END CHUNK: 2

// START CHUNK: Force Pull
// START CHUNK: Force Pull
async function forcePullFromSupabase() {
  if (!window.supabaseClient || !currentSupabaseUser) {
    showToast(
      "Not Logged In",
      "Please log in to perform this action.",
      "error",
    );
    return;
  }

  // Guard: Strict Privacy
  if (localStorage.getItem("keepmoviez_sync_mode") === "strict_privacy") {
    showToast(
      "Privacy Mode Enabled",
      "Disable Strict Privacy Mode to use this feature.",
      "error",
    );
    return;
  }

  showLoading("Force Pulling... Erasing local data...");

  try {
    // Step 1: Fetch ALL data from the cloud for the current user
    const { data: cloudData, error: fetchError } = await window.supabaseClient
      .from("movie_entries")
      .select("*")
      .eq("user_id", currentSupabaseUser.id)
      .eq("is_deleted", false);

    if (fetchError)
      throw new Error(`Could not fetch cloud data: ${fetchError.message}`);

    showLoading(
      `Found ${cloudData.length} entries in cloud. Replacing local data...`,
    );

    const newLocalData = cloudData.map((entry) =>
      supabaseEntryToLocalFormat(entry),
    );

    movieData = newLocalData;
    recalculateAndApplyAllRelationships();
    sortMovies(currentSortColumn, currentSortDirection);
    movieData.forEach((e) => (e._sync_state = "synced"));
    await saveToIndexedDB();

    // FIX: Clear stats cache and update achievements
    if (window.globalStatsData) window.globalStatsData = {};
    if (typeof checkAndNotifyNewAchievements === "function")
      await checkAndNotifyNewAchievements();

    // Step 5: Re-render the UI and provide feedback
    renderMovieCards();
    showToast(
      "Force Pull Complete",
      "Your local data now matches the cloud.",
      "success",
    );
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
    showToast(
      "Not Logged In",
      "Please log in to perform this action.",
      "error",
    );
    return;
  }

  // Guard: Strict Privacy
  if (localStorage.getItem("keepmoviez_sync_mode") === "strict_privacy") {
    showToast(
      "Privacy Mode Enabled",
      "Disable Strict Privacy Mode to use this feature.",
      "error",
    );
    return;
  }

  showLoading("Force Pushing... Deleting cloud data...");

  try {
    const userId = currentSupabaseUser.id;

    // Step 1: Delete all existing records for this user in Supabase.
    const { error: deleteError } = await window.supabaseClient
      .from("movie_entries")
      .delete()
      .eq("user_id", userId);

    if (deleteError)
      throw new Error(`Could not clear cloud data: ${deleteError.message}`);

    showLoading("Cloud data cleared. Uploading local collection...");

    // Step 2: Prepare the entire local database for upload (excluding soft-deleted items)
    const localDataToPush = movieData
      .filter((entry) => !entry.is_deleted)
      .map((entry) => localEntryToSupabaseFormat(entry, userId))
      .filter(Boolean);

    if (localDataToPush.length > 0) {
      // Step 3: Insert all local records into the now-empty cloud table.
      const { error: insertError } = await window.supabaseClient
        .from("movie_entries")
        .insert(localDataToPush);

      if (insertError)
        throw new Error(`Could not upload local data: ${insertError.message}`);
    }

    // Step 4: Mark all local data as 'synced'
    movieData.forEach((entry) => {
      if (!entry.is_deleted) {
        entry._sync_state = "synced";
      }
    });
    await saveToIndexedDB(); // Save the new sync states locally

    showToast(
      "Force Push Complete",
      `Successfully uploaded ${localDataToPush.length} entries. Your cloud data now matches this device.`,
      "success",
    );
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
let isAppInitializing = false;

async function initAuth() {
  showLoading("Initializing...");
  try {
    if (!window.supabaseClient) {
      // No Supabase configured = Offline Mode (No wipe)
      await resetAppForLogout(
        "Cloud service is not available. Running in offline mode.",
        false,
      );
      return;
    }

    const handleUserSession = async (user) => {
      if (isAppInitializing) return;
      // If user is already loaded and UI visible, do nothing to prevent loops
      if (
        user?.id === currentSupabaseUser?.id &&
        appContent.style.display === "block"
      )
        return;

      if (user) {
        try {
          isAppInitializing = true; // Lock
          await openDatabase();
          await initializeApp();
        } catch (dbError) {
          console.error("CRITICAL: Could not open IndexedDB.", dbError);
          // DB Error = Fallback to empty state, no wipe needed really, but safe to fail gracefully
          await resetAppForLogout(
            `Failed to connect to local database: ${dbError.message}`,
            false,
          );
        } finally {
          isAppInitializing = false; // Unlock
        }
      } else {
        // No user object = Logged out state logic handled below in the else block of session check
      }
    };

    // Check for Password Recovery Token in URL
    let recoveryToken = null;
    if (window.location.hash.includes("type=recovery")) {
      const params = new URLSearchParams(window.location.hash.substring(1));
      recoveryToken = params.get("access_token");
    }

    if (recoveryToken) {
      console.log("Password recovery token found.");
      document.getElementById("supabaseAuthForm").style.display = "none";
      document.getElementById("passwordSetupSection").style.display = "block";
      document.getElementById("authContainer").style.display = "flex";
      document.getElementById("appContent").style.display = "none";
      hideLoading();
      return;
    }

    // Listener for future state changes (Logout, Login, Token Refresh)
    window.supabaseClient.auth.onAuthStateChange(async (event, session) => {
      if (window.location.hash) {
        window.history.replaceState(
          null,
          null,
          window.location.pathname + window.location.search,
        );
      }

      const user = session?.user || null;
      const previousUserId = currentSupabaseUser?.id;
      currentSupabaseUser = user;
      if (typeof updateSyncButtonState === "function") updateSyncButtonState();

      if (event === "SIGNED_OUT") {
        // HERE IS THE CORE LOGIC:
        // If isExplicitLogout is true (button clicked), we WIPE (true).
        // If not (timeout/token expired), we SAVE (false).
        // Note: window.isExplicitLogout must be defined in constant.js
        const shouldWipe = window.isExplicitLogout === true;
        await resetAppForLogout("You have been logged out.", shouldWipe);
        window.isExplicitLogout = false; // Reset flag
      } else if (event === "PASSWORD_RECOVERY") {
        document.getElementById("supabaseAuthForm").style.display = "block";
        document.getElementById("passwordSetupSection").style.display = "none";
        showToast(
          "Success",
          "Your password has been updated. Please log in.",
          "success",
        );
      } else if (user && user.id !== previousUserId) {
        await handleUserSession(user);
      }
    });

    // Initial Load Check with Timeout
    // If Supabase hangs (offline), we default to local mode after 2 seconds
    const sessionPromise = window.supabaseClient.auth.getSession();
    const timeoutPromise = new Promise((resolve) => {
      setTimeout(() => {
        console.log("Auth check timed out. Defaulting to local mode check.");
        resolve({ data: { session: null }, error: null });
      }, 2000);
    });

    const {
      data: { session },
    } = await Promise.race([sessionPromise, timeoutPromise]);

    if (session?.user) {
      currentSupabaseUser = session.user;
      if (typeof updateSyncButtonState === "function") updateSyncButtonState();
      await handleUserSession(session.user);
    } else {
      console.log("No session found or offline. Checking local data...");
      await openDatabase();
      // Load local data to see if we have anything (Privacy/Offline User)
      const localData = await loadFromIndexedDB();

      if (localData && localData.length > 0) {
        // Case: Not logged in, but we have data -> Load App in Guest Mode
        movieData = localData;
        await initializeApp();
      } else {
        // Case: Not logged in, No data (First time user) -> Show Login
        await resetAppForLogout("Please log in to continue.", false);
      }
    }
  } catch (error) {
    console.error("Authentication initialization failed:", error);
    // Fallback to trying to load the app locally
    await initializeApp();
  }
}

// Logic to load the app UI (used by both authenticated and offline flows)
async function initializeApp() {
  showLoading("Loading your collection...");
  try {
    if (!movieData || movieData.length === 0) {
      movieData = await loadFromIndexedDB();
    }
    console.log(`Loaded ${movieData.length} entries.`);

    if (typeof recalculateAndApplyAllRelationships === "function")
      recalculateAndApplyAllRelationships();
    sortMovies(currentSortColumn, currentSortDirection);
    if (typeof renderMovieCards === "function") renderMovieCards();
    if (typeof populateGenreDropdown === "function") populateGenreDropdown();

    await window.checkAndNotifyNewAchievements(true);

    if (typeof migrateVeryOldLocalStorageData === "function") {
      await migrateVeryOldLocalStorageData();
    }

    // Always show content if we reach here
    if (authContainer) authContainer.style.display = "none";
    if (appContent) appContent.style.display = "block";

    // Update UI for offline/guest state if needed
    if (!currentSupabaseUser) {
      const emailEl = document.getElementById("menuLoggedInUserEmail");
      if (emailEl) emailEl.textContent = "Guest (Local Mode)";
      if (typeof updateSyncButtonState === "function") updateSyncButtonState();
    }

    // NEW: Auto-Sync on Load
    const syncMode = localStorage.getItem("keepmoviez_sync_mode");
    if (syncMode === "normal" && currentSupabaseUser) {
      console.log("Auto-Sync enabled: Triggering comprehensive sync on load.");
      comprehensiveSync(true); // Silent sync
    }
  } catch (error) {
    console.error("App init error:", error);
    showToast("Start Failed", error.message, "error");
  } finally {
    hideLoading();
  }
}

/**
 * Handles Logging Out or Session Expiry
 * @param {string} message - Toast message to show
 * @param {boolean} wipeData - TRUE = Security Wipe (Logout button), FALSE = Privacy Keep (Timeout/Offline)
 */
async function resetAppForLogout(message, wipeData = false) {
  console.warn(`Resetting App. Reason: ${message}. Wiping Data: ${wipeData}`);

  if (currentSupabaseUser) {
    sessionStorage.removeItem(`hasSynced_${currentSupabaseUser.id}`);
  }
  currentSupabaseUser = null;

  if (wipeData) {
    // --- EXPLICIT LOGOUT: SECURITY WIPE ---
    movieData = [];
    if (typeof clearLocalMovieCache === "function")
      await clearLocalMovieCache();

    // Full UI Reset to Login Screen
    if (typeof destroyCharts === "function") destroyCharts(chartInstances);
    if (
      window.isMultiSelectMode &&
      typeof window.disableMultiSelectMode === "function"
    )
      window.disableMultiSelectMode();
    if (typeof $ !== "undefined" && $.fn.modal) $(".modal.show").modal("hide");
    document.getElementById("appMenu")?.classList.remove("show");
    document.getElementById("appMenuBackdrop")?.classList.remove("show");

    if (appContent) appContent.style.display = "none";
    if (authContainer) authContainer.style.display = "flex";

    const passwordInput = document.getElementById("supabasePassword");
    if (passwordInput) passwordInput.value = "";

    showToast(
      "Logged Out",
      "Your local data has been cleared for security.",
      "info",
    );
  } else {
    // --- IMPLICIT LOGOUT: PRESERVE DATA (Offline Mode) ---
    // If we are already viewing data, just update the UI to show we are offline/guest
    if (appContent.style.display === "block") {
      const emailEl = document.getElementById("menuLoggedInUserEmail");
      if (emailEl) emailEl.textContent = "Guest (Local Mode)";

      if (typeof updateSyncButtonState === "function") updateSyncButtonState();

      // Only show toast if it's an actual session expiry event, not just initial load
      if (message !== "Please log in to continue.") {
        showToast(
          "Session Ended",
          "Switched to local mode. Data preserved.",
          "warning",
        );
      }
    } else {
      // If we are at the login screen and have no data, stay there.
      if (authContainer) authContainer.style.display = "flex";
      if (appContent) appContent.style.display = "none";
    }
  }

  // Always reset error messages
  const authMessageEl = document.getElementById("authMessage");
  if (authMessageEl) authMessageEl.textContent = message;
  const authErrorDiv = document.getElementById("authError");
  if (authErrorDiv) {
    authErrorDiv.textContent = "";
    authErrorDiv.style.display = "none";
  }

  // FORCE loading overlay to hide
  hideLoading();
}
// END CHUNK: 3: Authentication and Application State

// START CHUNK: 4: User Authentication Actions

// Helper function for client-side auth validation
function validateAuthForm(email, password, isSignUp = false) {
  const authErrorDiv = document.getElementById("authError");
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!email || !password) {
    authErrorDiv.textContent = "Email and password cannot be empty.";
    authErrorDiv.style.display = "block";
    return false;
  }
  if (!emailRegex.test(email)) {
    authErrorDiv.textContent = "Please enter a valid email address.";
    authErrorDiv.style.display = "block";
    return false;
  }
  if (password.length < 6) {
    authErrorDiv.textContent = "Password must be at least 6 characters long.";
    authErrorDiv.style.display = "block";
    return false;
  }

  authErrorDiv.style.display = "none";
  return true;
}

async function supabaseSignInUser(email, password) {
  const authErrorDiv = document.getElementById("authError");
  if (!validateAuthForm(email, password)) return;

  showLoading("Signing in...");
  try {
    const { error } = await window.supabaseClient.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    // Success handled by onAuthStateChange
  } catch (error) {
    console.error("Sign in error:", error);
    if (authErrorDiv) {
      authErrorDiv.textContent = error.message;
      authErrorDiv.style.display = "block";
    }
    showToast("Login Failed", error.message, "error");
  } finally {
    hideLoading();
  }
}

async function supabaseSignInWithGoogle() {
  showLoading("Redirecting to Google...");
  try {
    const cleanRedirectTo = window.location.origin + window.location.pathname;
    const { error } = await window.supabaseClient.auth.signInWithOAuth({
      provider: "google",
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
  const authErrorDiv = document.getElementById("authError");
  if (!validateAuthForm(email, password, true)) return;

  showLoading("Creating account...");
  try {
    const { error } = await window.supabaseClient.auth.signUp({
      email,
      password,
    });
    if (error) throw error;
    showToast(
      "Account Created",
      "Please check your email to verify your account.",
      "success",
      10000,
    );
    const authMessageEl = document.getElementById("authMessage");
    if (authMessageEl)
      authMessageEl.textContent =
        "Verification email sent! Please check your inbox.";
  } catch (error) {
    console.error("Sign up error:", error);
    if (authErrorDiv) {
      authErrorDiv.textContent = error.message;
      authErrorDiv.style.display = "block";
    }
    showToast("Sign Up Failed", error.message, "error");
  } finally {
    hideLoading();
  }
}

async function supabaseSignOutUser() {
  showLoading("Signing out...");
  try {
    // SET THE FLAG: This tells resetAppForLogout to WIPE data because user explicitly clicked logout.
    window.isExplicitLogout = true;

    const { error } = await window.supabaseClient.auth.signOut();
    if (error && error.name !== "AuthSessionMissingError") throw error;

    // Usually onAuthStateChange handles the rest.
  } catch (error) {
    console.error("Sign out error:", error);
    // Force manual reset if the event listener doesn't fire due to network error
    await resetAppForLogout("Logged out (Force).", true);
    window.isExplicitLogout = false;
    showToast(
      "Logout Error",
      "Logged out locally, but network error occurred.",
      "warning",
    );
  } finally {
    hideLoading();
  }
}

async function supabaseSendPasswordResetEmail(email) {
  const authErrorDiv = document.getElementById("authError");
  authErrorDiv.style.display = "none";

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    authErrorDiv.textContent = "Please enter a valid email address.";
    authErrorDiv.style.display = "block";
    return;
  }

  showLoading("Sending reset link...");
  try {
    const cleanRedirectTo = window.location.origin + window.location.pathname;
    const { error } = await window.supabaseClient.auth.resetPasswordForEmail(
      email,
      { redirectTo: cleanRedirectTo },
    );
    if (error) throw error;
    showToast(
      "Check Your Email",
      "A password reset link has been sent.",
      "success",
      8000,
    );
    const authMessageEl = document.getElementById("authMessage");
    if (authMessageEl)
      authMessageEl.textContent =
        "Password reset link sent! Please check your inbox.";
  } catch (error) {
    console.error("Password reset error:", error);
    if (authErrorDiv) {
      authErrorDiv.textContent = error.message;
      authErrorDiv.style.display = "block";
    }
    showToast("Reset Failed", error.message, "error");
  } finally {
    hideLoading();
  }
}

async function supabaseUpdateUserPassword(newPassword) {
  const errorDiv = document.getElementById("passwordResetError");
  errorDiv.style.display = "none";
  showLoading("Updating password...");
  try {
    const { error } = await window.supabaseClient.auth.updateUser({
      password: newPassword,
    });
    if (error) throw error;
    // The onAuthStateChange listener will handle the success message and UI swap
  } catch (error) {
    console.error("Password update error:", error);
    errorDiv.textContent = error.message;
    errorDiv.style.display = "block";
    showToast("Update Failed", error.message, "error");
  } finally {
    hideLoading();
  }
}
// END CHUNK: 4: User Authentication Actions

//START CHUNK: 5: High-Level Data Actions (REWRITTEN)
async function eraseAllData() {
  const scopeElement = document.getElementById("eraseDataScope");
  if (!scopeElement) {
    showToast("Error", "Erase scope UI missing.", "error");
    return;
  }
  const scope = scopeElement.value;
  if (
    !confirm(
      `ERASING DATA: Scope: "${scope}". This is IRREVERSIBLE. Are you sure?`,
    )
  ) {
    $("#confirmEraseDataModal").modal("hide");
    return;
  }

  let message = "",
    eraseLocalCache = false,
    eraseCloudData = false;

  switch (scope) {
    case "local":
      message = "Erasing local cache...";
      eraseLocalCache = true;
      break;
    case "cloud":
      if (!currentSupabaseUser) {
        showToast("Not Logged In", "Cannot erase cloud data.", "error");
        $("#confirmEraseDataModal").modal("hide");
        return;
      }
      message = "Marking all cloud data for deletion...";
      eraseCloudData = true;
      break;
    case "both":
      message = "Erasing local and cloud data...";
      eraseLocalCache = true;
      if (currentSupabaseUser) {
        eraseCloudData = true;
      } else {
        showToast(
          "Cloud Skipped",
          "Not logged in. Only local data will be erased.",
          "warning",
          4000,
        );
      }
      break;
    default:
      showToast("Error", "Invalid erase scope.", "error");
      $("#confirmEraseDataModal").modal("hide");
      return;
  }

  showLoading(message);
  try {
    if (eraseCloudData) {
      const { error: updateError } = await window.supabaseClient
        .from("movie_entries")
        .update({
          is_deleted: true,
          last_modified_date: new Date().toISOString(),
        })
        .eq("user_id", currentSupabaseUser.id);
      if (updateError) {
        throw new Error(
          `Cloud erase (soft-delete) failed: ${updateError.message}`,
        );
      }
      showToast(
        "Cloud Data Erased",
        "All cloud entries marked for deletion.",
        "warning",
      );
    }

    if (eraseLocalCache) {
      if (typeof clearLocalMovieCache === "function")
        await clearLocalMovieCache();
      if (currentSupabaseUser)
        localStorage.removeItem(`hasSynced_${currentSupabaseUser.id}`);
      movieData = [];
      const keysToClear = [
        DAILY_RECOMMENDATION_ID_KEY,
        DAILY_RECOMMENDATION_DATE_KEY,
        DAILY_REC_SKIP_COUNT_KEY,
        ...Object.values(DO_NOT_SHOW_AGAIN_KEYS),
      ];
      keysToClear.forEach((key) => {
        if (key) localStorage.removeItem(key);
      });
      showToast(
        "Local Cache Erased",
        "Local data and settings cleared.",
        "warning",
        undefined,
        DO_NOT_SHOW_AGAIN_KEYS.DATA_ERASED,
      );
    }

    $("#confirmEraseDataModal").modal("hide");
    if (typeof renderMovieCards === "function") renderMovieCards();

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
