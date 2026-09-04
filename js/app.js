/* js/app.js */ 
// START CHUNK: Card Interaction and Multi-Select
let lastSelectedCardId = null; // Track last selected for Shift+Click

window.handleCardClick = function (event) {
  if (longPressOccurred) {
    event.preventDefault();
    event.stopPropagation();
    longPressOccurred = false;
    return;
  }
  const card = event.target.closest(".movie-card");
  if (!card) return;
  const movieId = card.dataset.movieId;

  if (isMultiSelectMode) {
    toggleCardSelection(movieId, event);
    return;
  }

  const target = event.target;

  if (target.matches(".edit-btn, .edit-btn *")) {
    prepareEditModal(movieId);
  } else if (target.matches(".delete-btn, .delete-btn *")) {
    showDeleteConfirmationModal(movieId);
  } else if (target.matches(".view-btn, .view-btn *")) {
    openDetailsModal(movieId);
  } else if (target.matches(".quick-update-btn, .quick-update-btn *")) {
    prepareQuickUpdateModal(movieId);
  } else {
    openDetailsModal(movieId); // Default action for clicking the card body
  }
};

window.handleCardMouseDown = function (event) {
  if (
    (event.button !== undefined && event.button !== 0) ||
    !event.target.closest(".movie-card")
  )
    return;
  if (longPressTimer) clearTimeout(longPressTimer);
  longPressOccurred = false;
  const card = event.target.closest(".movie-card");
  const movieId = card.dataset.movieId;
  longPressTimer = setTimeout(() => {
    if (!isMultiSelectMode) {
      enableMultiSelectMode(movieId);
      longPressOccurred = true;
    }
    longPressTimer = null;
  }, LONG_PRESS_DURATION);
};

window.handleCardMouseUp = function () {
  if (longPressTimer) {
    clearTimeout(longPressTimer);
    longPressTimer = null;
  }
};

function enableMultiSelectMode(initialMovieId) {
  isMultiSelectMode = true;
  selectedEntryIds = [initialMovieId];
  lastSelectedCardId = initialMovieId;
  document.getElementById("multiSelectActionsBar").style.display = "flex";
  document.getElementById("addNewEntryBtn").style.display = "none";
  document.body.classList.add("multi-select-active");
  renderMovieCards();
  updateMultiSelectCount();
  showToast(
    "Multi-Select Mode",
    "Tap cards to select. Shift+Click for range select.",
    "info",
  );
}


window.disableMultiSelectMode = function () {
  isMultiSelectMode = false;
  selectedEntryIds = [];
  lastSelectedCardId = null;
  document.getElementById("multiSelectActionsBar").style.display = "none";
  document.getElementById("addNewEntryBtn").style.display = "block";
  document.body.classList.remove("multi-select-active");
  renderMovieCards();
};

function toggleCardSelection(movieId, event) {
  // Shift+Click: range selection using currently rendered card order
  if (event && event.shiftKey && lastSelectedCardId && lastSelectedCardId !== movieId) {
    const allCards = Array.from(
      document.querySelectorAll(".movie-card[data-movie-id]")
    );
    const ids = allCards.map((c) => c.dataset.movieId);
    const fromIdx = ids.indexOf(lastSelectedCardId);
    const toIdx = ids.indexOf(movieId);
    if (fromIdx !== -1 && toIdx !== -1) {
      const start = Math.min(fromIdx, toIdx);
      const end = Math.max(fromIdx, toIdx);
      const rangeIds = ids.slice(start, end + 1);
      rangeIds.forEach((id) => {
        if (!selectedEntryIds.includes(id)) {
          selectedEntryIds.push(id);
        }
      });
      // Update card visuals
      allCards.forEach((card) => {
        if (selectedEntryIds.includes(card.dataset.movieId)) {
          card.classList.add("selected");
        }
      });
      updateMultiSelectCount();
      lastSelectedCardId = movieId;
      return;
    }
  }

  const index = selectedEntryIds.indexOf(movieId);
  if (index > -1) {
    selectedEntryIds.splice(index, 1);
  } else {
    selectedEntryIds.push(movieId);
    lastSelectedCardId = movieId;
  }
  const card = document.querySelector(
    `.movie-card[data-movie-id="${movieId}"]`,
  );
  if (card) {
    card.classList.toggle("selected");
  }
  updateMultiSelectCount();
  if (selectedEntryIds.length === 0) {
    disableMultiSelectMode();
  }
}

function updateMultiSelectCount() {
  document.getElementById("multiSelectCount").textContent =
    `${selectedEntryIds.length} selected`;
}

// Select All / Clear Selection
window.selectAllEntries = function () {
  if (!isMultiSelectMode) return;
  selectedEntryIds = currentFilteredData
    .filter((m) => m && m.id)
    .map((m) => m.id);
  lastSelectedCardId = null;
  document.querySelectorAll(".movie-card[data-movie-id]").forEach((card) => {
    if (selectedEntryIds.includes(card.dataset.movieId)) {
      card.classList.add("selected");
    }
  });
  updateMultiSelectCount();
};

window.clearSelection = function () {
  disableMultiSelectMode();
};
// END CHUNK: Card Interaction and Multi-Select

// START CHUNK: Data Sorting and Filtering Logic (Moved from ui.js)
function sortMovies(column, direction) {
  if (!Array.isArray(movieData)) {
    console.error("movieData is not an array. Cannot sort.");
    return;
  }
  movieData.sort((a, b) => {
    if (!a && !b) return 0;
    if (!a) return 1;
    if (!b) return -1;
    let valA, valB;
    const ascEmpty = Infinity;
    const descEmpty = -Infinity;

    switch (column) {
      case "LastWatchedDate":
        const latestA = getLatestWatchInstance(a.watchHistory);
        const latestB = getLatestWatchInstance(b.watchHistory);
        valA = latestA
          ? new Date(latestA.date).getTime()
          : direction === "asc"
            ? ascEmpty
            : descEmpty;
        valB = latestB
          ? new Date(latestB.date).getTime()
          : direction === "asc"
            ? ascEmpty
            : descEmpty;
        break;
      case "lastModifiedDate":
        valA = a.lastModifiedDate
          ? new Date(a.lastModifiedDate).getTime()
          : direction === "asc"
            ? ascEmpty
            : descEmpty;
        valB = b.lastModifiedDate
          ? new Date(b.lastModifiedDate).getTime()
          : direction === "asc"
            ? ascEmpty
            : descEmpty;
        break;
      case "Year":
        valA =
          a.Year && !isNaN(parseInt(a.Year, 10))
            ? parseInt(a.Year, 10)
            : direction === "asc"
              ? ascEmpty
              : descEmpty;
        valB =
          b.Year && !isNaN(parseInt(b.Year, 10))
            ? parseInt(b.Year, 10)
            : direction === "asc"
              ? ascEmpty
              : descEmpty;
        break;
      case "overallRating":
        valA =
          a.overallRating && a.overallRating !== ""
            ? parseFloat(a.overallRating)
            : -1;
        valB =
          b.overallRating && b.overallRating !== ""
            ? parseFloat(b.overallRating)
            : -1;
        break;
      default: // Name
        valA = String(a[column] || "")
          .toLowerCase()
          .trim();
        valB = String(b[column] || "")
          .toLowerCase()
          .trim();
        break;
    }

    let comparison = 0;
    if (valA < valB) comparison = -1;
    else if (valA > valB) comparison = 1;

    if (comparison === 0 && column !== "Name") {
      const nameA = String(a.Name || "").toLowerCase();
      const nameB = String(b.Name || "").toLowerCase();
      if (nameA < nameB) return -1;
      if (nameA > nameB) return 1;
      return 0;
    }

    return direction === "asc" ? comparison : -comparison;
  });
}

