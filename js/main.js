/* main.js */
//START CHUNK: 1: Application Entry Point
document.addEventListener('DOMContentLoaded', () => {
    // --- Initial Setup ---
    if (typeof initializeDOMElements === 'function') {
        initializeDOMElements();
    } else {
        document.body.innerHTML = '<p style="color:red; text-align:center; padding-top: 20px;">Critical Error: Application UI cannot be initialized.</p>';
        return;
    }
    showLoading("Initializing application...");

//START CHUNK: 2: Theme Setup Logic
    const menuThemeToggleBtn = document.getElementById('menuThemeToggleBtn');
    const body = document.body;
    const LIGHT_THEME = 'light-theme';
    const DARK_THEME = 'dark-theme';
    const THEME_STORAGE_KEY = 'currentTheme';
    const savedTheme = localStorage.getItem(THEME_STORAGE_KEY) || LIGHT_THEME;
    body.classList.add(savedTheme);
    if (menuThemeToggleBtn) {
        const themeIcon = menuThemeToggleBtn.querySelector('i');
        if (themeIcon) {
            themeIcon.className = `fas ${savedTheme === DARK_THEME ? 'fa-moon' : 'fa-sun'} mr-2`;
        }
    }
//END CHUNK: 2: Theme Setup Logic

//START CHUNK: 3: Off-Canvas Menu Logic
    const appMenu = document.getElementById('appMenu');
    const appMenuBackdrop = document.getElementById('appMenuBackdrop');
    const navbarToggler = document.querySelector('.navbar-toggler[data-target="#appMenu"]');
    const menuCloseButton = appMenu ? appMenu.querySelector('.offcanvas-header .close') : null;

    const openMenu = () => {
        if (!appMenu || !appMenuBackdrop) return;
        appMenu.classList.add('show');
        appMenuBackdrop.classList.add('show');
        document.body.style.overflow = 'hidden';
        document.getElementById('menuLoggedInUserEmail').textContent = currentSupabaseUser?.email || 'Not Logged In';
        const isOnline = navigator.onLine;
        const onlineIndicator = document.getElementById('menuOnlineStatusIndicator');
        onlineIndicator.textContent = isOnline ? 'Online' : 'Offline';
        onlineIndicator.className = `badge badge-pill ${isOnline ? 'badge-success' : 'badge-danger'}`;
    };
    const closeMenu = () => {
        if (!appMenu || !appMenuBackdrop) return;
        appMenu.classList.remove('show');
        appMenuBackdrop.classList.remove('show');
        document.body.style.overflow = '';
    };

    if (navbarToggler) navbarToggler.addEventListener('click', (e) => { e.stopPropagation(); openMenu(); });
    if (menuCloseButton) menuCloseButton.addEventListener('click', closeMenu);
    if (appMenuBackdrop) appMenuBackdrop.addEventListener('click', closeMenu);
    if (appMenu) appMenu.querySelectorAll('[data-dismiss-menu="true"]').forEach(item => item.addEventListener('click', closeMenu));
// END CHUNK: 3: Off-Canvas Menu Logic 

//START CHUNK: 4: UI Event Listeners (Vanilla)
if (menuThemeToggleBtn) {
                menuThemeToggleBtn.addEventListener('click', () => {
                    const isDark = body.classList.contains(DARK_THEME);
                    const targetTheme = isDark ? LIGHT_THEME : DARK_THEME;
                    
                    body.classList.remove(isDark ? DARK_THEME : LIGHT_THEME);
                    body.classList.add(targetTheme);

                    if (window.themeTransitionOverlay) {
                        themeTransitionOverlay.classList.add('active');
                        setTimeout(() => {
                            localStorage.setItem(THEME_STORAGE_KEY, targetTheme);
                            const themeIcon = menuThemeToggleBtn.querySelector('i');
                            if (themeIcon) themeIcon.className = `fas ${targetTheme === DARK_THEME ? 'fa-moon' : 'fa-sun'} mr-2`;
                        }, 50);
                        setTimeout(() => themeTransitionOverlay.classList.remove('active'), 550);
                    } else {
                         localStorage.setItem(THEME_STORAGE_KEY, targetTheme);
                         const themeIcon = menuThemeToggleBtn.querySelector('i');
                         if (themeIcon) themeIcon.className = `fas ${targetTheme === DARK_THEME ? 'fa-moon' : 'fa-sun'} mr-2`;
                    }
                    closeMenu();
                });
            }

            document.getElementById('menuCsvFileUploader')?.addEventListener('change', async (e) => {
                closeMenu(); showLoading("Processing file...");
                try { await handleFileUpload(e); }
                catch (error) { showToast("Upload Error", `Error: ${error.message}`, "error"); }
                finally { hideLoading(); }
            });

            // Forms - Action Button Listeners (Direct Click)
            document.getElementById('quickSaveBtn')?.addEventListener('click', (e) => window.handleFormSubmit(e, 'quickSave'));
            document.getElementById('saveAndAddAnotherBtn')?.addEventListener('click', (e) => window.handleFormSubmit(e, 'saveAndAddAnother'));
            document.getElementById('saveAndEditBtn')?.addEventListener('click', (e) => window.handleFormSubmit(e, 'saveAndEdit'));
            
            document.getElementById('updateEntryBtn')?.addEventListener('click', (e) => window.handleFormSubmit(e, 'quickSave')); // Edit mode also uses quickSave logic (just save and close)
            document.getElementById('batchEditForm')?.addEventListener('submit', window.handleBatchEditFormSubmit);
            document.getElementById('quickUpdateForm')?.addEventListener('submit', window.handleQuickUpdateSave);


            // Navbar Search
            document.getElementById('navbarSearchForm')?.addEventListener('submit', (event) => {
                event.preventDefault();
                document.getElementById('filterInputNavbar')?.blur();
            });
            const filterInputNavbar = document.getElementById('filterInputNavbar');
            const clearSearchBtn = document.getElementById('clearSearchBtn');
            if (filterInputNavbar) {
                filterInputNavbar.addEventListener('input', debounce(e => {
                    filterQuery = e.target.value;
                    renderMovieCards();
                    if (clearSearchBtn) clearSearchBtn.style.display = filterQuery ? 'block' : 'none';
                }, 250));
            }
            if (clearSearchBtn) {
                clearSearchBtn.addEventListener('click', () => {
                    filterInputNavbar.value = '';
                    filterQuery = '';
                    renderMovieCards();
                    clearSearchBtn.style.display = 'none';
                });
            }

            // Card Container
            const movieCardContainer = document.getElementById('movieCardContainer');
            if (movieCardContainer) {
                movieCardContainer.addEventListener('click', window.handleCardClick);
                movieCardContainer.addEventListener('mousedown', window.handleCardMouseDown);
                movieCardContainer.addEventListener('mouseup', window.handleCardMouseUp);
                movieCardContainer.addEventListener('touchstart', window.handleCardMouseDown, {passive: true});
                movieCardContainer.addEventListener('touchend', window.handleCardMouseUp);
                movieCardContainer.addEventListener('touchmove', () => { if(longPressTimer) clearTimeout(longPressTimer); });
            }
//END CHUNK: 4: UI Event Listeners (Vanilla)

//START CHUNK: 5: Interactive Genre Picker Wiring
    function wireUpGenrePicker(containerId, inputId, itemsId, addFn, removeFn, filterFn, getSelectedFn) {
        const container = document.getElementById(containerId);
        const input = document.getElementById(inputId);
        const items = document.getElementById(itemsId);
        if (!container || !input || !items) return;
        
        container.addEventListener('click', (e) => {
            if (e.target.tagName !== 'BUTTON' && e.target.parentElement.tagName !== 'BUTTON') {
                input.focus();
            }
        });
        
        input.addEventListener('focus', () => {
            filterFn();
            items.classList.add('show');
        });
        
        input.addEventListener('input', () => {
            filterFn();
            items.classList.add('show');
        });
        
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                const val = input.value.trim();
                if (!val) return;
                const lower = val.toLowerCase();
                const match = UNIQUE_ALL_GENRES.find(g => g.toLowerCase() === lower);
                addFn(match || val);
                input.value = '';
                filterFn();
                items.classList.add('show');
            } else if (e.key === 'Backspace' && input.value === '') {
                const selected = getSelectedFn();
                if (selected && selected.length > 0) {
                    removeFn(selected[selected.length - 1]);
                    filterFn();
                }
            } else if (e.key === 'ArrowDown') {
                const first = items.querySelector('a.list-group-item');
                if (first) { e.preventDefault(); first.focus(); }
            }
        });

        items.addEventListener('keydown', (e) => {
            if (e.target.matches('a.list-group-item')) {
                if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    const next = e.target.nextElementSibling;
                    if (next && next.matches('a.list-group-item')) next.focus();
                } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    const prev = e.target.previousElementSibling;
                    if (prev && prev.matches('a.list-group-item')) prev.focus();
                    else input.focus();
                }
            }
        });

        document.addEventListener('click', (e) => {
            if (!container.contains(e.target) && !items.contains(e.target)) {
                items.classList.remove('show');
            }
        });
    }

    wireUpGenrePicker('genreInputContainer', 'genreSearchInput', 'genreItemsContainer', addGenre, removeGenre, filterGenreDropdown, () => selectedGenres);
    wireUpGenrePicker('filterGenreContainer', 'filterGenreSearchInput', 'filterGenreItemsContainer', addFilterGenre, removeFilterGenre, populateFilterGenreDropdown, () => selectedFilterGenres);
