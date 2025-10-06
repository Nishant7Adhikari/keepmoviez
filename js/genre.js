/* genre.js */
// START CHUNK: Interactive Genre Input Component
function renderGenreTags() {
    const genreInputContainer = document.getElementById('genreInputContainer');
    if (!genreInputContainer) {
        console.warn("Genre input container 'genreInputContainer' not found.");
        return;
    }
    const searchInput = genreInputContainer.querySelector('#genreSearchInput');
    if (!searchInput) return;

    // Clear existing tags (all children except the search input)
    Array.from(genreInputContainer.children).forEach(child => {
        if (child !== searchInput) {
            genreInputContainer.removeChild(child);
        }
    });

    if (!Array.isArray(selectedGenres)) selectedGenres = [];

    selectedGenres.forEach(genre => {
        const tag = document.createElement('span');
        tag.className = 'genre-tag';
        tag.textContent = genre;
        
        const closeBtn = document.createElement('button');
        closeBtn.type = 'button';
        closeBtn.className = 'close';
        closeBtn.innerHTML = '<span aria-hidden="true">×</span>';
        closeBtn.setAttribute('aria-label', `Remove genre ${genre}`);
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            removeGenre(genre);
        });
        tag.appendChild(closeBtn);
        genreInputContainer.insertBefore(tag, searchInput);
    });

    searchInput.placeholder = selectedGenres.length === 0 ? "Click to add genres..." : "Search or add more...";
}


/**
 * Adds a genre to the selected genres list and re-renders the tags.
 */
function addGenre(genre) {
    if (!Array.isArray(selectedGenres)) selectedGenres = [];
    const sanitizedGenre = genre.trim();
    if (sanitizedGenre && typeof sanitizedGenre === 'string' && !selectedGenres.map(g => g.toLowerCase()).includes(sanitizedGenre.toLowerCase())) {
        selectedGenres.push(sanitizedGenre);
        selectedGenres.sort();
        renderGenreTags();
    }
}

/**
 * Removes a genre from the selected genres list and re-renders the tags.
 */
function removeGenre(genre) {
    if (!Array.isArray(selectedGenres)) selectedGenres = [];
    selectedGenres = selectedGenres.filter(g => g !== genre);
    renderGenreTags();

    const genreDropdownItemsEl = document.getElementById('genreItemsContainer');
    if (genreDropdownItemsEl && genreDropdownItemsEl.classList.contains('show')) {
        filterGenreDropdown();
    }
}

/**
 * Populates or re-populates the genre dropdown based on a filter text.
 */
function populateGenreDropdown(filterText = "") {
    const genreItemsContainer = document.getElementById('genreItemsContainer');
    if (!genreItemsContainer) {
        console.warn("Genre items container 'genreItemsContainer' not found for dropdown.");
        return;
    }
    genreItemsContainer.innerHTML = '';

    const lowerFilterText = String(filterText || "").toLowerCase().trim();
    const availableGenres = UNIQUE_ALL_GENRES.filter(genre =>
        !selectedGenres.includes(genre) &&
        (lowerFilterText === "" || String(genre).toLowerCase().includes(lowerFilterText))
    ).sort();

    if (availableGenres.length === 0 && lowerFilterText) {
        const item = document.createElement('a');
        item.href = '#';
        item.className = 'list-group-item list-group-item-action py-1 text-success';
        item.innerHTML = `<i class="fas fa-plus-circle mr-2"></i> Add new genre: "${filterText}"`;
        item.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const newGenre = filterText.trim();
            addGenre(newGenre);
            const searchInputEl = document.getElementById('genreSearchInput');
            if (searchInputEl) {
                searchInputEl.value = '';
                searchInputEl.focus();
            }
            filterGenreDropdown();
        });
        genreItemsContainer.appendChild(item);
    } else {
        availableGenres.forEach(genre => {
            const item = document.createElement('a');
            item.href = '#';
            item.className = 'list-group-item list-group-item-action py-1';
            item.textContent = genre;
            item.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                addGenre(genre);
                const searchInputEl = document.getElementById('genreSearchInput');
                if (searchInputEl) {
                    searchInputEl.value = '';
                    searchInputEl.focus();
                }
                filterGenreDropdown();
            });
            genreItemsContainer.appendChild(item);
        });
    }
}


/**
 * Triggers a filter and re-population of the genre dropdown.
 */
function filterGenreDropdown() {
    const searchInputEl = document.getElementById('genreSearchInput');
    if (searchInputEl) {
        populateGenreDropdown(searchInputEl.value);
    } else {
        populateGenreDropdown();
    }
}
// END CHUNK: Interactive Genre Input Component