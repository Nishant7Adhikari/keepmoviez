/* genre.js */
// START CHUNK: Interactive Genre Input Component

/**
 * Renders genre tags in the specified container.
 * @param {string} containerId - ID of the container element (default: 'genreInputContainer')
 * @param {Array} selectedList - Array of selected genres (default: global selectedGenres)
 * @param {string} searchInputId - ID of the search input (default: 'genreSearchInput')
 */
function renderGenreTags(
  containerId = "genreInputContainer",
  selectedList = null,
  searchInputId = "genreSearchInput",
) {
  const genreInputContainer = document.getElementById(containerId);
  if (!genreInputContainer) {
    console.warn(`Genre input container '${containerId}' not found.`);
    return;
  }
  const searchInput = genreInputContainer.querySelector(`#${searchInputId}`);
  if (!searchInput) return;

  // Use provided list or fallback to global selectedGenres
  const currentList =
    selectedList ||
    (typeof selectedGenres !== "undefined" ? selectedGenres : []);

  // Clear existing tags (all children except the search input)
  Array.from(genreInputContainer.children).forEach((child) => {
    if (child !== searchInput) {
      genreInputContainer.removeChild(child);
    }
  });

  currentList.forEach((genre) => {
    const tag = document.createElement("span");
    tag.className = "genre-tag";
    tag.textContent = genre;

    const closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.className = "close";
    closeBtn.innerHTML = '<span aria-hidden="true">×</span>';
    closeBtn.setAttribute("aria-label", `Remove genre ${genre}`);
    closeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      removeGenre(genre, containerId, selectedList, searchInputId);
    });
    tag.appendChild(closeBtn);
    genreInputContainer.insertBefore(tag, searchInput);
  });

  searchInput.placeholder =
    currentList.length === 0
      ? "Click to add genres..."
      : "Search or add more...";
}

/**
 * Adds a genre to the list and re-renders.
 */
function addGenre(
  genre,
  containerId = "genreInputContainer",
  selectedList = null,
  searchInputId = "genreSearchInput",
) {
  // Determine which list to modify
  let targetList;
  if (selectedList) {
    targetList = selectedList;
  } else {
    if (typeof selectedGenres === "undefined") window.selectedGenres = [];
    targetList = window.selectedGenres;
  }

  const sanitizedGenre = genre.trim();
  if (
    sanitizedGenre &&
    typeof sanitizedGenre === "string" &&
    !targetList
      .map((g) => g.toLowerCase())
      .includes(sanitizedGenre.toLowerCase())
  ) {
    targetList.push(sanitizedGenre);
    targetList.sort();
    renderGenreTags(containerId, targetList, searchInputId);
  }
}

/**
 * Removes a genre from the list and re-renders.
 */
function removeGenre(
  genre,
  containerId = "genreInputContainer",
  selectedList = null,
  searchInputId = "genreSearchInput",
) {
  let targetList;
  if (selectedList) {
    // Method 1: Modify the array in place if it's a passed reference (tricky in JS for simple arrays if reassigned)
    // Better: We assume the caller manages the state if they pass a list, BUT for simplicity in this refactor,
    // we'll try to find the index and splice needed if it's an array reference.
    const idx = selectedList.indexOf(genre);
    if (idx > -1) selectedList.splice(idx, 1);
    targetList = selectedList;
  } else {
    if (typeof selectedGenres === "undefined") window.selectedGenres = [];
    window.selectedGenres = window.selectedGenres.filter((g) => g !== genre);
    targetList = window.selectedGenres;
  }

  renderGenreTags(containerId, targetList, searchInputId);

  // Refresh dropdown if open (Assumes items container ID follows a pattern or is passed)
  // For backward compatibility, we default to 'genreItemsContainer' or infer from containerId
  const dropdownId =
    containerId === "backfillGenreContainer"
      ? "backfillGenreItems"
      : "genreItemsContainer";
  const genreDropdownItemsEl = document.getElementById(dropdownId);

  if (
    genreDropdownItemsEl &&
    (genreDropdownItemsEl.style.display === "block" ||
      genreDropdownItemsEl.classList.contains("show"))
  ) {
    filterGenreDropdown(containerId, targetList, searchInputId, dropdownId);
  }
}

/**
 * Populates the dropdown based on filter text.
 */
function populateGenreDropdown(
  filterText = "",
  containerId = "genreInputContainer",
  selectedList = null,
  searchInputId = "genreSearchInput",
  itemsContainerId = "genreItemsContainer",
) {
  const genreItemsContainer = document.getElementById(itemsContainerId);
  if (!genreItemsContainer) return;

  genreItemsContainer.innerHTML = "";

  const currentList =
    selectedList ||
    (typeof selectedGenres !== "undefined" ? selectedGenres : []);
  const lowerFilterText = String(filterText || "")
    .toLowerCase()
    .trim();
  const availableGenres = UNIQUE_ALL_GENRES.filter(
    (genre) =>
      !currentList.includes(genre) &&
      (lowerFilterText === "" ||
        String(genre).toLowerCase().includes(lowerFilterText)),
  ).sort();

  const addHandler = (e, genreToAdd) => {
    e.preventDefault();
    e.stopPropagation(); // Prevent event bubbling
    addGenre(genreToAdd, containerId, selectedList, searchInputId);

    // Defer focus/filter to ensure DOM updates (and previous list removal) are processed
    setTimeout(() => {
      const searchInputEl = document.getElementById(searchInputId);
      if (searchInputEl) {
        searchInputEl.value = "";
        searchInputEl.focus();
      }
      filterGenreDropdown(
        containerId,
        selectedList,
        searchInputId,
        itemsContainerId,
      );
    }, 10);
  };

  if (availableGenres.length === 0 && lowerFilterText) {
    const item = document.createElement("a");
    item.href = "#";
    item.className = "list-group-item list-group-item-action py-1 text-success";
    item.innerHTML = `<i class="fas fa-plus-circle mr-2"></i> Add new genre: "${filterText}"`;
    item.addEventListener("mousedown", (e) => addHandler(e, filterText.trim()));
    genreItemsContainer.appendChild(item);
  } else {
    availableGenres.forEach((genre) => {
      const item = document.createElement("a");
      item.href = "#";
      item.className = "list-group-item list-group-item-action py-1";
      item.textContent = genre;
      item.addEventListener("mousedown", (e) => addHandler(e, genre));
      genreItemsContainer.appendChild(item);
    });
  }
}

/**
 * Triggers a filter and re-population of the genre dropdown.
 */
function filterGenreDropdown(
  containerId = "genreInputContainer",
  selectedList = null,
  searchInputId = "genreSearchInput",
  itemsContainerId = "genreItemsContainer",
) {
  const searchInputEl = document.getElementById(searchInputId);
  if (searchInputEl) {
    populateGenreDropdown(
      searchInputEl.value,
      containerId,
      selectedList,
      searchInputId,
      itemsContainerId,
    );
  } else {
    populateGenreDropdown(
      "",
      containerId,
      selectedList,
      searchInputId,
      itemsContainerId,
    );
  }
}
// END CHUNK: Interactive Genre Input Component