// END CHUNK: 5: Interactive Genre Picker Wiring 
    
//START CHUNK: 6: jQuery-Dependent Event Listeners
    if (typeof $ !== 'undefined') {
        $(document).on('hidden.bs.modal', '.modal', function () {
            if ($('.modal.show').length > 0) {
                $('body').addClass('modal-open');
            }
        });

        $('#addNewEntryBtn').on('click', prepareAddModal);
        $('#menuDownloadCsvBtn').on('click', () => { generateAndDownloadFile('csv'); closeMenu(); });
        $('#menuDownloadJsonBtn').on('click', () => { generateAndDownloadFile('json'); closeMenu(); });
        $('#menuEraseDataBtn').on('click', () => { prepareEraseDataModal(); closeMenu(); });

        $('#filterSortModal').on('show.bs.modal', populateFilterModalOptions);

        const setupStatsModalListener = (selector, displayFunction) => {
            $(document).on('click', `button[data-target="${selector}"]`, async () => {
                showLoading("Loading Insights...");
                try {
                    incrementLocalStorageCounter('stats_modal_opened_count');
                    await displayFunction();
                } catch (e) {
                    console.error(`Error displaying modal ${selector}:`, e);
                    showToast("Error", "Could not load insights.", "error");
                } finally {
                    hideLoading();
                }
            });
        };

        setupStatsModalListener('#dailyRecommendationModal', displayDailyRecommendationModal);
        setupStatsModalListener('#personalizedSuggestionsModal', displayPersonalizedSuggestionsModal);
        setupStatsModalListener('#achievementsModal', displayAchievementsModal);
        setupStatsModalListener('#chartsModal', displayChartsModal);
        setupStatsModalListener('#detailedStatsModal', displayDetailedStatsModal);

        $(document).on('click', '#detailsModal .person-link, #detailsModal .related-item-link, #personDetailsModal .person-filmography-link', async function(e) {
            e.preventDefault();
            const target = $(this);
            const personId = target.data('person-id');
            const movieId = target.data('movie-id');
            const personName = target.data('person-name');
            const parentModal = target.closest('.modal');

            if (movieId) {
                $(parentModal).modal('hide');
                $(parentModal).one('hidden.bs.modal', () => openDetailsModal(movieId));
            } else if (personId) {
                openPersonDetailsModal(personId, personName);
            }
        });

        $(document).on('click', '#viewTmdbPersonBtn', function() {
            const url = $(this).data('tmdb-url');
            if (url) window.open(url, '_blank');
        });
        
        $('#findSimilarBtn').on('click', function() {
            const currentMovieId = $(this).data('current-movie-id');
            $('#detailsModal').modal('hide');
            $('#detailsModal').one('hidden.bs.modal', () => {
                displayPersonalizedSuggestionsModal(currentMovieId);
                $('#personalizedSuggestionsModal').modal('show');
            });
        });

        $('#refreshRecommendationsBtnModal').on('click', async function() {
             displayPersonalizedSuggestionsModal();
        });

        $(document).on('click', '.achievement-badge', function() {
            const badge = $(this);
            const name = badge.data('name');
            const description = badge.data('description');
            const progress = badge.data('progress');
            const threshold = badge.data('threshold');
            const isAchieved = badge.data('achieved');
            const message = `${description}<br><small class="text-muted">Progress: ${progress} / ${threshold}</small>`;
            const type = isAchieved ? 'success' : 'info';
            showToast(name, message, type, 5000);
        });
        
        $('#detailsModalAddBtn').on('click', function() {
            const tmdbObject = $(this).data('tmdbObject');
            if (!tmdbObject) { showToast("Error", "No TMDB data found to add.", "error"); return; }
            $('#detailsModal').modal('hide');
            $('#detailsModal').one('hidden.bs.modal', async () => {
                prepareAddModal(); 
                await applyTmdbSelection(tmdbObject); 
                const statusSelect = document.getElementById('status');
                if (statusSelect) { statusSelect.value = 'To Watch'; toggleConditionalFields(); }
                $('#entryModal').modal('show'); 
            });
        });

        $(document).on('click', '.person-link', function(e) {
            e.preventDefault();
            const personId = $(this).data('person-id');
            const personName = $(this).data('person-name');
            if (personId && personName) openPersonDetailsModal(personId, personName);
        });

        $(document).on('click', '#downloadDetailsImageBtn', function(e) {
            e.preventDefault();
            if (typeof downloadDetailsAsPNG === 'function') downloadDetailsAsPNG();
        });

    } else { console.warn("jQuery not loaded. Some features may not work."); }
