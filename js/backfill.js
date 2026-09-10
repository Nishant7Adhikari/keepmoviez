/* backfill.js */

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
        ? "Enter average episode runtime in minutes"
        : "Enter total runtime in minutes",
  },
  {
    key: "episodes_per_season",
    label: "Episodes Per Season",
    inputType: "season-episodes",
    priority: 9,
    onlyFor: ["Series"],
    helperText:
      'Tip: Use "Auto-Fetch" to load season counts from TMDB instantly, or use Fast-Fill presets/paste.',
  },
  {
    key: "currentSeason",
    label: "Current Season",
    inputType: "number",
    placeholder: "e.g., 1, 2...",
    min: 1,
    priority: 9,
    onlyFor: ["Series"],
    statusFilter: ["Continue"],
  },
  {
    key: "currentEpisode",
    label: "Current Episode",
    inputType: "number",
    placeholder: "e.g., 5",
    min: 0,
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
    options: ["To Watch", "Watched", "Continue", "Unwatchable"],
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
    label: "Director(s) / Creator(s)",
    inputType: "director-chips",
    priority: 4,
    saveFormat: "tmdb-json",
    helperText:
      '💡 Tip: Supports multiple directors/creators. "Auto-Fetch" pulls photos and names from TMDB in 1 click!',
  },
  {
    key: "Description",
    label: "Description / Overview",
    inputType: "textarea",
    placeholder: "Enter plot overview or synopsis...",
    priority: 3,
  },
  {
    key: "Poster URL",
    label: "Poster URL",
    inputType: "poster-preview",
    placeholder: "https://...",
    priority: 3,
  },
  {
    key: "imdb_id",
    label: "IMDb ID",
    inputType: "text",
    placeholder: "e.g., tt0468569",
    priority: 2,
  },
];

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

  window.isModalSyncHold = true;
  window.backfillSessionDirtyCount = 0;

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
            <div class="batch-field-unit mb-2">
                <div class="d-flex align-items-center justify-content-between">
                    <label class="batch-checkbox-wrap m-0 mr-3" for="check_${item.key}" title="Include ${item.label}">
                        <input type="checkbox" class="batch-native-checkbox backfill-field-checkbox" id="check_${item.key}" value="${item.key}" checked>
                        <span class="batch-custom-checkbox"></span>
                    </label>
                    <label for="check_${item.key}" class="m-0 flex-grow-1 batch-field-title" style="cursor: pointer;">${item.label}</label>
                    <span class="badge badge-success badge-pill">${item.count} missing</span>
                </div>
            </div>
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
    const hiddenGenreInput = document.getElementById("backfillInput");
    if (hiddenGenreInput) {
      hiddenGenreInput.value = JSON.stringify(window.backfillSelectedGenres);
    }

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
        if (dropdown) dropdown.classList.add("show");
      });
      // Keydown handling is slightly custom due to needing to add to specific list
      genreInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          const val = genreInput.value.trim();
          const match = UNIQUE_ALL_GENRES.find(
            (g) => g.toLowerCase() === val.toLowerCase(),
          );
          if (match) {
            addGenre(
              match,
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
          dropdown.classList.remove("show");
        }
      });
    }
  }

  // Initialize season-episodes breakdown
  if (current.fieldConfig.inputType === "season-episodes") {
    const existingCounts =
      entry.runtime &&
      Array.isArray(entry.runtime.episodes_per_season) &&
      entry.runtime.episodes_per_season.length > 0
        ? entry.runtime.episodes_per_season
        : Array.isArray(entry.episodesPerSeason) &&
            entry.episodesPerSeason.length > 0
          ? entry.episodesPerSeason
          : Array.isArray(entry.episodes_per_season) &&
              entry.episodes_per_season.length > 0
            ? entry.episodes_per_season
            : [];
    const sCount =
      entry.runtime?.seasons ||
      (existingCounts.length > 0
        ? existingCounts.length
        : parseInt(entry.currentSeason, 10) || 1);
    if (typeof window.renderSeasonBreakdownCards === "function") {
      window.renderSeasonBreakdownCards(
        sCount,
        existingCounts,
        "backfillSeasonBreakdownContainer",
        "backfillCalcTotalEpsBadge",
      );
    }
    const hiddenInput = document.getElementById("backfillInput");
    if (
      hiddenInput &&
      typeof window.getSeasonEpisodesCountsFromUI === "function"
    ) {
      hiddenInput.value = JSON.stringify(
        window.getSeasonEpisodesCountsFromUI(
          "backfillSeasonBreakdownContainer",
        ),
      );
    }
  }

  // Initialize director chips
  if (current.fieldConfig.inputType === "director-chips") {
    window.backfillSelectedDirectors = [];
    if (entry.director_info) {
      if (Array.isArray(entry.director_info)) {
        window.backfillSelectedDirectors = [...entry.director_info];
      } else if (
        typeof entry.director_info === "object" &&
        entry.director_info.name
      ) {
        if (Array.isArray(entry.director_info.directors)) {
          window.backfillSelectedDirectors = [
            ...entry.director_info.directors,
          ];
        } else {
          window.backfillSelectedDirectors = [entry.director_info];
        }
      } else if (
        typeof entry.director_info === "string" &&
        entry.director_info.trim()
      ) {
        window.backfillSelectedDirectors = entry.director_info
          .split(",")
          .map((n) => ({
            id: null,
            name: n.trim(),
            profile_path: null,
            job: "Director",
          }));
      }
    }
    renderBackfillDirectorChips();
  }

  // Initialize poster preview
  if (current.fieldConfig.inputType === "poster-preview") {
    const val = entry["Poster URL"] || "";
    const inputEl = document.getElementById("backfillInput");
    if (inputEl) inputEl.value = val;
    const img = document.getElementById("backfillPosterImg");
    const wrap = document.getElementById("backfillPosterImgWrap");
    if (img && wrap && val) {
      img.src = val;
      wrap.style.display = "block";
    }
  }

  // Initialize textarea
  if (current.fieldConfig.inputType === "textarea") {
    const val = entry[current.fieldKey] || "";
    const inputEl = document.getElementById("backfillInput");
    if (inputEl && val) inputEl.value = val;
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
  if (fieldKey === "episodes_per_season") {
    if (entry.Category !== "Series") return false;
    const fromRuntime =
      entry.runtime &&
      typeof entry.runtime === "object" &&
      Array.isArray(entry.runtime.episodes_per_season) &&
      entry.runtime.episodes_per_season.length > 0;
    const fromTopLevel =
      (Array.isArray(entry.episodesPerSeason) &&
        entry.episodesPerSeason.length > 0) ||
      (Array.isArray(entry.episodes_per_season) &&
        entry.episodes_per_season.length > 0);
    return !fromRuntime && !fromTopLevel;
  }

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
    fieldKey === "currentSeason" ||
    fieldKey === "currentEpisode" ||
    fieldKey === "seasonsCompleted" ||
    fieldKey === "currentSeasonEpisodesWatched"
  ) {
    // These are numbers, but 0 is valid for episode - only missing if undefined/null
    return value === undefined || value === null || value === "";
  }

  if (fieldKey === "director_info") {
    if (!value) return true;
    if (typeof value === "string") return value.trim().length === 0;
    if (Array.isArray(value)) return value.length === 0;
    return !value.name || String(value.name).trim().length === 0;
  }

  if (fieldKey === "Description") {
    return !value || String(value).trim().length === 0;
  }

  if (fieldKey === "Poster URL") {
    return !value || String(value).trim().length === 0;
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
                    <option value="">Select</option>
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

    case "season-episodes":
      return `
        <div id="backfillSeasonBreakdownWrapper">
          <div class="d-flex justify-content-between align-items-center mb-2">
            <span class="small font-weight-bold text-muted"><i class="fas fa-list-ol text-primary mr-1"></i> Per-Season Episodes</span>
            <span id="backfillCalcTotalEpsBadge" class="badge badge-primary font-weight-bold px-2 py-1">0 eps</span>
          </div>
          <div id="backfillSeasonBreakdownContainer" class="p-2 rounded border bg-light" style="max-height: 240px; overflow-y: auto;">
          </div>
          <input type="hidden" id="backfillInput">
        </div>
      `;

    case "director-chips":
      return `
        <div class="mb-2">
          <div id="backfillDirectorChips" class="director-chips-container" tabindex="0">
            <input type="text" id="backfillDirectorInput" class="director-chip-input" placeholder="Type director name and press Enter...">
          </div>
          <small class="form-text text-muted mt-1">Type name &amp; press Enter to add. Use "Auto-Fetch" for 1-click TMDB lookup.</small>
          <input type="hidden" id="backfillInput">
        </div>
      `;

    case "textarea":
      return `
        <textarea 
          class="form-control form-control-lg" 
          id="backfillInput" 
          rows="4" 
          placeholder="${placeholder || ""}"
        ></textarea>
      `;

    case "poster-preview":
      return `
        <div>
          <input 
            type="text" 
            class="form-control form-control-lg mb-2" 
            id="backfillInput" 
            placeholder="${placeholder || "https://..."}"
            autocomplete="off"
            oninput="const img = document.getElementById('backfillPosterImg'); const wrap = document.getElementById('backfillPosterImgWrap'); if (img && wrap) { img.src = this.value; wrap.style.display = this.value ? 'block' : 'none'; }"
          >
          <div id="backfillPosterImgWrap" class="text-center p-2 border rounded bg-light" style="display: none;">
            <img id="backfillPosterImg" src="" alt="Poster preview" style="max-height: 180px; max-width: 100%; border-radius: 6px;" onerror="this.parentElement.style.display='none';">
          </div>
        </div>
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
    value = window.backfillSelectedGenres || [];
  } else if (current.fieldConfig.inputType === "season-episodes") {
    value =
      typeof window.getSeasonEpisodesCountsFromUI === "function"
        ? window.getSeasonEpisodesCountsFromUI(
            "backfillSeasonBreakdownContainer",
          )
        : [];
  } else if (current.fieldConfig.inputType === "director-chips") {
    value = window.backfillSelectedDirectors || [];
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

    // Special handling for episodes_per_season
    if (current.fieldKey === "episodes_per_season") {
      movieData[entryIndex].episodesPerSeason = finalValue;
      movieData[entryIndex].episodes_per_season = finalValue;
      const existingRuntime =
        typeof movieData[entryIndex].runtime === "object" &&
        movieData[entryIndex].runtime !== null
          ? { ...movieData[entryIndex].runtime }
          : {};
      existingRuntime.episodes_per_season = finalValue;
      if (!existingRuntime.seasons && finalValue.length > 0) {
        existingRuntime.seasons = finalValue.length;
      }
      if (!existingRuntime.episodes && finalValue.length > 0) {
        existingRuntime.episodes = finalValue.reduce((a, b) => a + b, 0);
      }
      movieData[entryIndex].runtime = existingRuntime;
    }

    if (current.fieldKey === "Poster URL") {
      movieData[entryIndex]["Poster URL"] = finalValue;
    }

    movieData[entryIndex].lastModifiedDate = new Date().toISOString();
    if (movieData[entryIndex]._sync_state !== "new") {
      movieData[entryIndex]._sync_state = "edited";
    }

    // Track modification for custom sync
    if (typeof window.trackModification === "function") {
      window.trackModification(entry.id);
    }

    backfillStats.completed++;
    window.backfillSessionDirtyCount =
      (window.backfillSessionDirtyCount || 0) + 1;

    // Safety ceiling: silently flush batch every 25 completed items without interrupting the wizard
    if (window.backfillSessionDirtyCount >= 25) {
      if (typeof saveToIndexedDB === "function") saveToIndexedDB();
      if (
        typeof comprehensiveSync === "function" &&
        window.currentSupabaseUser
      ) {
        console.log(
          "Backfill 25-item safety window reached: silently syncing batch...",
        );
        comprehensiveSync(true);
      }
      window.backfillSessionDirtyCount = 0;
    }

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

    case "episodes_per_season": {
      if (Array.isArray(value)) {
        return value
          .map((n) => parseInt(n, 10))
          .filter((n) => !isNaN(n) && n > 0);
      }
      if (typeof value === "string") {
        const nums = value.match(/\d+/g);
        return nums ? nums.map((n) => parseInt(n, 10)).filter((n) => n > 0) : [];
      }
      return [];
    }

    case "runtime":
      // For series, save as object
      if (entry.Category === "Series") {
        const existingRuntime =
          typeof entry.runtime === "object" && entry.runtime !== null
            ? { ...entry.runtime }
            : {};
        return {
          ...existingRuntime,
          seasons: existingRuntime.seasons || null,
          episodes: existingRuntime.episodes || null,
          episode_run_time: parseInt(value, 10),
        };
      }
      return parseInt(value, 10);

    case "Year":
    case "currentSeason":
    case "currentEpisode":
    case "seasonsCompleted":
    case "currentSeasonEpisodesWatched":
      return parseInt(value, 10);

    case "director_info": {
      if (Array.isArray(value)) {
        if (value.length === 0) return null;
        const primary = value[0];
        const allNames = value
          .map((d) => (typeof d === "object" && d ? d.name : String(d)))
          .filter(Boolean)
          .join(", ");
        return {
          id: primary.id || null,
          name: allNames || primary.name,
          profile_path: primary.profile_path || null,
          job: primary.job || "Director",
          directors: value,
        };
      }
      if (typeof value === "object" && value !== null) {
        return value;
      }
      if (typeof value === "string" && value.trim()) {
        const names = value.split(",").map((s) => s.trim()).filter(Boolean);
        if (names.length > 1) {
          const list = names.map((n) => ({
            id: null,
            name: n,
            profile_path: null,
            job: "Director",
          }));
          return {
            id: null,
            name: names.join(", "),
            profile_path: null,
            job: "Director",
            directors: list,
          };
        }
        return {
          id: null,
          name: value.trim(),
          profile_path: null,
          job: "Director",
        };
      }
      return null;
    }

    case "Genre":
      // Store in same format as add/edit flow: comma-separated string.
      return Array.isArray(value)
        ? value.map((g) => g.trim()).filter(Boolean).join(", ")
        : String(value || "")
            .split(",")
            .map((g) => g.trim())
            .filter(Boolean)
            .join(", ");

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

    case "episodes_per_season":
      if (Array.isArray(detailData.seasons)) {
        return detailData.seasons
          .filter((s) => s.season_number > 0)
          .sort((a, b) => a.season_number - b.season_number)
          .map((s) => s.episode_count || 0);
      }
      return null;

    case "director_info": {
      const directors = [];
      if (detailData.credits?.crew) {
        const crewDirs = detailData.credits.crew.filter(
          (c) => c.job === "Director",
        );
        crewDirs.forEach((d) => {
          if (d && d.name && !directors.some((x) => x.name === d.name)) {
            directors.push({
              id: d.id || null,
              name: d.name,
              profile_path: d.profile_path || null,
              job: d.job || "Director",
            });
          }
        });
      }
      if (mediaType === "tv" && Array.isArray(detailData.created_by)) {
        detailData.created_by.forEach((c) => {
          if (c && c.name && !directors.some((x) => x.name === c.name)) {
            directors.push({
              id: c.id || null,
              name: c.name,
              profile_path: c.profile_path || null,
              job: "Creator",
            });
          }
        });
      }
      return directors.length > 0 ? directors : null;
    }

    case "Description":
      return detailData.overview || null;

    case "Poster URL":
      return detailData.poster_path
        ? `https://image.tmdb.org/t/p/w500${detailData.poster_path}`
        : null;

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

  if (fieldConfig.inputType === "season-episodes" && Array.isArray(value)) {
    if (typeof window.renderSeasonBreakdownCards === "function") {
      window.renderSeasonBreakdownCards(
        value.length,
        value,
        "backfillSeasonBreakdownContainer",
        "backfillCalcTotalEpsBadge",
      );
    }
    const hiddenInput = document.getElementById("backfillInput");
    if (hiddenInput) {
      hiddenInput.value = JSON.stringify(value);
    }
    return;
  }

  if (fieldConfig.inputType === "director-chips" && Array.isArray(value)) {
    window.backfillSelectedDirectors = value;
    renderBackfillDirectorChips();
    return;
  }

  if (fieldConfig.inputType === "poster-preview") {
    const inputEl = document.getElementById("backfillInput");
    if (inputEl) {
      inputEl.value = value;
      const img = document.getElementById("backfillPosterImg");
      const wrap = document.getElementById("backfillPosterImgWrap");
      if (img && wrap) {
        img.src = value;
        wrap.style.display = value ? "block" : "none";
      }
    }
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
    if (typeof window.releaseModalSyncHoldAndFlush === "function") {
      window.releaseModalSyncHoldAndFlush();
    }
    window.backfillSessionDirtyCount = 0;
  });
}

