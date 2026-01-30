/* backfill-ui.js - Interactive Backfill Modal */

// Backfill state
let backfillQueue = [];
let currentBackfillIndex = 0;
let backfillStats = {
  total: 0,
  completed: 0,
  skipped: 0,
};

// Field definitions with priority (higher = more important for stats)
const BACKFILL_FIELDS = [
  {
    key: "runtime",
    label: "Runtime",
    inputType: "number",
    placeholder: "e.g., 148",
    unit: "minutes",
    priority: 10,
    helperText: (entry) =>
      entry.Category === "Series"
        ? "Enter average episode runtime"
        : "Enter total runtime in minutes",
  },
  // MODIFIED: Status filter removed 'To Watch' based on user feedback. Only 'Continue' needs progress tracking.
  {
    key: "seasonsCompleted",
    label: "Seasons Completed",
    inputType: "number",
    placeholder: "e.g., 3",
    priority: 9,
    onlyFor: ["Series"],
    statusFilter: ["Continue"],
  },
  {
    key: "currentSeasonEpisodesWatched",
    label: "Episodes (Current Season)",
    inputType: "number",
    placeholder: "e.g., 5",
    priority: 9,
    onlyFor: ["Series"],
    statusFilter: ["Continue"],
  },
  {
    key: "Year",
    label: "Year",
    inputType: "number",
    placeholder: "YYYY",
    min: 1888,
    max: 2100,
    priority: 8,
  },
  {
    key: "Country",
    label: "Country",
    inputType: "text",
    placeholder: "e.g., US, IN, KR",
    normalize: true,
    priority: 7,
  },
  {
    key: "Language",
    label: "Language",
    inputType: "text",
    placeholder: "e.g., Hindi, English",
    priority: 6,
  },
  {
    key: "Status",
    label: "Status",
    inputType: "select",
    options: ["To Watch", "Watched", "Continue", "Unwatched"],
    priority: 7,
  },
  { key: "Genre", label: "Genres", inputType: "multi-genre", priority: 5 },
  {
    key: "tmdb_release_date",
    label: "Release Date",
    inputType: "date",
    priority: 4,
  },
  {
    key: "director_info",
    label: "Director Info",
    inputType: "text",
    placeholder: "Enter Director Name...",
    priority: 3,
    saveFormat: "tmdb-json",
    helperText:
      '💡 Tip: Using "Auto-Fetch" will automatically get the Director\'s ID and Profile Photo from TMDB!',
  },
  {
    key: "imdb_id",
    label: "IMDb ID",
    inputType: "text",
    placeholder: "e.g., tt0468569",
    priority: 2,
  },
];

// Configuration state
let availablefieldsToBackfill = [];

/**
 * Scan library to identify what's missing (Preliminary Scan)
 * Returns a summary of missing fields and counts
 */
function scanForMissingFieldsSummary() {
  if (!Array.isArray(movieData) || movieData.length === 0) return {};

  const summary = {};
  BACKFILL_FIELDS.forEach((field) => {
    summary[field.key] = {
      key: field.key,
      label: field.label,
      count: 0,
      priority: field.priority,
    };
  });

  movieData.forEach((entry) => {
    BACKFILL_FIELDS.forEach((field) => {
      // Apply restrictions
      if (field.onlyFor && !field.onlyFor.includes(entry.Category)) return;
      if (field.statusFilter && !field.statusFilter.includes(entry.Status))
        return;

      if (isFieldMissing(entry, field.key)) {
        summary[field.key].count++;
      }
    });
  });

  return Object.values(summary)
    .filter((item) => item.count > 0)
    .sort((a, b) => b.priority - a.priority);
}

/**
 * Build the actual processing queue based on selected fields
 */
function buildBackfillQueue(selectedFieldKeys) {
  const queue = [];
  movieData.forEach((entry) => {
    BACKFILL_FIELDS.forEach((field) => {
      // Only process fields the user selected
      if (!selectedFieldKeys.includes(field.key)) return;

      // Apply restrictions
      if (field.onlyFor && !field.onlyFor.includes(entry.Category)) return;
      if (field.statusFilter && !field.statusFilter.includes(entry.Status))
        return;

      if (isFieldMissing(entry, field.key)) {
        queue.push({
          entryId: entry.id,
          entryName: entry.Name,
          entryCategory: entry.Category,
          entryYear: entry.Year,
          fieldKey: field.key,
          fieldLabel: field.label,
          fieldConfig: field,
        });
      }
    });
  });
  // Sort logic: High priority fields first, then alphabetical by name
  return queue.sort((a, b) => {
    const priorityDiff = b.fieldConfig.priority - a.fieldConfig.priority;
    if (priorityDiff !== 0) return priorityDiff;
    return a.entryName.localeCompare(b.entryName);
  });
}