function applyFilters(data) {
  let filteredData = data.filter((m) => !m.is_deleted);

  if (filterQuery) {
    const lowerFilterQuery = filterQuery.toLowerCase();
    filteredData = filteredData.filter((movie) => {
      if (!movie) return false;
      return (
        (movie.Name &&
          String(movie.Name).toLowerCase().includes(lowerFilterQuery)) ||
        (movie.Year &&
          String(movie.Year).toLowerCase().includes(lowerFilterQuery)) ||
        (movie.Status &&
          String(movie.Status).toLowerCase().includes(lowerFilterQuery)) ||
        (movie.Genre &&
          String(movie.Genre).toLowerCase().includes(lowerFilterQuery))
      );
    });
  }

  if (activeFilters.category !== "all")
    filteredData = filteredData.filter(
      (m) => m.Category === activeFilters.category,
    );
  if (activeFilters.country !== "all")
    filteredData = filteredData.filter(
      (m) => m.Country === activeFilters.country,
    );
  if (activeFilters.language !== "all")
    filteredData = filteredData.filter(
      (m) => m.Language === activeFilters.language,
    );

  if (activeFilters.genres.length > 0) {
    filteredData = filteredData.filter((m) => {
      if (!m.Genre) return false;
      const movieGenres = m.Genre.split(",").map((g) => g.trim());
      if (activeFilters.genreLogic === "AND") {
        return activeFilters.genres.every((filterGenre) =>
          movieGenres.includes(filterGenre),
        );
      } else {
        // OR logic
        return activeFilters.genres.some((filterGenre) =>
          movieGenres.includes(filterGenre),
        );
      }
    });
  }

  return filteredData;
}
// END CHUNK: Data Sorting and Filtering Logic

