/* utils.js */
// START CHUNK: Loading Indicator
function showLoading(message = " Loading...") {
    if (!loadingOverlay) loadingOverlay = document.getElementById('loadingOverlay');
    if (!loadingOverlay) {
        console.warn("Loading overlay element not found. Cannot show loading indicator.");
        return;
    }
    loadingOverlay.classList.remove('hidden');
    const loadingTextElement = loadingOverlay.querySelector('p');
    if (loadingTextElement) {
        loadingTextElement.textContent = message;
    } else {
        console.warn("Loading text element within overlay not found.");
    }
}

function hideLoading() {
    if (!loadingOverlay) loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) {
        loadingOverlay.classList.add('hidden');
    }
}
// END CHUNK: Loading Indicator

// START CHUNK: UI Enhancements and Helpers
function initializeContentScrolling() {
    const contentContainer = document.querySelector('.table-responsive');
    if (contentContainer) {
        contentContainer.addEventListener('keydown', function(e) {
            if (e.target !== contentContainer && e.target.tagName === 'INPUT') return;
            if (e.key === 'ArrowUp') {
                e.preventDefault(); this.scrollTop -= 100;
            } else if (e.key === 'ArrowDown') {
                e.preventDefault(); this.scrollTop += 100;
            }
            if (typeof resetInactivityTimer === 'function') resetInactivityTimer();
        });
    } else {
        console.warn("'.table-responsive' container not found for scroll enhancements.");
    }
}

function getCountryFullName(code) {
    if (!code || typeof code !== 'string') return code || 'N/A';
    const upperCode = code.toUpperCase().trim();
    if (countryCodeToNameMap[upperCode]) return countryCodeToNameMap[upperCode];
    for (const [mapCode, mapName] of Object.entries(countryCodeToNameMap)) {
        if (mapName.toUpperCase() === upperCode) return mapName;
    }
    return code.trim();
}

function renderStars(rating) {
    if (rating === null || rating === undefined || String(rating).trim() === "" || String(rating).toLowerCase() === "n/a") {
        return '<span class="text-muted small">N/A</span>';
    }
    let starsHtml = '<span class="star-rating">';
    const numRating = parseFloat(rating);
    if (isNaN(numRating) || numRating < 0 || numRating > 5) return '<span class="text-muted small" title="Invalid Rating Value">Invalid</span>';

    const roundedRating = Math.round(numRating * 2) / 2; // Round to nearest 0.5
    for (let i = 1; i <= 5; i++) {
        if (roundedRating >= i) starsHtml += `<i class="fas fa-star"></i>`;
        else if (roundedRating >= i - 0.5) starsHtml += `<i class="fas fa-star-half-alt"></i>`;
        else starsHtml += `<i class="far fa-star"></i>`;
    }
    starsHtml += '</span>';
    return starsHtml;
}

function getRatingTextLabel(rating) {
    if (rating === null || rating === undefined || String(rating).trim() === "" || String(rating).toLowerCase() === "n/a") return 'Not Rated';
    const numRating = parseFloat(rating);
    if (isNaN(numRating) || numRating < 0 || numRating > 5) return 'Invalid Rating';
    if (numRating === 0 && String(rating).trim() === "0") return '0 Stars'; // Handle literal "0"
    if (numRating === 0) return 'Not Rated'; // Treat 0 as Not Rated unless explicitly "0"

    const label = `${numRating % 1 === 0 ? numRating : numRating.toFixed(1)} Star${numRating !== 1 ? 's' : ''}`;
    return label;
}

function formatDuration(totalMinutes, format = 'days') {
    if (totalMinutes === null || isNaN(totalMinutes) || totalMinutes < 0) {
        return "N/A";
    }
    if (format === 'hours') {
        return `${Math.round(totalMinutes / 60).toLocaleString()} hours`;
    }
    const days = Math.floor(totalMinutes / 1440);
    const remainingMinutes = totalMinutes % 1440;
    const hours = Math.floor(remainingMinutes / 60);
    const minutes = Math.round(remainingMinutes % 60);
    let result = '';
    if (days > 0) result += `${days}d `;
    if (hours > 0) result += `${hours}h `;
    if (minutes > 0 || (days === 0 && hours === 0)) result += `${minutes}m`;
    return result.trim() || '0m';
}