/**
 * Open the backfill modal - Starts with Configuration Screen
 */
function openBackfillModal() {
  if (!movieData || movieData.length === 0) {
    showToast("No Data", "Add some entries to your library first.", "info");
    return;
  }

  const missingSummary = scanForMissingFieldsSummary();

  if (missingSummary.length === 0) {
    showToast(
      "All Set!",
      "No missing data found. Your library looks complete!",
      "success",
    );
    return;
  }

  // Show modal
  if (typeof $ !== "undefined") {
    $("#backfillModal").modal("show");
    renderConfigurationScreen(missingSummary);
  }
}

/**
 * Render Configuration Screen (Checkboxes)
 */
function renderConfigurationScreen(summary) {
  const bodyEl = document.querySelector("#backfillModal .modal-body");
  const footerEl = document.querySelector("#backfillModal .modal-footer");

  // Header
  let html = `
        <div class="text-center mb-4">
            <h5>Select Fields to Backfill</h5>
            <p class="text-muted small">We found missing data for the following fields. Choose what you want to work on.</p>
        </div>
        <div class="list-group mb-3" style="max-height: 400px; overflow-y: auto;">
    `;

  // List items
  summary.forEach((item) => {
    html += `
            <label class="list-group-item d-flex justify-content-between align-items-center" style="cursor: pointer;">
                <div class="custom-control custom-checkbox">
                    <input type="checkbox" class="custom-control-input backfill-field-checkbox" id="check_${item.key}" value="${item.key}" checked>
                    <label class="custom-control-label" for="check_${item.key}">${item.label}</label>
                </div>
                <span class="badge badge-primary badge-pill">${item.count}</span>
            </label>
        `;
  });
  html += `</div>
        <div class="text-right">
            <button class="btn btn-sm btn-outline-secondary mr-2" id="backfillSelectAllBtn">Select All</button>
            <button class="btn btn-sm btn-outline-secondary" id="backfillDeselectAllBtn">Deselect All</button>
        </div>
    `;

  bodyEl.innerHTML = html;

  // Footer actions for Config Screen
  footerEl.innerHTML = `
        <button type="button" class="btn btn-secondary" data-dismiss="modal">Cancel</button>
        <button type="button" class="btn btn-success" id="startBackfillBtn">
            <i class="fas fa-play"></i> Start Backfill
        </button>
    `;

  // Wire up Select/Deselect All
  document.getElementById("backfillSelectAllBtn").onclick = () => {
    document
      .querySelectorAll(".backfill-field-checkbox")
      .forEach((cb) => (cb.checked = true));
  };
  document.getElementById("backfillDeselectAllBtn").onclick = () => {
    document
      .querySelectorAll(".backfill-field-checkbox")
      .forEach((cb) => (cb.checked = false));
  };

  // Wire up Start Button
  document.getElementById("startBackfillBtn").onclick = () => {
    const selectedKeys = Array.from(
      document.querySelectorAll(".backfill-field-checkbox:checked"),
    ).map((cb) => cb.value);
    if (selectedKeys.length === 0) {
      showToast(
        "Selections Required",
        "Please select at least one field to backfill.",
        "warning",
      );
      return;
    }

    // Build Queue and Start
    backfillQueue = buildBackfillQueue(selectedKeys);
    currentBackfillIndex = 0;
    backfillStats = { total: backfillQueue.length, completed: 0, skipped: 0 };

    // Restore standard footer for the card view
    renderStandardBackfillFooter();

    // Render first card
    renderBackfillCard();
  };
}

/**
 * Restore standard footer controls for the card view
 */
function renderStandardBackfillFooter() {
  const footerEl = document.querySelector("#backfillModal .modal-footer");
  footerEl.innerHTML = `
        <button type="button" class="btn btn-outline-secondary mr-auto" id="backfillGoogleBtn">
            <i class="fab fa-google"></i> Google It
        </button>
        <div>
            <button type="button" class="btn btn-info mr-2" onclick="autoFetchTmdb()">
                <i class="fas fa-cloud-download-alt"></i> Auto-Fetch
            </button>
            <button type="button" class="btn btn-secondary mr-2" onclick="skipCurrentField()">
                <i class="fas fa-forward"></i> Skip
            </button>
            <button type="button" class="btn btn-success" onclick="saveAndNext()">
                <i class="fas fa-check"></i> Next
            </button>
        </div>
    `;
}