// START CHUNK: Entry Form Submission and Save Logic
window.handleFormSubmit = async function (event, saveAction = "quickSave") {
  event.preventDefault();
  if (typeof isWatchRecordFormOpen === "function" && isWatchRecordFormOpen()) {
    showToast(
      "Unsaved Watch Record",
      "Please save or cancel your watch record first.",
      "warning",
    );
    return;
  }
  if (!formFieldsGlob) {
    console.error("formFieldsGlob not initialized!");
    return;
  }
  showLoading("Saving entry...");
  try {
    const nameValue = formFieldsGlob.name.value.trim();
    if (!nameValue) {
      showToast("Validation Error", "Name is required.", "error");
      formFieldsGlob.name.focus();
      hideLoading();
      return;
    }
    const yearVal = formFieldsGlob.year.value.trim();
    if (
      yearVal &&
      (isNaN(parseInt(yearVal)) ||
        parseInt(yearVal) < 1800 ||
        parseInt(yearVal) > new Date().getFullYear() + 20)
    ) {
      showToast("Validation Error", "Valid year required.", "error");
      formFieldsGlob.year.focus();
      hideLoading();
      return;
    }

    const { finalized: namesArray } = parseInputForAutocomplete(
      formFieldsGlob.relatedEntriesNames.value.trim(),
    );
    const directRelatedEntriesIds = namesArray
      .map(
        (name) =>
          movieData.find(
            (m) =>
              m &&
              m.Name &&
              String(m.Name).toLowerCase() === String(name).toLowerCase(),
          )?.id,
      )
      .filter((id) => id);
    const entryFormEl = document.getElementById("entryForm");
    const cachedTmdbData =
      entryFormEl && entryFormEl._tempTmdbData ? entryFormEl._tempTmdbData : {};
    const countryInput = formFieldsGlob.country.value.trim();
    let countryCodeToStore = countryInput.toUpperCase();
    if (countryInput.length > 3) {
      for (const [code, name] of Object.entries(countryCodeToNameMap)) {
        if (name.toLowerCase() === countryInput.toLowerCase()) {
          countryCodeToStore = code;
          break;
        }
      }
    }

    const editId = document.getElementById("editEntryId").value;
    const newTmdbId = document.getElementById("tmdbId").value || null;

    // FIX: STRICT CONFLICT CHECKING (TMDB ID & Title/Year)
    // NOTE: TMDB uses separate ID namespaces for movies and TV shows,
    // so the same numeric ID can exist for both a movie and a series.
    // We must check both tmdbId AND Category to avoid false conflicts.
    if (newTmdbId) {
      const currentCategory = formFieldsGlob.category.value;
      const currentMediaType = document.getElementById("tmdbMediaType").value || null;
      // Check if another entry (not the one we are editing) has this TMDB ID AND is the same type
      const exactTmdbMatch = movieData.find(
        (m) =>
          m.tmdbId == newTmdbId &&
          m.id !== editId &&
          !m.is_deleted &&
          m.Status !== "Unwatchable" &&
          (m.Category === currentCategory ||
            (currentMediaType && m.tmdbMediaType === currentMediaType)),
      );
      if (exactTmdbMatch) {
        showToast(
          "Data Conflict",
          `Entry "${exactTmdbMatch.Name}" already exists with this TMDB ID. Please verify using search bar instead.`,
          "error",
          6000,
        );
        hideLoading();
        return; // Hard block
      }
    }

    const entry = {
      Name: nameValue,
      Category: formFieldsGlob.category.value,
      Status: formFieldsGlob.status.value,
      Genre: Array.isArray(selectedGenres) ? selectedGenres.join(", ") : "",
      currentSeason:
        formFieldsGlob.status.value === "Continue" &&
        formFieldsGlob.category.value === "Series"
          ? parseInt(formFieldsGlob.currentSeason?.value || formFieldsGlob.seasonsCompleted?.value, 10) || 1
          : null,
      currentEpisode:
        formFieldsGlob.status.value === "Continue" &&
        formFieldsGlob.category.value === "Series"
          ? parseInt(formFieldsGlob.currentEpisode?.value || formFieldsGlob.currentSeasonEpisodesWatched?.value, 10) || 0
          : null,
      seasonsCompleted:
        formFieldsGlob.status.value === "Continue" &&
        formFieldsGlob.category.value === "Series"
          ? Math.max(0, (parseInt(formFieldsGlob.currentSeason?.value || formFieldsGlob.seasonsCompleted?.value, 10) || 1) - 1)
          : null,
      currentSeasonEpisodesWatched:
        formFieldsGlob.status.value === "Continue" &&
        formFieldsGlob.category.value === "Series"
          ? parseInt(formFieldsGlob.currentEpisode?.value || formFieldsGlob.currentSeasonEpisodesWatched?.value, 10) || 0
          : null,
      Recommendation:
        formFieldsGlob.status.value === "Watched" ||
          formFieldsGlob.status.value === "Continue"
          ? formFieldsGlob.recommendation.value
          : "",
      overallRating:
        formFieldsGlob.status.value === "Watched" ||
          formFieldsGlob.status.value === "Continue"
          ? formFieldsGlob.overallRating.value
          : "",
      personalRecommendation: formFieldsGlob.personalRecommendation.value,
      Language: formFieldsGlob.language.value.trim(),
      Year: yearVal,
      Country: countryCodeToStore,
      Description: formFieldsGlob.description.value.trim(),
      // NEW: Custom Logic for Poster URL (Quote if Manual/Custom)
      "Poster URL": (() => {
        const rawVal = formFieldsGlob.posterUrl.value.trim();
        if (!rawVal) return "";
        const source = formFieldsGlob.posterUrl.dataset.source;
        // If source is TMDB (from search/original unquoted), save generic.
        // If source is Manual (user edit/original quoted), save Quoted (if not already).
        if (source === "tmdb") return rawVal;
        if (rawVal.startsWith('"') && rawVal.endsWith('"')) return rawVal;
        return `"${rawVal}"`; // Quote it
      })(),
      watchHistory: JSON.parse(
        document.getElementById("currentWatchHistory").value || "[]",
      ),
      relatedEntries: [...new Set(directRelatedEntriesIds)],
      lastModifiedDate: new Date().toISOString(),
      doNotRecommendDaily: false,
      tmdbId: newTmdbId,
      tmdbMediaType: document.getElementById("tmdbMediaType").value || null,
      ...cachedTmdbData,
      is_deleted: false,
      _sync_state: editId ? "edited" : "new",
    };

    if (entry.Category === "Series") {
      const seasons = parseInt(formFieldsGlob.runtimeSeriesSeasons.value, 10);
      const episodes = parseInt(formFieldsGlob.runtimeSeriesEpisodes.value, 10);
      const avgEp = parseInt(formFieldsGlob.runtimeSeriesAvgEp.value, 10);
      if (!isNaN(seasons) || !isNaN(episodes) || !isNaN(avgEp)) {
        entry.runtime = {
          seasons: !isNaN(seasons) ? seasons : null,
          episodes: !isNaN(episodes) ? episodes : null,
          episode_run_time: !isNaN(avgEp) ? avgEp : null,
        };
      }
    } else {
      const runtime = parseInt(formFieldsGlob.runtimeMovie.value, 10);
      if (!isNaN(runtime)) entry.runtime = runtime;
    }

    if (editId) {
      const existingEntry = movieData.find((m) => m && m.id === editId);
      if (existingEntry)
        entry.doNotRecommendDaily = existingEntry.doNotRecommendDaily;
    }

    // --- UNWATCHABLE CHECK: Warn if the title exists in the Unwatchable section ---
    if (!editId) {
      const unwatchableMatch = movieData.find((m) => {
        if (!m || m.is_deleted || m.Status !== "Unwatchable") return false;
        // Match by TMDB ID (if available)
        if (newTmdbId && m.tmdbId == newTmdbId) return true;
        // Match by exact Name + Year
        if (
          m.Name &&
          String(m.Name).toLowerCase() === entry.Name.toLowerCase() &&
          m.Year == entry.Year
        )
          return true;
        return false;
      });

      if (unwatchableMatch) {
        const latestWatch = getLatestWatchInstance(
          unwatchableMatch.watchHistory || [],
        );
        const whyMessage =
          latestWatch && latestWatch.notes
            ? latestWatch.notes
            : "No reason was recorded.";
        const unwatchableTitle = document.getElementById(
          "unwatchableDuplicateModalLabel",
        );
        const unwatchableBody = document.getElementById(
          "unwatchableDuplicateBody",
        );
        const unwatchableWhyContainer = document.getElementById(
          "unwatchableDuplicateWhy",
        );
        if (unwatchableTitle)
          unwatchableTitle.textContent = "⚠️ Unwatchable Title Detected";
        if (unwatchableBody) {
          unwatchableBody.textContent = "";
          unwatchableBody.appendChild(document.createTextNode("You already have "));
          const strongEl = document.createElement("strong");
          strongEl.textContent = `"${unwatchableMatch.Name || ""}" (${unwatchableMatch.Year || "N/A"})`;
          unwatchableBody.appendChild(strongEl);
          unwatchableBody.appendChild(document.createTextNode(" in your "));
          const badgeEl = document.createElement("span");
          badgeEl.className = "badge badge-secondary";
          badgeEl.textContent = "Unwatchable";
          unwatchableBody.appendChild(badgeEl);
          unwatchableBody.appendChild(document.createTextNode(" section."));
        }
        if (unwatchableWhyContainer) {
          unwatchableWhyContainer.style.display = "none";
          unwatchableWhyContainer.querySelector(
            "#unwatchableWhyMessage",
          ).textContent = whyMessage;
        }
        pendingEntryForConfirmation = entry;
        pendingEditIdForConfirmation = editId;
        $("#unwatchableDuplicateModal").modal("show");
        hideLoading();
        return;
      }
    }

    let hasDuplicateNameOnly = false;
    let hasDuplicateNameYear = false;
    for (const movie of movieData) {
      if (!movie || movie.id === editId || movie.is_deleted || !movie.Name)
        continue;
      if (movie.Status === "Unwatchable") continue; // Already handled above
      if (String(movie.Name).toLowerCase() !== entry.Name.toLowerCase())
        continue;
      if (movie.Year == entry.Year) {
        hasDuplicateNameYear = true;
        break;
      }
      hasDuplicateNameOnly = true;
    }

    if (hasDuplicateNameYear || hasDuplicateNameOnly) {
      pendingEntryForConfirmation = entry;
      pendingEditIdForConfirmation = editId;
      const duplicateTitle = document.getElementById(
        "duplicateNameConfirmModalLabel",
      );
      const duplicateBody = document.querySelector(
        "#duplicateNameConfirmModal .modal-body",
      );
      if (duplicateTitle && duplicateBody) {
        window.duplicateModalMode = "save"; // reset mode for save
        const confirmBtn = document.getElementById("confirmDuplicateSaveBtn");
        const cancelBtn = document.getElementById("cancelDuplicateSaveBtn");
        if (confirmBtn) confirmBtn.textContent = "Save Anyway";
        if (cancelBtn) cancelBtn.textContent = "Cancel";

        if (hasDuplicateNameYear) {
          duplicateTitle.textContent = "Duplicate Name and Year Detected";
          duplicateBody.textContent =
            `An entry for "${entry.Name}" (${entry.Year}) already exists. Do you want to save this one anyway?`;
        } else {
          duplicateTitle.textContent = "Duplicate Name Detected";
          duplicateBody.textContent =
            `An entry with the name "${entry.Name}" already exists. Do you want to save this new/edited entry anyway?`;
        }
      }
      $("#duplicateNameConfirmModal").modal("show");
      hideLoading();
      return;
    }
    await proceedWithEntrySave(entry, editId, saveAction);
  } catch (error) {
    console.error("Error in handleFormSubmit:", error);
    showToast("Save Error", `Error: ${error.message}`, "error");
    hideLoading();
  }
};