function formatDays(totalDays, format = 'days') {
    if (totalDays === null || isNaN(totalDays) || totalDays < 0) {
        return "N/A";
    }
    const totalMinutes = totalDays * 24 * 60;
    return formatDuration(totalMinutes, format);
}
// END CHUNK: UI Enhancements and Helpers

// START CHUNK: Toast Notification System
function showToast(title, message, type = 'info', delayMs, doNotShowAgainKey = null, actions = []) {
    if (doNotShowAgainKey && localStorage.getItem(doNotShowAgainKey) === 'true') return;

    if (type === 'error' && (Math.random() * PRANK_ERROR_CHANCE < 1)) {
        const prankMessages = [
            "Oops! Looks like the hamsters powering the server took a coffee break.",
            "Error 404: Motivation not found. Just kidding, something broke.",
            "My apologies! A pixel decided to rebel. Try again!",
            "Uh oh! My circuits are feeling a bit shy right now. Give it another go.",
            "The digital gremlins are at it again. We're on it!",
            "Whoops! I spilled some virtual coffee. Fixing it now!"
        ];
        message = prankMessages[Math.floor(Math.random() * prankMessages.length)];
        title = "Unexpected Hiccup!";
    }

    if (typeof $ === 'undefined' || typeof $.fn.toast === 'undefined') {
        console.warn("jQuery or Bootstrap Toast component not found. Toast cannot be shown. Message:", title, message);
        alert(`${title}: ${message}`); // Fallback
        return;
    }

    const toastElement = $('#appToast');
    if (!toastElement.length) { console.warn("Toast element #appToast not found"); return; }

    if (delayMs === undefined) { // Default delays
        switch (type) {
            case 'success': delayMs = 3000; break;
            case 'error': delayMs = 6000; break;
            case 'warning': delayMs = 4500; break;
            case 'info': default: delayMs = 3500; break;
        }
    }

    // If there are actions, don't autohide unless a delay is explicitly set > 0
    let autohide = delayMs > 0;
    if (Array.isArray(actions) && actions.length > 0 && delayMs === 0) {
        autohide = false; // Don't autohide if there are buttons and no explicit delay
    }

    toastElement.find('#toastTitle').text(title || 'Notification');
    toastElement.find('#toastBody').html(message || '');
    toastElement.find('#toastActions').empty(); // Clear previous actions

    const toastHeader = toastElement.find('.toast-header');
    toastHeader.removeClass ( (index, className) => (className.match (/(^|\s)bg-\S+/g) || []).join(' ') );
    toastHeader.removeClass('text-white text-dark');

    let headerBgClass = 'bg-primary';
    let headerTextColorClass = 'text-white';

    switch (type) {
        case 'success': headerBgClass = 'bg-success'; break;
        case 'error': headerBgClass = 'bg-danger'; break;
        case 'warning': headerBgClass = 'bg-warning'; headerTextColorClass = 'text-dark'; break;
        case 'info': headerBgClass = 'bg-info'; break;
    }
    toastHeader.addClass(headerBgClass).addClass(headerTextColorClass);

    toastHeader.find('.dynamic-toast-buttons').remove();
    if (doNotShowAgainKey) {
        const dnsaContainer = $('<div class="dynamic-toast-buttons ml-2"></div>');
        const dnsaBtn = $(`<button type="button" class="btn btn-sm btn-link p-0" title="Don't show this notification again">
                              <i class="fas fa-eye-slash"></i>
                           </button>`);
        dnsaBtn.data('do-not-show-again-key', doNotShowAgainKey);
        dnsaBtn.css('color', 'inherit');
        dnsaContainer.append(dnsaBtn);
        toastHeader.children('.mr-auto').after(dnsaContainer);
    }
    
    if (Array.isArray(actions) && actions.length > 0) {
        const actionsContainer = toastElement.find('#toastActions');
        actions.forEach(action => {
            const button = $(`<button type="button" class="btn btn-sm"></button>`);
            button.addClass(action.className || 'btn-light');
            button.text(action.label);
            button.on('click', () => {
                if (typeof action.onClick === 'function') {
                    action.onClick();
                }
                toastElement.toast('hide');
            });
            actionsContainer.append(button);
        });
    }

    toastElement.toast({ delay: delayMs, autohide: autohide });
    toastElement.toast('show');
}
// END CHUNK: Toast Notification System

// START CHUNK: Core Helpers and Polyfills
function debounce(func, delay) {
    let timeout;
    return function(...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), delay);
    };
}