/**
 * Render the current backfill card (Restored Structure)
 */
function renderBackfillCard() {
  // Re-create the standard modal body structure if it was replaced by config screen
  const bodyEl = document.querySelector("#backfillModal .modal-body");
  if (!document.getElementById("backfillInputContainer")) {
    bodyEl.innerHTML = `
            <div class="mb-3">
                <div class="d-flex justify-content-between align-items-center mb-1">
                    <small class="text-muted">Progress</small>
                    <span id="backfillProgress" class="badge badge-primary">0 / 0</span>
                </div>
                <div class="progress" style="height: 6px;">
                    <div id="backfillProgressBar" class="progress-bar" role="progressbar" style="width: 0%"></div>
                </div>
            </div>
            <div class="card mb-3">
                <div class="card-body text-center">
                    <h4 id="backfillEntryName" class="mb-1">Loading...</h4>
                    <p id="backfillEntryMeta" class="text-muted small mb-0">Category · Year</p>
                </div>
            </div>
            <div class="mb-3">
                <label id="backfillFieldLabel" class="font-weight-bold h5 mb-3 d-block text-center">Field Name</label>
                <div id="backfillInputContainer"></div>
                <small id="backfillHelperText" class="form-text text-muted mt-2" style="display:none;"></small>
            </div>
        `;
  }

  // Logic continues...
  if (currentBackfillIndex >= backfillQueue.length) {
    showBackfillComplete();
    return;
  }

  const current = backfillQueue[currentBackfillIndex];
  const entry = movieData.find((e) => e.id === current.entryId);
  if (!entry) {
    skipCurrentField();
    return;
  }

  // Update progress
  document.getElementById("backfillProgress").textContent =
    `${currentBackfillIndex + 1} / ${backfillQueue.length}`;
  document.getElementById("backfillProgressBar").style.width =
    `${((currentBackfillIndex + 1) / backfillQueue.length) * 100}%`;

  // Update entry info
  document.getElementById("backfillEntryName").textContent = current.entryName;
  const displayYear = entry.Year || "";
  document.getElementById("backfillEntryMeta").textContent =
    `${current.entryCategory}${displayYear ? " · " + displayYear : ""}`;

  // Update field label
  document.getElementById("backfillFieldLabel").textContent =
    current.fieldLabel;

  // Render input based on type
  const inputContainer = document.getElementById("backfillInputContainer");
  inputContainer.innerHTML = renderFieldInput(current.fieldConfig, entry);

  // Initialize genre tags if needed
  if (current.fieldConfig.inputType === "multi-genre") {
    let rawGenres = entry.Genre;
    if (typeof rawGenres === "string") {
      rawGenres = rawGenres
        .split(",")
        .map((g) => g.trim())
        .filter(Boolean);
    } else if (!Array.isArray(rawGenres)) {
      rawGenres = [];
    }
    window.backfillSelectedGenres = [...rawGenres];
    renderGenreTags(
      "backfillGenreContainer",
      window.backfillSelectedGenres,
      "backfillGenreInput",
    );

    // Wire up specific events for the backfill genre input
    const genreInput = document.getElementById("backfillGenreInput");
    if (genreInput) {
      genreInput.addEventListener("input", () =>
        filterGenreDropdown(
          "backfillGenreContainer",
          window.backfillSelectedGenres,
          "backfillGenreInput",
          "backfillGenreItems",
        ),
      );
      genreInput.addEventListener("focus", () => {
        filterGenreDropdown(
          "backfillGenreContainer",
          window.backfillSelectedGenres,
          "backfillGenreInput",
          "backfillGenreItems",
        );
        const dropdown = document.getElementById("backfillGenreItems");
        if (dropdown) dropdown.style.display = "block";
      });
      // Keydown handling is slightly custom due to needing to add to specific list
      genreInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          const val = genreInput.value.trim();
          if (val) {
            addGenre(
              val,
              "backfillGenreContainer",
              window.backfillSelectedGenres,
              "backfillGenreInput",
            );
            // Update hidden input used by saveAndNext
            document.getElementById("backfillInput").value = JSON.stringify(
              window.backfillSelectedGenres,
            );
          }
        } else if (e.key === "Backspace" && genreInput.value === "") {
          if (window.backfillSelectedGenres.length > 0) {
            const lastGenre =
              window.backfillSelectedGenres[
                window.backfillSelectedGenres.length - 1
              ];
            removeGenre(
              lastGenre,
              "backfillGenreContainer",
              window.backfillSelectedGenres,
              "backfillGenreInput",
            );
            // Update hidden input
            document.getElementById("backfillInput").value = JSON.stringify(
              window.backfillSelectedGenres,
            );
          }
        }
      });

      // Close dropdown when clicking outside (specific to backfill modal context if needed, though global listener might handle it)
      document.addEventListener("click", (e) => {
        const dropdown = document.getElementById("backfillGenreItems");
        const container = document.getElementById("backfillGenreContainer");
        if (
          dropdown &&
          container &&
          !container.contains(e.target) &&
          !dropdown.contains(e.target)
        ) {
          dropdown.style.display = "none";
        }
      });
    }
  }

  // Show/hide helper text
  const helperTextEl = document.getElementById("backfillHelperText");
  if (current.fieldConfig.helperText) {
    helperTextEl.textContent =
      typeof current.fieldConfig.helperText === "function"
        ? current.fieldConfig.helperText(entry)
        : current.fieldConfig.helperText;
    helperTextEl.style.display = "block";
  } else {
    helperTextEl.style.display = "none";
  }

  // Update Google button
  updateGoogleButton(current);

  // Focus input
  setTimeout(() => {
    const input = inputContainer.querySelector("input, select, textarea");
    if (input) input.focus();
  }, 100);
}