window.proceedWithEntrySave = async function (
  entryToSave,
  idToEdit,
  saveAction,
) {
  let savedEntryId = idToEdit;
  try {
    if (!idToEdit) {
      entryToSave.id = entryToSave.id || generateUUID();
      savedEntryId = entryToSave.id;
      movieData.push(entryToSave);

      const toastActions =
        saveAction === "quickSave" || saveAction === "saveAndAddAnother"
          ? [
            {
              label: "Edit Details",
              className: "btn-outline-light btn-sm",
              onClick: () => prepareEditModal(savedEntryId),
            },
          ]
          : [];

      showToast(
        "Entry Added",
        `"${entryToSave.Name}" added locally.`,
        "success",
        undefined,
        DO_NOT_SHOW_AGAIN_KEYS.ENTRY_ADDED,
        toastActions,
      );

      if (entryToSave.Status === "To Watch") logWatchlistActivity("added");
    } else {
      const existingIndex = movieData.findIndex((m) => m && m.id === idToEdit);
      if (existingIndex !== -1) {
        const oldStatus = movieData[existingIndex].Status;
        const newStatus = entryToSave.Status;
        if (oldStatus === "To Watch" && newStatus === "Watched")
          logWatchlistActivity("completed");

        const originalSyncState = movieData[existingIndex]._sync_state;
        movieData[existingIndex] = {
          ...movieData[existingIndex],
          ...entryToSave,
          id: idToEdit,
        };
        if (originalSyncState === "new")
          movieData[existingIndex]._sync_state = "new";
      } else {
        showToast("Update Error", "Entry to update not found.", "error");
        hideLoading();
        return;
      }
      showToast(
        "Entry Updated",
        `"${entryToSave.Name}" updated.`,
        "success",
        undefined,
        DO_NOT_SHOW_AGAIN_KEYS.ENTRY_UPDATED,
      );
    }
    recalculateAndApplyAllRelationships();
    sortMovies(currentSortColumn, currentSortDirection);
    renderMovieCards();
    await saveToIndexedDB();

    // NEW: Track Modification for Custom Sync Mode
    if (typeof trackModification === "function")
      trackModification(savedEntryId);

    // Handle post-save actions with Modal-Gated sync hold support
    switch (saveAction) {
      case "saveAndAddAnother":
        // Keep modal open, reset form in-place for seamless batch adding
        window.isModalSyncHold = true;
        window.isModalTransitioning = false;
        prepareAddModal(false);
        break;
      case "saveAndEdit":
        // Keep modal open, transition into edit mode in-place
        window.isModalSyncHold = true;
        window.isModalTransitioning = false;
        prepareEditModal(savedEntryId, false);
        break;
      case "quickSave":
      default:
        window.isModalTransitioning = false;
        $("#entryModal").modal("hide");
        break;
    }

    pendingEntryForConfirmation = null;
    pendingEditIdForConfirmation = null;
    await checkAndNotifyNewAchievements();
    if (entryToSave.tmdb_collection_id)
      await propagateCollectionDataUpdate(entryToSave);
  } catch (error) {
    console.error("Error in proceedWithEntrySave:", error);
    showToast("Save Error", `Error: ${error.message}`, "error");
  } finally {
    hideLoading();
  }
};
// END CHUNK: Entry Form Submission and Save Logic

// START CHUNK: Quick Update Save Logic
window.handleQuickUpdateSave = async function (event) {
  event.preventDefault();
  showLoading("Saving progress...");

  try {
    const entryId = document.getElementById("quickUpdateEntryId").value;
    const entryIndex = movieData.findIndex((m) => m && m.id === entryId);
    if (entryIndex === -1) {
      throw new Error("Entry not found to update.");
    }

    const movie = movieData[entryIndex];
    const isSeries = movie.Category === "Series";
    const oldStatus = movie.Status; // Save BEFORE overwriting for watchlist tracking

    // --- PHASE 1: Read all DOM values first (validation phase) ---
    // This ensures no mutation happens if any element is missing.
    const watchDate = document.getElementById("quickUpdateDate").value;
    const watchRating = document.getElementById("quickUpdateRating").value;
    const watchNotes = document.getElementById("quickUpdateNotes").value.trim();

    if (!watchDate) {
      throw new Error("Watch Date is required.");
    }

    // Collect series/movie specific fields
    let updatedFields = {};

    if (isSeries) {
      const isFinished = document.getElementById(
        "quickUpdateFinishedToggle",
      ).checked;
      const seasonVal =
        parseInt(document.getElementById("quickUpdateSeasons").value, 10) ||
        movie.currentSeason ||
        (movie.seasonsCompleted != null ? movie.seasonsCompleted + 1 : 1);
      const epVal =
        parseInt(document.getElementById("quickUpdateEpisodes").value, 10) ||
        movie.currentEpisode ||
        movie.currentSeasonEpisodesWatched ||
        0;

      if (isFinished) {
        updatedFields.Status = "Watched";
        updatedFields.currentSeason = null;
        updatedFields.currentEpisode = null;
        updatedFields.seasonsCompleted = null;
        updatedFields.currentSeasonEpisodesWatched = null;
        const overallRatingEl = document.getElementById("quickUpdateOverallRating");
        updatedFields.overallRating = overallRatingEl ? overallRatingEl.value : watchRating;
        const recEl = document.getElementById("quickUpdateRecommendation");
        updatedFields.Recommendation = recEl ? recEl.value : "";
        const personalRecEl = document.getElementById("quickUpdatePersonalRecommendation");
        updatedFields.personalRecommendation = personalRecEl ? personalRecEl.value : "";
      } else {
        updatedFields.Status = "Continue";
        updatedFields.currentSeason = seasonVal;
        updatedFields.currentEpisode = epVal;
        updatedFields.seasonsCompleted = Math.max(0, seasonVal - 1);
        updatedFields.currentSeasonEpisodesWatched = epVal;
      }
    } else {
      // It's a Movie/Doc/Special
      updatedFields.Status = "Watched";
      updatedFields.overallRating = watchRating;
      const recEl = document.getElementById("quickUpdateRecommendation");
      updatedFields.Recommendation = recEl ? recEl.value : "";
      const personalRecEl = document.getElementById("quickUpdatePersonalRecommendation");
      updatedFields.personalRecommendation = personalRecEl ? personalRecEl.value : "";
    }

    // --- PHASE 2: All reads succeeded, now mutate the movie object ---
    const timeEl = document.getElementById("quickUpdateTime");
    const timeValue = timeEl ? timeEl.value.trim() : "";
    let h = 0, m = 0, s = 0;
    if (timeValue) {
      const parts = timeValue.split(":").map((v) => parseInt(v, 10) || 0);
      h = parts[0] || 0;
      m = parts[1] || 0;
      s = parts[2] || 0;
    }
    const [watchYear, watchMonth, watchDay] = watchDate
      .split("-")
      .map((value) => parseInt(value, 10));
    const newWatchRecord = {
      watchId: generateUUID(),
      date: new Date(
        watchYear,
        watchMonth - 1,
        watchDay,
        h,
        m,
        s,
        0,
      ).toISOString(),
      rating: watchRating,
      notes: watchNotes,
    };
    if (!Array.isArray(movie.watchHistory)) movie.watchHistory = [];
    movie.watchHistory.push(newWatchRecord);

    // Apply collected fields
    Object.assign(movie, updatedFields);

    // Track watchlist completion (using saved oldStatus)
    if (oldStatus === "To Watch" && movie.Status === "Watched") {
      logWatchlistActivity("completed");
    }

    movie.lastModifiedDate = new Date().toISOString();
    if (movie._sync_state !== "new") {
      movie._sync_state = "edited";
    }

    await saveToIndexedDB();
    if (typeof trackModification === "function") trackModification(entryId);
    renderMovieCards();

    // Check if opened from daily recommendation to trigger achievement
    if (window.lastOpenedFromDailyRec === entryId) {
      incrementLocalStorageCounter("daily_rec_watched_achievement");
      window.lastOpenedFromDailyRec = null;
    }

    await checkAndNotifyNewAchievements();

    $("#quickUpdateModal").modal("hide");
    showToast(
      "Progress Updated",
      `"${movie.Name}" has been updated.`,
      "success",
    );
  } catch (error) {
    console.error("Error in handleQuickUpdateSave:", error);
    showToast("Update Failed", error.message, "error");
  } finally {
    hideLoading();
  }
};
// END CHUNK: Quick Update Save Logic