/**
 * Genre backfill helpers
 */
window.backfillSelectedGenres = [];

/**
 * Director chips backfill helpers
 */
window.backfillSelectedDirectors = [];

function renderBackfillDirectorChips() {
  if (typeof document === "undefined") return;
  const container = document.getElementById("backfillDirectorChips");
  if (!container) return;
  const directors = window.backfillSelectedDirectors || [];

  let chipsHtml = "";
  directors.forEach((dir, idx) => {
    const avatar =
      dir && dir.profile_path
        ? dir.profile_path.startsWith("http")
          ? dir.profile_path
          : `https://image.tmdb.org/t/p/w185${dir.profile_path}`
        : null;
    const name = typeof dir === "object" && dir ? dir.name : String(dir);
    chipsHtml += `
      <span class="director-chip" data-index="${idx}">
        ${avatar ? `<img src="${typeof escapeHTML === "function" ? escapeHTML(avatar) : avatar}" alt="${typeof escapeHTML === "function" ? escapeHTML(name) : name}" onerror="this.style.display='none'">` : `<i class="fas fa-user text-muted mr-1" style="font-size: 0.75rem;"></i>`}
        <span>${typeof escapeHTML === "function" ? escapeHTML(name) : name}</span>
        <span class="chip-remove" onclick="removeBackfillDirector(${idx})" title="Remove">&times;</span>
      </span>
    `;
  });

  chipsHtml += `<input type="text" id="backfillDirectorInput" class="director-chip-input" placeholder="${directors.length === 0 ? "Type director name and press Enter..." : "+ Add another..."}">`;
  container.innerHTML = chipsHtml;

  const hiddenInput = document.getElementById("backfillInput");
  if (hiddenInput) {
    hiddenInput.value = JSON.stringify(directors);
  }

  const inputEl = document.getElementById("backfillDirectorInput");
  if (inputEl) {
    inputEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        const val = inputEl.value.trim();
        if (val) {
          window.backfillSelectedDirectors.push({
            id: null,
            name: val,
            profile_path: null,
            job: "Director",
          });
          renderBackfillDirectorChips();
          setTimeout(() => {
            const nextInput = document.getElementById(
              "backfillDirectorInput",
            );
            if (nextInput) nextInput.focus();
          }, 50);
        }
      }
    });
  }
}

function removeBackfillDirector(index) {
  if (
    window.backfillSelectedDirectors &&
    window.backfillSelectedDirectors[index]
  ) {
    window.backfillSelectedDirectors.splice(index, 1);
    renderBackfillDirectorChips();
  }
}
window.removeBackfillDirector = removeBackfillDirector;
window.renderBackfillDirectorChips = renderBackfillDirectorChips;

console.log("✅ Backfill UI loaded!");