// END CHUNK: 6: jQuery-Dependent Event Listeners 
            
//START CHUNK: 7: Final Event Listener Wiring & Global Listeners
            document.getElementById('confirmEraseDataBtn')?.addEventListener('click', window.eraseAllData);
            document.getElementById('checkRepairDataBtn')?.addEventListener('click', window.performDataCheckAndRepair);
            document.getElementById('status')?.addEventListener('change', toggleConditionalFields);
            document.getElementById('category')?.addEventListener('change', toggleConditionalFields);
            
            // FIX: Live Search Implementation (Debounced 700ms)
            formFieldsGlob.name?.addEventListener('input', debounce((e) => {
                const query = e.target.value.trim();
                const year = formFieldsGlob.tmdbSearchYear ? formFieldsGlob.tmdbSearchYear.value : '';
                
                if (query.length >= 2) {
                    fetchMovieInfoFromTmdb(query, year);
                } else {
                    // Clear results AND Spinner if input is cleared/too short
                    const resultsEl = document.getElementById('tmdbSearchResults');
                    const spinner = document.getElementById('liveSearchStatus');
                    if (resultsEl) { resultsEl.innerHTML = ''; resultsEl.style.display = 'none'; }
                    if (spinner) spinner.style.display = 'none';
                }
            }, 700));

            formFieldsGlob.tmdbSearchYear?.addEventListener('input', debounce(() => {
                const query = formFieldsGlob.name.value.trim();
                if (query.length >= 2) {
                     fetchMovieInfoFromTmdb(query, formFieldsGlob.tmdbSearchYear.value);
                }
            }, 700));
            
            formFieldsGlob.relatedEntriesNames?.addEventListener('input', debounce(populateRelatedEntriesSuggestions, 300));

            // NEW: Close Search Results when clicking outside
            document.addEventListener('click', (event) => {
                const searchContainer = document.getElementById('tmdbSearchResults');
                const searchInput = document.getElementById('movieName');
                // If click is NOT on the results AND NOT on the input
                if (searchContainer && searchInput && !searchContainer.contains(event.target) && event.target !== searchInput) {
                    searchContainer.style.display = 'none';
                }
            });

            // NEW: Sort Control Listeners
            const abbreviationMap = {
                Name: 'N',
                lastModifiedDate: 'M',
                LastWatchedDate: 'W',
                Year: 'Y',
                overallRating: 'R'
            };
            document.querySelectorAll('.dropdown-menu[aria-labelledby="sortColumnDropdown"] .dropdown-item').forEach(item => {
                item.addEventListener('click', (e) => {
                    e.preventDefault();
                    currentSortColumn = e.target.dataset.sortBy;
                    document.getElementById('sortColumnDropdown').textContent = abbreviationMap[currentSortColumn] || 'N';
                    sortMovies(currentSortColumn, currentSortDirection);
                    renderMovieCards();
                });
            });
            document.getElementById('sortDirectionToggle')?.addEventListener('click', (e) => {
                currentSortDirection = (currentSortDirection === 'asc') ? 'desc' : 'asc';
                const icon = e.currentTarget.querySelector('i');
                if (icon) icon.className = `fas fa-arrow-${currentSortDirection === 'asc' ? 'down' : 'up'}`;
                sortMovies(currentSortColumn, currentSortDirection);
                renderMovieCards();
            });

            // Filter Modal
            document.getElementById('applyFiltersBtn')?.addEventListener('click', () => {
                activeFilters.category = document.getElementById('filterCategory').value;
                activeFilters.country = document.getElementById('filterCountry').value;
                activeFilters.language = document.getElementById('filterLanguage').value;
                activeFilters.genres = [...selectedFilterGenres];
                activeFilters.genreLogic = document.querySelector('input[name="filterGenreLogic"]:checked').value;
                renderMovieCards(); // Filter is applied in renderMovieCards
                $('#filterSortModal').modal('hide');
                showToast("Filters Applied", "The movie list has been updated.", "success");
            });
            document.getElementById('clearFiltersBtn')?.addEventListener('click', () => { resetFilters(); $('#filterSortModal').modal('hide'); });

            // Confirmation Modals
            document.getElementById('confirmDeleteBtn')?.addEventListener('click', async () => { if (isMultiSelectMode) await window.performBatchDelete(); else await window.performDeleteEntry(); });
            document.getElementById('confirmDuplicateSaveBtn')?.addEventListener('click', async () => { if (pendingEntryForConfirmation) await window.proceedWithEntrySave(pendingEntryForConfirmation, pendingEditIdForConfirmation, 'quickSave'); $('#duplicateNameConfirmModal').modal('hide'); });
            document.getElementById('cancelDuplicateSaveBtn')?.addEventListener('click', () => { pendingEntryForConfirmation = null; pendingEditIdForConfirmation = null; });
            document.getElementById('exportStatsPdfBtn')?.addEventListener('click', () => exportStatsAsPdf());
            
            // Auth, Sync, and Data Management
            document.getElementById('supabaseLoginBtn')?.addEventListener('click', () => supabaseSignInUser(document.getElementById('supabaseEmail').value, document.getElementById('supabasePassword').value));
            document.getElementById('supabasePassword')?.addEventListener('keydown', (event) => { if (event.key === 'Enter') { event.preventDefault(); document.getElementById('supabaseLoginBtn')?.click();}});
            document.getElementById('supabaseGoogleSignInBtn')?.addEventListener('click', supabaseSignInWithGoogle);
            document.getElementById('supabaseSignupBtn')?.addEventListener('click', () => supabaseSignUpUser(document.getElementById('supabaseEmail').value, document.getElementById('supabasePassword').value));
            document.getElementById('supabasePasswordResetBtn')?.addEventListener('click', () => supabaseSendPasswordResetEmail(document.getElementById('supabaseEmail').value));
            document.getElementById('updatePasswordBtn')?.addEventListener('click', () => {
                const newPass = document.getElementById('newPassword').value;
                const confirmPass = document.getElementById('confirmNewPassword').value;
                const errorDiv = document.getElementById('passwordResetError');
                if (newPass.length < 6) { errorDiv.textContent = "Password must be at least 6 characters."; errorDiv.style.display = 'block'; return; }
                if (newPass !== confirmPass) { errorDiv.textContent = "Passwords do not match."; errorDiv.style.display = 'block'; return; }
                supabaseUpdateUserPassword(newPass);
            });
            document.getElementById('menuSupabaseLogoutBtn')?.addEventListener('click', supabaseSignOutUser);
            
            document.getElementById('menuSyncDataBtn')?.addEventListener('click', () => { closeMenu(); comprehensiveSync(false); });
            document.getElementById('menuImportBtn')?.addEventListener('click', () => { $('#importModal').modal('show'); closeMenu(); });
            document.getElementById('menuExportBtn')?.addEventListener('click', () => { $('#exportModal').modal('show'); closeMenu(); });
            
            document.getElementById('quickSyncBtn')?.addEventListener('click', () => { comprehensiveSync(false); });
            // NEW: Listener for Reload Local Data
            document.getElementById('quickReloadLocalBtn')?.addEventListener('click', async () => { 
                showLoading("Scanning local storage...");
                try {
                    await openDatabase(); // Ensure DB connection
                    movieData = await loadFromIndexedDB(); // Force reload
                    if (movieData.length > 0) {
                        recalculateAndApplyAllRelationships();
                        sortMovies(currentSortColumn, currentSortDirection);
                        renderMovieCards();
                        showToast("Success", `Found ${movieData.length} entries in local storage.`, "success");
                    } else {
                        showToast("Empty", "No data found in local storage.", "warning");
                    }
                } catch(e) {
                    showToast("Error", "Failed to reload local data.", "error");
                    console.error(e);
                } finally {
                    hideLoading();
                }
            });

            document.getElementById('quickImportBtn')?.addEventListener('click', () => { $('#importModal').modal('show'); });
            document.getElementById('quickAboutBtn')?.addEventListener('click', () => { $('#aboutModal').modal('show'); });

            document.getElementById('exportCsvBtn')?.addEventListener('click', () => { generateAndDownloadFile('csv'); $('#exportModal').modal('hide'); });
            document.getElementById('exportJsonBtn')?.addEventListener('click', () => { generateAndDownloadFile('json'); $('#exportModal').modal('hide'); });
            
            document.getElementById('forcePullTriggerBtn')?.addEventListener('click', () => { $('#importModal').modal('hide'); $('#confirmForcePullModal').modal('show'); });
            document.getElementById('forcePushTriggerBtn')?.addEventListener('click', () => { $('#exportModal').modal('hide'); $('#confirmForcePushModal').modal('show'); });

            document.getElementById('confirmForcePullBtn')?.addEventListener('click', async () => { $('#confirmForcePullModal').modal('hide'); await forcePullFromSupabase(); });
            document.getElementById('confirmForcePushBtn')?.addEventListener('click', async () => { $('#confirmForcePushModal').modal('hide'); await forcePushToSupabase(); });

            // Multi-Select Bar
            document.getElementById('batchEditSelectedBtn')?.addEventListener('click', prepareBatchEditModal);
            document.getElementById('batchDeleteSelectedBtn')?.addEventListener('click', () => showDeleteConfirmationModal());
            document.getElementById('cancelMultiSelectBtn')?.addEventListener('click', window.disableMultiSelectMode);

            // Event delegation for watch history actions within the entry modal
            const entryModal = document.getElementById('entryModal');
            if (entryModal) {
                entryModal.addEventListener('click', async (event) => {
                    const button = event.target.closest('button');
                    if (!button) return;
                    if (button.id === 'toggleAddWatchInstanceFormBtn') prepareAddWatchInstanceForm();
                    else if (button.id === 'saveWatchInstanceBtn') await saveOrUpdateWatchInstance();
                    else if (button.id === 'cancelWatchInstanceBtn') closeWatchInstanceForm();
                    else if (button.classList.contains('edit-watch-btn')) { const watchId = button.dataset.watchid; if (watchId) prepareEditWatchInstanceForm(watchId); }
                    else if (button.classList.contains('delete-watch-btn')) { const watchId = button.dataset.watchid; if (watchId) await deleteWatchInstanceFromList(watchId); }
                });
            }

            // Quick Update Modal Listener
            document.getElementById('quickUpdateFinishedToggle')?.addEventListener('change', (e) => {
                $('#quickUpdateConditionalFields').toggle(e.target.checked);
            });

            // Global Listeners
            document.addEventListener('click', () => recordUniqueDateForAchievement('app_usage_dates_achievement'), { once: true, passive: true });
            window.addEventListener('online', async () => { const onlineIndicator = document.getElementById('menuOnlineStatusIndicator'); if (onlineIndicator) { onlineIndicator.textContent = 'Online'; onlineIndicator.className = 'badge badge-pill badge-success'; } showToast("Connection Restored", "You are back online.", "success"); });
            window.addEventListener('offline', () => { const onlineIndicator = document.getElementById('menuOnlineStatusIndicator'); if (onlineIndicator) { onlineIndicator.textContent = 'Offline'; onlineIndicator.className = 'badge badge-pill badge-danger'; } showToast("Connection Lost", "You are offline. Changes will be synced later.", "warning"); });
// END CHUNK: 7: Final Event Listener Wiring & Global Listeners

//START CHUNK: 8: Application Initialization
   if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => { navigator.serviceWorker.register('./sw.js').then(reg => console.log('SW registered.')).catch(err => console.log('SW reg failed: ', err)); });
    }

    if (typeof initAuth === 'function') {
        initAuth();
    } else {
        console.error("CRITICAL: initAuth function not found. App cannot start.");
        showToast("Fatal Error", "Authentication module failed to load.", "error", 0);
    }
// END CHUNK: 8: Application Initialization 
});