// START CHUNK: Deletion Logic
window.performDeleteEntry = async function () {
  if (!movieIdToDelete) {
    showToast("Error", "No entry selected.", "error");
    $("#confirmDeleteModal").modal("hide");
    return;
  }
  showLoading("Deleting entry locally...");
  try {
    const entryIndex = movieData.findIndex(
      (m) => m && m.id === movieIdToDelete,
    );
    if (entryIndex === -1) {
      showToast("Error", "Entry not found for deletion.", "error");
      return;
    }
    const movieName = movieData[entryIndex].Name || "The entry";
    movieData[entryIndex].is_deleted = true;
    movieData[entryIndex]._sync_state = "deleted";
    movieData[entryIndex].lastModifiedDate = new Date().toISOString();

    movieData.forEach((movie) => {
      if (
        movie &&
        movie.relatedEntries &&
        movie.relatedEntries.includes(movieIdToDelete)
      ) {
        movie.relatedEntries = movie.relatedEntries.filter(
          (id) => id !== movieIdToDelete,
        );
        movie.lastModifiedDate = new Date().toISOString();
        if (movie._sync_state !== "new") movie._sync_state = "edited";
      }
    });

    recalculateAndApplyAllRelationships();
    renderMovieCards();
    recalculateAndApplyAllRelationships();
    renderMovieCards();
    await saveToIndexedDB();

    // NEW: Track Modification (Deletion)
    if (typeof trackModification === "function" && movieIdToDelete)
      trackModification(movieIdToDelete);

    showToast(
      "Entry Deleted",
      `${movieName} removed locally. Sync with cloud to finalize.`,
      "warning",
      undefined,
      DO_NOT_SHOW_AGAIN_KEYS.ENTRY_DELETED,
    );
  } catch (error) {
    console.error("Error deleting entry:", error);
    showToast("Delete Failed", `Error: ${error.message}`, "error", 7000);
  } finally {
    movieIdToDelete = null;
    $("#confirmDeleteModal").modal("hide");
    hideLoading();
  }
};

window.performBatchDelete = async function () {
  if (!isMultiSelectMode || selectedEntryIds.length === 0) return;
  const idsToDelete = [...selectedEntryIds];
  const numToDelete = idsToDelete.length;
  showLoading(`Deleting ${numToDelete} entries locally...`);
  try {
    const currentTimestamp = new Date().toISOString();
    let changesMade = false;

    idsToDelete.forEach((deletedId) => {
      const entryIndex = movieData.findIndex((m) => m && m.id === deletedId);
      if (entryIndex !== -1) {
        movieData[entryIndex].is_deleted = true;
        movieData[entryIndex]._sync_state = "deleted";
        movieData[entryIndex].lastModifiedDate = currentTimestamp;
        changesMade = true;
      }
    });

    movieData.forEach((movie) => {
      if (movie && movie.relatedEntries) {
        const originalCount = movie.relatedEntries.length;
        movie.relatedEntries = movie.relatedEntries.filter(
          (id) => !idsToDelete.includes(id),
        );
        if (movie.relatedEntries.length < originalCount) {
          movie.lastModifiedDate = currentTimestamp;
          if (movie._sync_state !== "new") movie._sync_state = "edited";
        }
      }
    });

    if (changesMade) {
      recalculateAndApplyAllRelationships();
      await saveToIndexedDB();

      // NEW: Track Batch Deletions
      if (typeof trackModification === "function")
        trackModification(idsToDelete);

      renderMovieCards();
      showToast(
        "Local Deletion",
        `${numToDelete} entries removed locally. Sync with cloud to finalize.`,
        "warning",
      );
    }
  } catch (error) {
    console.error("Batch delete error:", error);
    showToast("Batch Delete Failed", `Error: ${error.message}`, "error", 7000);
  } finally {
    disableMultiSelectMode();
    $("#confirmDeleteModal").modal("hide");
    hideLoading();
  }
};
// END CHUNK: Deletion Logic