/**
 * Check if a field is missing
 */
function isFieldMissing(entry, fieldKey) {
  const value = entry[fieldKey];

  // Handle special cases for different field types
  if (fieldKey === "runtime") {
    if (!value) return true;
    if (entry.Category === "Series") {
      // For series, runtime is an object - check if episode_run_time exists
      return !value.episode_run_time;
    }
    return false;
  }

  if (fieldKey === "Genre") {
    return !value || (Array.isArray(value) && value.length === 0);
  }

  if (fieldKey === "Country") {
    return !value || value.trim().length === 0;
  }

  if (fieldKey === "Year") {
    // Year can be a string or number, check both
    return !value || value === "" || value === 0;
  }

  if (
    fieldKey === "seasonsCompleted" ||
    fieldKey === "currentSeasonEpisodesWatched"
  ) {
    // These are numbers, but 0 is valid - only missing if undefined/null
    return value === undefined || value === null || value === "";
  }

  if (fieldKey === "director_info") {
    // Director info is an object
    return !value || !value.name;
  }

  // Default: check for null, undefined, or empty string
  return !value || (typeof value === "string" && value.trim().length === 0);
}

/**
 * Render input field based on type
 */
function renderFieldInput(fieldConfig, entry) {
  const { inputType, placeholder, min, max, unit, options } = fieldConfig;

  switch (inputType) {
    case "number":
      return `
                <div class="input-group">
                    <input 
                        type="number" 
                        class="form-control form-control-lg" 
                        id="backfillInput" 
                        placeholder="${placeholder || ""}"
                        ${min ? `min="${min}"` : ""}
                        ${max ? `max="${max}"` : ""}
                    >
                    ${unit ? `<div class="input-group-append"><span class="input-group-text">${unit}</span></div>` : ""}
                </div>
            `;

    case "text":
      return `
                <input 
                    type="text" 
                    class="form-control form-control-lg" 
                    id="backfillInput" 
                    placeholder="${placeholder || ""}"
                    autocomplete="off"
                >
            `;

    case "date":
      return `
                <input 
                    type="date" 
                    class="form-control form-control-lg" 
                    id="backfillInput"
                >
            `;

    case "select":
      return `
                <select class="form-control form-control-lg" id="backfillInput">
                    <option value="">-- Select --</option>
                    ${options.map((opt) => `<option value="${opt}">${opt}</option>`).join("")}
                </select>
            `;

    case "multi-genre":
      return `
                <div id="backfillGenreContainer" class="genre-backfill-container" tabindex="0">
                    <input 
                        id="backfillGenreInput" 
                        type="text" 
                        placeholder="Click to add genres..." 
                        autocomplete="off"
                    >
                </div>
                <!-- Wrapper for positioning (Relative) -->
                <div id="backfillGenreDropdown">
                    <!-- Items List (Absolute) populated by genre.js -->
                    <div id="backfillGenreItems" class="list-group mt-1"></div>
                </div>
                <input type="hidden" id="backfillInput">
            `;

    default:
      return `<input type="text" class="form-control form-control-lg" id="backfillInput">`;
  }
}