function generateUUID() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    // Fallback for environments where crypto.randomUUID is not available
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}
// END CHUNK: Core Helpers and Polyfills

// START CHUNK: Autocomplete Input Logic
function parseInputForAutocomplete(inputString) {
    if (typeof inputString !== 'string') return { finalized: [], current: '' };
    const parts = inputString.split(/,\s*|\s*;\s*/).map(s => s.trim()).filter(Boolean);
    if (parts.length === 0) {
        return { finalized: [], current: '' };
    }
    const lastCharIsSeparator = /[;,]\s*$/.test(inputString);
    let finalized = [];
    let current = '';
    if (lastCharIsSeparator) {
        finalized = parts;
    } else {
        current = parts.pop() || '';
        finalized = parts;
    }
    return { finalized, current };
}

function populateRelatedEntriesSuggestions() {
    if (!formFieldsGlob || !formFieldsGlob.relatedEntriesNames || !formFieldsGlob.relatedEntriesSuggestions) {
        console.warn("Related entries UI elements not found for autocomplete.");
        return;
    }

    const relatedEntriesNamesInput = formFieldsGlob.relatedEntriesNames;
    const relatedEntriesSuggestionsContainer = formFieldsGlob.relatedEntriesSuggestions;

    const inputValue = relatedEntriesNamesInput.value;
    const { finalized: currentFinalizedNames, current: currentSearchTerm } = parseInputForAutocomplete(inputValue);

    relatedEntriesSuggestionsContainer.innerHTML = '';

    if (currentSearchTerm.length < 2) {
        relatedEntriesSuggestionsContainer.style.display = 'none';
        return;
    }

    const lowerSearchTerm = currentSearchTerm.toLowerCase();
    const currentEditIdEl = document.getElementById('editEntryId');
    const currentEditId = currentEditIdEl ? currentEditIdEl.value : null;

    if (!Array.isArray(movieData)) {
        console.error("movieData is not an array, cannot populate suggestions.");
        relatedEntriesSuggestionsContainer.style.display = 'none';
        return;
    }

    const matchedMovies = movieData.filter(movie =>
        movie && movie.id && movie.Name &&
        movie.id !== currentEditId &&
        String(movie.Name).toLowerCase().includes(lowerSearchTerm) &&
        !currentFinalizedNames.some(n => String(n).toLowerCase() === String(movie.Name).toLowerCase())
    ).slice(0, 10);

    if (matchedMovies.length === 0) {
        relatedEntriesSuggestionsContainer.style.display = 'none';
        return;
    }

    matchedMovies.forEach(movie => {
        const suggestionItem = document.createElement('a');
        suggestionItem.href = '#';
        suggestionItem.className = 'list-group-item list-group-item-action autocomplete-item p-2';
        suggestionItem.textContent = movie.Name;
        suggestionItem.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const newValue = [...currentFinalizedNames, movie.Name].join(', ') + ', ';
            relatedEntriesNamesInput.value = newValue;
            relatedEntriesSuggestionsContainer.style.display = 'none';
            relatedEntriesNamesInput.focus();
            populateRelatedEntriesSuggestions();
        });
        relatedEntriesSuggestionsContainer.appendChild(suggestionItem);
    });

    relatedEntriesSuggestionsContainer.style.display = 'block';
}
// END CHUNK: Autocomplete Input Logic

// START CHUNK: Watchlist Activity Logger
const WATCHLIST_ACTIVITY_LOG_KEY = 'watchlistActivityLog_v1';
const MAX_LOG_SIZE = 200; // Keep the log from growing indefinitely

function logWatchlistActivity(type) {
    if (type !== 'added' && type !== 'completed') {
        console.warn(`Invalid watchlist activity type: ${type}`);
        return;
    }

    try {
        let log = JSON.parse(localStorage.getItem(WATCHLIST_ACTIVITY_LOG_KEY) || '[]');
        if (!Array.isArray(log)) {
            log = [];
        }

        const today = new Date().toISOString().slice(0, 10);
        log.push({ type, date: today });

        // Trim the log to prevent it from getting too large
        if (log.length > MAX_LOG_SIZE) {
            log = log.slice(log.length - MAX_LOG_SIZE);
        }

        localStorage.setItem(WATCHLIST_ACTIVITY_LOG_KEY, JSON.stringify(log));

    } catch (e) {
        console.error("Failed to log watchlist activity:", e);
    }
}
// END CHUNK: Watchlist Activity Logger```