// START CHUNK: Global Data Management (Check/Repair)
window.performDataCheckAndRepair = async function () {
  showLoading("Performing data integrity checks...");
  try {
    let issues = [];
    let changesMade = false;
    const uuidRegex =
      /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-4[0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;
    const allValidIds = new Set(movieData.map((m) => m.id));

    for (let i = movieData.length - 1; i >= 0; i--) {
      let entry = movieData[i];
      if (!entry) {
        issues.push(`Removed null entry at index ${i}.`);
        movieData.splice(i, 1);
        changesMade = true;
        continue;
      }
      let entryModified = false;
      if (!entry.id || !uuidRegex.test(entry.id)) {
        issues.push(
          `Entry "${entry.Name || "Unnamed"}" had invalid ID. Regenerated.`,
        );
        entry.id = generateUUID();
        entryModified = true;
      }
      if (Array.isArray(entry.relatedEntries)) {
        const originalCount = entry.relatedEntries.length;
        entry.relatedEntries = entry.relatedEntries.filter((id) =>
          allValidIds.has(id),
        );
        if (entry.relatedEntries.length < originalCount) {
          issues.push(
            `Entry "${entry.Name}": Removed ${originalCount - entry.relatedEntries.length} orphaned related entries.`,
          );
          entryModified = true;
        }
      }
      if (entryModified) {
        entry.lastModifiedDate = new Date().toISOString();
        if (entry._sync_state !== "new") entry._sync_state = "edited";
        changesMade = true;
      }
    }
    if (changesMade) recalculateAndApplyAllRelationships();
    let message =
      issues.length > 0
        ? `Data check complete. Found and fixed ${issues.length} issue(s).`
        : "Data check complete. No integrity issues found!";
    if (changesMade) {
      message += ` Changes saved locally. Please sync with the cloud.`;
      await saveToIndexedDB();
      renderMovieCards();
    }
    showToast(
      issues.length > 0
        ? "Data Integrity Issues Found"
        : "Data Integrity Check",
      message,
      issues.length > 0 ? "warning" : "success",
      7000,
    );
  } catch (error) {
    console.error("Error during data check/repair:", error);
    showToast("Repair Error", `Failed: ${error.message}`, "error");
  } finally {
    hideLoading();
  }
};
// END CHUNK: Global Data Management (Check/Repair)

// START CHUNK: Batch Action Functions (Export, TMDB Refresh, Quick Actions, Franchise)

/** Export selected entries as JSON or CSV */
window.exportSelectedEntries = function (type) {
  if (!isMultiSelectMode || selectedEntryIds.length === 0) {
    showToast("No Selection", "Select entries first.", "warning");
    return;
  }
  const selected = movieData
    .filter((m) => m && selectedEntryIds.includes(m.id) && !m.is_deleted)
    .map((entry) => {
      const clean = { ...entry };
      delete clean._sync_state;
      delete clean.is_deleted;
      if (type === "csv") {
        for (const key in clean) {
          if (typeof clean[key] === "object" && clean[key] !== null) {
            clean[key] = JSON.stringify(clean[key]);
          }
        }
      }
      return clean;
    });

  if (selected.length === 0) {
    showToast("No Data", "No valid entries in selection.", "info");
    return;
  }

  let fileContent, fileMimeType, fileName;
  if (type === "json") {
    fileContent = JSON.stringify(selected, null, 2);
    fileMimeType = "application/json;charset=utf-8;";
    fileName = `keepmoviez_selected_${selected.length}.json`;
  } else {
    // CSV using Papa if available, else manual
    if (typeof Papa !== "undefined") {
      fileContent = Papa.unparse(selected, { header: true });
    } else {
      const headers = Object.keys(selected[0]).join(",");
      const rows = selected.map((r) =>
        Object.values(r)
          .map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`)
          .join(","),
      );
      fileContent = [headers, ...rows].join("\n");
    }
    fileMimeType = "text/csv;charset=utf-8;";
    fileName = `keepmoviez_selected_${selected.length}.csv`;
  }

  const blob = new Blob([fileContent], { type: fileMimeType });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
  showToast(
    "Export Complete",
    `${selected.length} entries exported as ${type.toUpperCase()}.`,
    "success",
  );
};

/** Batch TMDB Refresh — sequential with 200ms gap to respect rate limits */
window.batchRefreshTmdb = async function () {
  if (!isMultiSelectMode || selectedEntryIds.length === 0) {
    showToast("No Selection", "Select entries first.", "warning");
    return;
  }
  if (!window.callTmdbApiDirect) {
    showToast("Unavailable", "TMDB API not ready. Please sign in.", "error");
    return;
  }

  const toRefresh = movieData.filter(
    (m) => m && selectedEntryIds.includes(m.id) && m.tmdbId && !m.is_deleted,
  );
  const skipped = selectedEntryIds.length - toRefresh.length;

  if (toRefresh.length === 0) {
    showToast(
      "No TMDB IDs",
      "None of the selected entries have a TMDB ID.",
      "warning",
    );
    return;
  }

  showLoading(`Refreshing TMDB data for ${toRefresh.length} entries...`);
  let updated = 0;
  let failed = 0;
  const currentTimestamp = new Date().toISOString();

  for (let i = 0; i < toRefresh.length; i++) {
    const entry = toRefresh[i];
    try {
      if (i > 0) await new Promise((r) => setTimeout(r, 200));
      const mediaType =
        entry.tmdbMediaType || (entry.Category === "Series" ? "tv" : "movie");
      const data = await callTmdbApiDirect(`/${mediaType}/${entry.tmdbId}`, {
        append_to_response: "credits,keywords,collection,external_ids",
      });
      if (!data) { failed++; continue; }

      const entryIndex = movieData.findIndex((m) => m.id === entry.id);
      if (entryIndex === -1) { failed++; continue; }
      const e = movieData[entryIndex];

      // Refresh key TMDB fields
      if (data.poster_path) e["Poster URL"] = `https://image.tmdb.org/t/p/w500${data.poster_path}`;
      if (data.vote_average != null) e.tmdb_vote_average = data.vote_average;
      if (data.vote_count != null) e.tmdb_vote_count = data.vote_count;
      const runtime = mediaType === "movie" ? data.runtime : (data.episode_run_time?.[0] || null);
      if (runtime) e.runtime = runtime;
      const releaseDate = data.release_date || data.first_air_date;
      if (releaseDate) e.tmdb_release_date = releaseDate;
      const creditsData = data.credits || {};
      if (creditsData.cast?.length) e.full_cast = creditsData.cast.slice(0, 15).map((a) => ({ id: a.id, name: a.name, character: a.character, profile_path: a.profile_path }));
      const crew = creditsData.crew || [];
      const director = crew.find((c) => c.job === "Director");
      if (director) e.director_info = { id: director.id, name: director.name, profile_path: director.profile_path };
      const kw = data.keywords?.keywords || data.keywords?.results || [];
      if (kw.length) e.keywords = kw.slice(0, 20).map((k) => ({ id: k.id, name: k.name }));

      e.lastModifiedDate = currentTimestamp;
      if (e._sync_state !== "new") e._sync_state = "edited";
      updated++;
    } catch (err) {
      console.warn(`TMDB refresh failed for "${entry.Name}":`, err.message);
      failed++;
    }
  }

  if (updated > 0) {
    await saveToIndexedDB();
    if (typeof trackModification === "function") trackModification(selectedEntryIds);
    renderMovieCards();
  }

  hideLoading();
  let msg = `${updated} updated`;
  if (failed > 0) msg += `, ${failed} failed`;
  if (skipped > 0) msg += `, ${skipped} skipped (no TMDB ID)`;
  showToast("TMDB Refresh Done", msg, updated > 0 ? "success" : "warning");
};

/** Batch mark as Watched */
window.batchMarkAs = async function (status) {
  if (!isMultiSelectMode || selectedEntryIds.length === 0) return;
  showLoading(`Marking ${selectedEntryIds.length} entries as ${status}...`);
  try {
    let count = 0;
    const ts = new Date().toISOString();
    selectedEntryIds.forEach((id) => {
      const idx = movieData.findIndex((m) => m.id === id);
      if (idx === -1) return;
      if (movieData[idx].Status === status) return;
      if (movieData[idx].Status === "To Watch" && status === "Watched")
        logWatchlistActivity("completed");
      movieData[idx].Status = status;
      movieData[idx].lastModifiedDate = ts;
      if (movieData[idx]._sync_state !== "new") movieData[idx]._sync_state = "edited";
      count++;
    });
    if (count > 0) {
      await saveToIndexedDB();
      if (typeof trackModification === "function") trackModification(selectedEntryIds);
      renderMovieCards();
      showToast("Done", `${count} entries marked as "${status}".`, "success");
    } else {
      showToast("No Change", `All selected entries were already "${status}".`, "info");
    }
    disableMultiSelectMode();
  } catch (err) {
    showToast("Error", err.message, "error");
  } finally {
    hideLoading();
  }
};

/** Link all selected entries as a franchise/collection (mutual relatedEntries) */
window.batchLinkAsFranchise = async function () {
  if (!isMultiSelectMode || selectedEntryIds.length < 2) {
    showToast("Need 2+", "Select at least 2 entries to link as a franchise.", "warning");
    return;
  }
  showLoading(`Linking ${selectedEntryIds.length} entries as franchise...`);
  try {
    const ts = new Date().toISOString();
    selectedEntryIds.forEach((id) => {
      const idx = movieData.findIndex((m) => m.id === id);
      if (idx === -1) return;
      const others = selectedEntryIds.filter((oid) => oid !== id);
      const existing = new Set(movieData[idx].relatedEntries || []);
      others.forEach((oid) => existing.add(oid));
      movieData[idx].relatedEntries = Array.from(existing);
      movieData[idx].lastModifiedDate = ts;
      if (movieData[idx]._sync_state !== "new") movieData[idx]._sync_state = "edited";
    });
    recalculateAndApplyAllRelationships();
    await saveToIndexedDB();
    if (typeof trackModification === "function") trackModification(selectedEntryIds);
    renderMovieCards();
    showToast("Franchise Linked", `${selectedEntryIds.length} entries linked together.`, "success");
    disableMultiSelectMode();
  } catch (err) {
    showToast("Error", err.message, "error");
  } finally {
    hideLoading();
  }
};

// END CHUNK: Batch Action Functions

// START CHUNK: Batch Edit Logic
window.handleBatchEditFormSubmit = async function (event) {
  event.preventDefault();
  if (!isMultiSelectMode || selectedEntryIds.length === 0) return;

  const changes = {};
  const getVal = (id) => {
    const el = document.getElementById(id);
    return el ? el.value : "";
  };
  const isChecked = (id) => {
    const el = document.getElementById(id);
    return el ? el.checked : false;
  };

  if (isChecked("batchEditApply_Status"))
    changes.Status = getVal("batchEditStatus");
  if (isChecked("batchEditApply_Category"))
    changes.Category = getVal("batchEditCategory");
  if (isChecked("batchEditApply_AddGenre")) {
    const toAdd = Array.isArray(selectedBatchAddGenres) ? [...selectedBatchAddGenres] : [];
    const rawVal = getVal("batchEditAddGenreSearchInput").trim();
    if (rawVal && typeof UNIQUE_ALL_GENRES !== "undefined") {
      const match = UNIQUE_ALL_GENRES.find((g) => g.toLowerCase() === rawVal.toLowerCase());
      if (match && !toAdd.includes(match)) toAdd.push(match);
    }
    if (toAdd.length > 0) changes.addGenres = toAdd;
  }
  if (isChecked("batchEditApply_RemoveGenre")) {
    const toRemove = Array.isArray(selectedBatchRemoveGenres) ? [...selectedBatchRemoveGenres] : [];
    const rawVal = getVal("batchEditRemoveGenreSearchInput").trim();
    if (rawVal && typeof UNIQUE_ALL_GENRES !== "undefined") {
      const match = UNIQUE_ALL_GENRES.find((g) => g.toLowerCase() === rawVal.toLowerCase());
      if (match && !toRemove.includes(match)) toRemove.push(match);
    }
    if (toRemove.length > 0) changes.removeGenres = toRemove;
  }
  if (isChecked("batchEditApply_OverallRating"))
    changes.overallRating = getVal("batchEditOverallRating");
  if (isChecked("batchEditApply_Recommendation"))
    changes.Recommendation = getVal("batchEditRecommendation");
  if (isChecked("batchEditApply_PersonalRecommendation"))
    changes.personalRecommendation = getVal("batchEditPersonalRecommendation");
  if (isChecked("batchEditApply_Country"))
    changes.Country = getVal("batchEditCountry").trim().toUpperCase();
  if (isChecked("batchEditApply_Language"))
    changes.Language = getVal("batchEditLanguage").trim();
  if (isChecked("batchEditApply_Year")) {
    const yearStr = getVal("batchEditYear").trim();
    const parsedYear = parseInt(yearStr, 10);
    changes.Year = yearStr === "" ? null : isNaN(parsedYear) ? null : parsedYear;
  }
  // New fields
  if (isChecked("batchEditApply_DoNotRecommendDaily"))
    changes.doNotRecommendDaily = document.getElementById("batchEditDoNotRecommendDaily")?.checked ?? false;
  if (isChecked("batchEditApply_Keywords")) {
    const kwRaw = getVal("batchEditKeywords").trim();
    changes.addKeywords = kwRaw
      ? kwRaw.split(",").map((k) => k.trim()).filter(Boolean)
      : [];
  }
  if (isChecked("batchEditApply_LogWatchSession")) {
    const watchDate = getVal("batchEditWatchDate");
    const watchRating = getVal("batchEditWatchRating");
    if (watchDate) changes.logWatchSession = { date: watchDate, rating: watchRating || null };
  }
  if (isChecked("batchEditApply_CurrentSeason") || isChecked("batchEditApply_SeasonsCompleted")) {
    const cs = parseInt(getVal("batchEditCurrentSeason") || getVal("batchEditSeasonsCompleted"), 10);
    if (!isNaN(cs) && cs >= 1) {
      changes.currentSeason = cs;
      changes.seasonsCompleted = Math.max(0, cs - 1);
    }
  }
  if (isChecked("batchEditApply_CurrentEpisode")) {
    const ce = parseInt(getVal("batchEditCurrentEpisode"), 10);
    if (!isNaN(ce) && ce >= 0) {
      changes.currentEpisode = ce;
      changes.currentSeasonEpisodesWatched = ce;
    }
  }

  if (Object.keys(changes).length === 0) {
    showToast("No Changes", "Check a box and provide a value to apply.", "info");
    return;
  }

  showLoading(`Applying batch edits to ${selectedEntryIds.length} entries...`);
  try {
    let changesMadeCount = 0;
    const currentLMD = new Date().toISOString();

    selectedEntryIds.forEach((id) => {
      const entryIndex = movieData.findIndex((m) => m.id === id);
      if (entryIndex === -1) return;
      let entry = movieData[entryIndex];
      let entryModified = false;

      if ("Status" in changes) {
        const oldStatus = entry.Status, newStatus = changes.Status;
        if (oldStatus === "To Watch" && newStatus === "Watched")
          logWatchlistActivity("completed");
      }

      const standardKeys = [
        "Status", "Category", "overallRating", "Recommendation",
        "personalRecommendation", "Year", "Country", "Language",
        "doNotRecommendDaily", "currentSeason", "currentEpisode", "seasonsCompleted",
        "currentSeasonEpisodesWatched",
      ];
      standardKeys.forEach((key) => {
        if (key in changes && entry[key] !== changes[key]) {
          entry[key] = changes[key];
          entryModified = true;
        }
      });

      if (changes.addGenres && changes.addGenres.length > 0) {
        let genres = new Set(
          (entry.Genre || "").split(",").map((g) => g.trim()).filter(Boolean),
        );
        let modified = false;
        changes.addGenres.forEach((g) => {
          if (!genres.has(g)) {
            genres.add(g);
            modified = true;
          }
        });
        if (modified) {
          entry.Genre = Array.from(genres).sort().join(", ");
          entryModified = true;
        }
      }
      if (changes.removeGenres && changes.removeGenres.length > 0) {
        let genres = new Set(
          (entry.Genre || "").split(",").map((g) => g.trim()).filter(Boolean),
        );
        let modified = false;
        changes.removeGenres.forEach((g) => {
          if (genres.has(g)) {
            genres.delete(g);
            modified = true;
          }
        });
        if (modified) {
          entry.Genre = Array.from(genres).sort().join(", ");
          entryModified = true;
        }
      }


      // Append keywords (tag-style, no duplicates)
      if ("addKeywords" in changes && changes.addKeywords.length > 0) {
        const existing = new Set((entry.keywords || []).map((k) => (typeof k === "string" ? k : k.name)));
        const newKws = changes.addKeywords.filter((k) => !existing.has(k));
        if (newKws.length > 0) {
          entry.keywords = [...(entry.keywords || []), ...newKws];
          entryModified = true;
        }
      }

      // Append watch session
      if ("logWatchSession" in changes && changes.logWatchSession) {
        let sessionDate = changes.logWatchSession.date;
        if (sessionDate && sessionDate.length === 10 && sessionDate.includes("-")) {
          const [by, bm, bd] = sessionDate.split("-").map((v) => parseInt(v, 10) || 0);
          sessionDate = new Date(by, bm - 1, bd, 0, 0, 0, 0).toISOString();
        }
        const session = {
          watchId: generateUUID(),
          date: sessionDate,
          rating: changes.logWatchSession.rating,
          notes: "",
        };
        if (!Array.isArray(entry.watchHistory)) entry.watchHistory = [];
        entry.watchHistory.push(session);
        // Update status to Watched if To Watch
        if (entry.Status === "To Watch") {
          entry.Status = "Watched";
          logWatchlistActivity("completed");
        }
        entryModified = true;
      }

      if (entryModified) {
        entry.lastModifiedDate = currentLMD;
        if (entry._sync_state !== "new") entry._sync_state = "edited";
        changesMadeCount++;
      }
    });

    if (changesMadeCount > 0) {
      await saveToIndexedDB();
      if (typeof trackModification === "function")
        trackModification(selectedEntryIds);
      renderMovieCards();
      showToast(
        "Batch Edit Complete",
        `${changesMadeCount} of ${selectedEntryIds.length} entries updated locally.`,
        "success",
      );
    } else {
      showToast(
        "No Changes Applied",
        "Entries already had the specified values.",
        "info",
      );
    }
    $("#batchEditModal").modal("hide");
    disableMultiSelectMode();
  } catch (error) {
    console.error("Error in batch edit:", error);
    showToast("Batch Edit Error", `Failed: ${error.message}`, "error");
  } finally {
    hideLoading();
  }
};
// END CHUNK: Batch Edit Logic


// START CHUNK: Recommendation Modal Actions
window.markDailyRecCompleted = async function (event) {
  const movieId = event.target.closest("button").dataset.movieId;
  window.lastOpenedFromDailyRec = movieId;
  $('#dailyRecommendationModal').modal('hide');
  $('#dailyRecommendationModal').one('hidden.bs.modal', () => {
    prepareQuickUpdateModal(movieId);
  });
};

// END CHUNK: Recommendation Modal Actions

// START CHUNK: Achievement and Usage Helpers
function incrementLocalStorageCounter(key) {
  if (!key) return;
  try {
    const userPrefixedKey = window.currentSupabaseUser ? window.currentSupabaseUser.id + "_" + key : key;
    let count = parseInt(localStorage.getItem(userPrefixedKey) || "0");
    if (isNaN(count)) count = 0;
    localStorage.setItem(userPrefixedKey, (count + 1).toString());

    if (window.currentSupabaseUser) {
      let pending = JSON.parse(localStorage.getItem(window.currentSupabaseUser.id + "_pending_stats") || "{}");
      pending[key] = (pending[key] || 0) + 1;
      localStorage.setItem(window.currentSupabaseUser.id + "_pending_stats", JSON.stringify(pending));
    }
  } catch (e) {
    console.error(`Failed to increment stat for key: ${key}`, e);
  }
}

function recordUniqueDateForAchievement(key) {
  if (!key) return;
  try {
    const today = new Date().toISOString().slice(0, 10);
    const userPrefixedKey = window.currentSupabaseUser ? window.currentSupabaseUser.id + "_" + key : key;
    let dates = JSON.parse(localStorage.getItem(userPrefixedKey) || "[]");
    if (!Array.isArray(dates)) dates = [];
    if (!dates.includes(today)) {
      dates.push(today);
      localStorage.setItem(userPrefixedKey, JSON.stringify(dates));

      // Directly increment the stat for the backend using the length or by 1
      incrementLocalStorageCounter(key + "_count");
    }
  } catch (e) {
    console.error(`Failed to record unique date for key: ${key}`, e);
  }
}
window.checkAndNotifyNewAchievements = async function (isInitialLoad = false) {
  if (movieData.length === 0) {
    knownUnlockedAchievements.clear();
    return;
  }
  const stats = calculateAllStatistics(movieData);
  // Cache stats so the achievements/modal can use precomputed data without recalculating
  try { window.globalStatsData = stats || {}; } catch (e) { /* ignore */ }
  let unlockedCountForMeta = 0;
  const currentlyUnlocked = new Set();

  ACHIEVEMENTS.forEach((ach) => {
    if (ach.type !== "meta_achievement_count") {
      const { isAchieved } = checkAchievement(ach, stats);
      if (isAchieved) {
        unlockedCountForMeta++;
        currentlyUnlocked.add(ach.id);
      }
    }
  });
  stats.unlockedCountForMeta = unlockedCountForMeta;
  ACHIEVEMENTS.forEach((ach) => {
    if (ach.type === "meta_achievement_count") {
      const { isAchieved } = checkAchievement(ach, stats);
      if (isAchieved) currentlyUnlocked.add(ach.id);
    }
  });

  if (isInitialLoad) {
    // Populate known set so the achievements modal shows current state without re-notifying
    // On initial sign-in, only notify for active_days achievements when the user's
    // total active days exactly equals the achievement threshold (i.e., just reached).
    try {
      const activeDays = stats.achievementData && stats.achievementData.active_days_count ? stats.achievementData.active_days_count : 0;
      const activeDayAchievements = ACHIEVEMENTS.filter(a => a.type === 'active_days_count');
      const toShow = activeDayAchievements.filter((ach) => {
        return currentlyUnlocked.has(ach.id) && (activeDays === ach.threshold);
      });

      toShow.forEach((achievement, index) => {
        const toastActions = [
          {
            label: "View Achievements",
            className: "btn-outline-light",
            onClick: () => {
              if (typeof displayAchievementsModal === "function" && typeof $ !== "undefined") {
                displayAchievementsModal();
                $("#achievementsModal").modal("show");
              }
            },
          },
        ];
        setTimeout(() => {
          showToast(
            `🏆 Achievement Unlocked!`,
            `<strong>${achievement.name}</strong><br><small>${achievement.description}</small>`,
            "success",
            0,
            null,
            toastActions,
          );
        }, 500 * index);
      });
    } catch (e) {
      console.error('Error showing initial active-days achievements:', e);
    }

    knownUnlockedAchievements = currentlyUnlocked;
    return;
  }

  const newlyUnlocked = [...currentlyUnlocked].filter(
    (id) => !knownUnlockedAchievements.has(id),
  );
  if (newlyUnlocked.length > 0) {
    newlyUnlocked.forEach((id, index) => {
      const achievement = ACHIEVEMENTS.find((ach) => ach.id === id);
      if (achievement) {
        setTimeout(() => {
          // Phase 3: Use celebration overlay with confetti if available
          if (typeof window.celebrateAchievementUnlock === 'function') {
            window.celebrateAchievementUnlock(achievement);
          } else {
            // Fallback: show toast
            const toastActions = [
              {
                label: "View Achievements",
                className: "btn-outline-light",
                onClick: () => {
                  if (typeof displayAchievementsModal === "function" && typeof $ !== "undefined") {
                    displayAchievementsModal();
                    $("#achievementsModal").modal("show");
                  }
                },
              },
            ];
            showToast(
              `🏆 Achievement Unlocked!`,
              `<strong>${achievement.name}</strong><br><small>${achievement.description}</small>`,
              "success",
              0,
              null,
              toastActions,
            );
          }
        }, 2000 * index); // 2s stagger to avoid overlapping celebrations
      }
    });
  }
  knownUnlockedAchievements = currentlyUnlocked;
};
// END CHUNK: Achievement and Usage Helpers