/**
 * Update Google search button
 */
function updateGoogleButton(current) {
  const googleBtn = document.getElementById("backfillGoogleBtn");
  const query = `${current.entryName} ${current.fieldLabel}`;
  googleBtn.onclick = () => {
    window.open(
      `https://www.google.com/search?q=${encodeURIComponent(query)}`,
      "_blank",
    );
  };
}

/**
 * Save current field and move to next
 */
async function saveAndNext() {
  const current = backfillQueue[currentBackfillIndex];
  const entry = movieData.find((e) => e.id === current.entryId);
  if (!entry) {
    skipCurrentField();
    return;
  }

  // Get value based on input type
  let value = null;
  if (current.fieldConfig.inputType === "multi-genre") {
    // Genre is handled separately
    value = window.backfillSelectedGenres || [];
  } else {
    const inputEl = document.getElementById("backfillInput");
    value = inputEl ? inputEl.value.trim() : "";
  }

  // Validate
  if (!value || (Array.isArray(value) && value.length === 0)) {
    showToast("Empty Field", "Please enter a value or click Skip.", "warning");
    return;
  }

  // Save value
  try {
    const entryIndex = movieData.findIndex((e) => e.id === entry.id);
    if (entryIndex === -1) {
      skipCurrentField();
      return;
    }

    // Apply transformations
    const finalValue = transformFieldValue(
      current.fieldKey,
      value,
      current.fieldConfig,
      entry,
    );

    // Update entry
    movieData[entryIndex][current.fieldKey] = finalValue;
    movieData[entryIndex].lastModifiedDate = new Date().toISOString();
    if (movieData[entryIndex]._sync_state !== "new") {
      movieData[entryIndex]._sync_state = "edited";
    }

    // Track modification for custom sync
    if (typeof window.trackModification === "function") {
      window.trackModification(entry.id);
    }

    backfillStats.completed++;

    // Move to next
    currentBackfillIndex++;
    renderBackfillCard();
  } catch (error) {
    console.error("Error saving backfill data:", error);
    showToast("Save Error", error.message, "error");
  }
}

/**
 * Transform field value before saving
 */
function transformFieldValue(fieldKey, value, fieldConfig, entry) {
  switch (fieldKey) {
    case "Country":
      // Normalize country codes
      return normalizeCountryCode(value);

    case "runtime":
      // For series, save as object
      if (entry.Category === "Series") {
        return {
          seasons: entry.runtime?.seasons || null,
          episodes: entry.runtime?.episodes || null,
          episode_run_time: parseInt(value),
        };
      }
      return parseInt(value);

    case "Year":
    case "seasonsCompleted":
    case "currentSeasonEpisodesWatched":
      return parseInt(value);

    case "director_info":
      // Save as TMDB format
      if (fieldConfig.saveFormat === "tmdb-json") {
        return {
          id: null, // We don't have ID from manual input
          name: value,
          profile_path: null,
          job: "Director",
        };
      }
      return value;

    case "Genre":
      // Already an array
      return value;

    default:
      return value;
  }
}

/**
 * Normalize country code (IN, India → IN)
 */
function normalizeCountryCode(input) {
  const trimmed = input.trim().toUpperCase();

  // Check if it's already a 2-letter code
  if (trimmed.length === 2) return trimmed;

  // Check against country name map
  if (typeof countryCodeToNameMap !== "undefined") {
    for (const [code, name] of Object.entries(countryCodeToNameMap)) {
      if (
        name.toUpperCase() === trimmed ||
        name.toUpperCase().startsWith(trimmed)
      ) {
        return code;
      }
    }
  }

  // Fallback: return as-is
  return trimmed.substring(0, 2);
}

/**
 * Skip current field
 */
function skipCurrentField() {
  backfillStats.skipped++;
  currentBackfillIndex++;
  renderBackfillCard();
}

// Make functions globally accessible for inline onclick handlers
window.openBackfillModal = openBackfillModal;
window.saveAndNext = saveAndNext;
window.skipCurrentField = skipCurrentField;
window.autoFetchTmdb = autoFetchTmdb;

/**
 * Auto-fetch from TMDB for current entry
 */
async function autoFetchTmdb() {
  const current = backfillQueue[currentBackfillIndex];
  const entry = movieData.find((e) => e.id === current.entryId);

  if (!entry || !entry.tmdbId) {
    showToast(
      "No TMDB ID",
      "This entry doesn't have a TMDB ID. Cannot auto-fetch.",
      "warning",
    );
    return;
  }

  showLoading("Fetching from TMDB...");

  try {
    // Determine media type
    const mediaType =
      entry.tmdbMediaType || (entry.Category === "Series" ? "tv" : "movie");

    // Fetch details
    const detailData = await callTmdbApiDirect(
      `/${mediaType}/${entry.tmdbId}`,
      { append_to_response: "credits,keywords,external_ids" },
    );

    if (!detailData) {
      throw new Error("No data received from TMDB");
    }

    // Extract the specific field we need
    const value = extractFieldFromTmdb(current.fieldKey, detailData, mediaType);

    if (!value) {
      showToast(
        "Not Available",
        `${current.fieldLabel} not found in TMDB data.`,
        "info",
      );
      hideLoading();
      return;
    }

    // Populate input
    populateInputWithValue(current.fieldConfig, value);

    showToast(
      "Fetched!",
      `${current.fieldLabel} loaded from TMDB.`,
      "success",
      2000,
    );
    hideLoading();
  } catch (error) {
    console.error("Auto-fetch error:", error);
    showToast("Fetch Error", error.message, "error");
    hideLoading();
  }
}

/**
 * Extract specific field from TMDB data
 */
function extractFieldFromTmdb(fieldKey, detailData, mediaType) {
  switch (fieldKey) {
    case "Year":
      const dateStr =
        mediaType === "movie"
          ? detailData.release_date
          : detailData.first_air_date;
      return dateStr ? new Date(dateStr).getFullYear() : null;

    case "Country":
      if (
        detailData.production_countries &&
        detailData.production_countries.length > 0
      ) {
        return detailData.production_countries[0].iso_3166_1;
      }
      return null;

    case "Language":
      if (detailData.original_language) {
        const langObj = (detailData.spoken_languages || []).find(
          (l) => l.iso_639_1 === detailData.original_language,
        );
        return langObj
          ? langObj.english_name || langObj.name
          : detailData.original_language.toUpperCase();
      }
      return null;

    case "runtime":
      if (mediaType === "movie") {
        return detailData.runtime || null;
      } else {
        return detailData.episode_run_time?.[0] || null;
      }

    case "Genre":
      return detailData.genres ? detailData.genres.map((g) => g.name) : [];

    case "tmdb_release_date":
      return mediaType === "movie"
        ? detailData.release_date
        : detailData.first_air_date;

    case "director_info":
      if (detailData.credits?.crew) {
        const director = detailData.credits.crew.find(
          (c) => c.job === "Director",
        );
        return director ? director.name : null;
      }
      return null;

    case "imdb_id":
      return detailData.external_ids?.imdb_id || null;

    default:
      return null;
  }
}

/**
 * Populate input with fetched value
 */
function populateInputWithValue(fieldConfig, value) {
  if (fieldConfig.inputType === "multi-genre" && Array.isArray(value)) {
    // Handle genre specially
    window.backfillSelectedGenres = value;
    renderGenreTags(
      "backfillGenreContainer",
      window.backfillSelectedGenres,
      "backfillGenreInput",
    );
    document.getElementById("backfillInput").value = JSON.stringify(
      window.backfillSelectedGenres,
    );
    return;
  }

  const inputEl = document.getElementById("backfillInput");
  if (inputEl) {
    inputEl.value = value;
  }
}

/**
 * Show completion screen
 */
function showBackfillComplete() {
  const modal = document.getElementById("backfillModal");
  if (!modal) return;

  const bodyEl = modal.querySelector(".modal-body");
  bodyEl.innerHTML = `
        <div class="text-center py-5">
            <i class="fas fa-check-circle text-success" style="font-size: 4rem;"></i>
            <h4 class="mt-4">Backfill Complete!</h4>
            <div class="mt-4">
                <p class="mb-2"><strong>Total Fields:</strong> ${backfillStats.total}</p>
                <p class="mb-2 text-success"><strong>Completed:</strong> ${backfillStats.completed}</p>
                <p class="mb-2 text-muted"><strong>Skipped:</strong> ${backfillStats.skipped}</p>
            </div>
            <button class="btn btn-primary mt-4" data-dismiss="modal">Close</button>
        </div>
    `;

  // Save to DB
  saveToIndexedDB().then(() => {
    console.log("Backfill data saved to IndexedDB");
    if (typeof renderMovieCards === "function") renderMovieCards();
  });
}

/**
 * Genre backfill helpers
 */
window.backfillSelectedGenres = [];

console.log("✅ Backfill UI loaded!");
