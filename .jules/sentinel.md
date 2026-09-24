## 2025-05-10 - HTML Sanitization for Notifications and User Notes
**Vulnerability:** jQuery `.html()` in `showToast` and raw string template interpolation for watch history notes enabled DOM-based Cross-Site Scripting (XSS).
**Learning:** `showToast` receives unescaped error messages or movie titles, and watch history UI renders user notes directly into HTML string templates.
**Prevention:** Use `.text()` for toast notifications and `escapeHTML()` from `js/utils.js` whenever inserting user input strings into HTML templates.

## 2025-09-07 - Comprehensive HTML Escaping for Import Headers, Heatmap Tooltips, and Cast/Crew Modals
**Vulnerability:** Raw string interpolation of uploaded CSV file names in `populateImportSummary`, TMDB search error messages in `fetchMovieInfoFromTmdb`, movie titles in `renderActivityHeatmap` tooltips, and cast/crew/filmography names in details modals enabled DOM-based XSS.
**Learning:** External API errors, uploaded file metadata (`file.name`), and database fields like movie titles or cast member characters are frequently injected into innerHTML/append templates without sanitization.
**Prevention:** Wrap all dynamic variables in HTML string templates with `escapeHTML()` from `js/utils.js` regardless of whether they originate from local storage, file uploads, or third-party APIs.

## 2026-09-08 - HTML Sanitization for Details Modal Genre Pills and Achievement UI
**Vulnerability:** Unescaped genre string interpolation in `openDetailsModal` (`<span class="genre-pill">${g}</span>`), recommendation fallback messages in `displayDailyRecommendationModal`, and achievement names/descriptions in trophy badges and unlock celebration overlays enabled DOM-based XSS.
**Learning:** Dynamic strings rendered into modals or overlays—such as genre labels or achievement metadata—can contain user-controlled or external data.
**Prevention:** Always wrap dynamic variables inserted into DOM via `innerHTML` or jQuery `.append()` with `escapeHTML()` from `js/utils.js`.

## 2026-09-10 - HTML Escaping for Poster and Backdrop Image URL Attributes
**Vulnerability:** Unescaped user-controlled or third-party image URLs (`posterUrl`, `posterPath`, `backdropUrl`) interpolated into HTML attribute strings (`data-src="${posterUrl}"`, `src="${posterPath}"`, `url('${card.backdropUrl}')`) allowed attribute breakout and DOM-based XSS (e.g. via `onerror=` handlers).
**Learning:** Image URLs originating from user input (`movie["Poster URL"]`) or API responses can contain quotes and HTML syntax that break out of HTML attributes when rendered into `innerHTML`.
**Prevention:** Wrap all image URLs interpolated into HTML template literals or attribute strings with `escapeHTML()` from `js/utils.js`.

## 2026-09-11 - HTML Sanitization for Backfill Input Attributes and Select Options
**Vulnerability:** Unescaped string interpolation in `renderFieldInput` (`<option value="${opt}">${opt}</option>` and `placeholder="${placeholder}"`) enabled attribute breakout and DOM-based XSS when backfill field configurations or dynamic option lists contained special characters or double quotes.
**Learning:** Dynamic input generation for forms and wizard dialogs must escape all placeholder, value, min/max attributes, and option text elements.
**Prevention:** Always wrap dynamic option labels, select values, and input element attributes with `escapeHTML()` from `js/utils.js` when building form HTML strings.

## 2026-09-12 - Variable-Level Sanitization for Formatted Recommendation Strings
**Vulnerability:** Dynamic variables (`match`, `favoriteGenreObj.value`, `topDirector`) interpolated into formatted HTML pick reasons in `getDailyRecommendationPickReason` were unescaped, while `renderDailyRecommendationCard` escaped the composite `pickReason` string resulting in double-escaped literal HTML tags in UI.
**Learning:** When helper functions construct HTML markup (e.g. `<strong>${var}</strong>`), sanitization must be applied directly to the dynamic variables inside the helper rather than escaping the entire HTML string at the top-level card template.
**Prevention:** Always sanitize individual dynamic inputs with `escapeHTML()` when constructing formatted HTML strings inside helper methods.

## 2026-09-15 - HTML Sanitization for Action Button Data Attributes and Card Status Badges
**Vulnerability:** Unescaped string interpolation of `movie.id`, `statusClass`, and `statusBadgeText` in `renderNextBatch` card action buttons, `renderDailyRecommendationCard` modal buttons (`data-movie-id="${movie.id}"`), and `renderSeasonBreakdownCards` (`data-container="${containerId}"`, `data-badge="${badgeId}"`) enabled attribute breakout and DOM-based XSS when entry IDs or status values contained double quotes or HTML syntax.
**Learning:** Data attributes (`data-movie-id="${id}"`) and status badge text/classes generated from entry properties or function parameters can contain quotes or special characters when data originates from user imports or third-party sync.
**Prevention:** Wrap all dynamic identifiers (`movie.id`), status badges (`statusClass`, `statusBadgeText`), and container IDs in HTML attribute and element string templates with `escapeHTML()` from `js/utils.js`.

## 2026-09-17 - HTML Sanitization for Achievement Icons and Watch History Action Button Aria-Labels
**Vulnerability:** Unescaped string interpolation of `ach.icon` / `achievement.icon` in achievement badge elements (`<i class="${ach.icon}">`) and celebration overlays, and `watchDateFormatted` in watch history action button `aria-label` attributes enabled attribute breakout and DOM-based XSS.
**Learning:** Icon class names and formatted date values interpolated directly into HTML class or `aria-label` attributes without `escapeHTML()` can contain double quotes or attribute breakout syntax.
**Prevention:** Wrap all dynamic icon identifiers, formatted dates, and accessibility label strings interpolated into HTML attributes with `escapeHTML()` from `js/utils.js`.

## 2026-09-20 - Window Target Manipulation and Reverse Tabnabbing in Search Links
**Vulnerability:** `window.open(url, current.entryName)` passed dynamic user-controlled entry titles as the target window parameter.
**Learning:** Unsanitized dynamic strings passed as window target names can allow frame/target manipulation (e.g. if title is `_self`) and throw DOMExceptions in strict browser environments when titles contain spaces or special characters.
**Prevention:** Always use explicit target `_blank` and pass window features `"noopener,noreferrer"` when calling `window.open()` for external links.

## 2026-09-23 - Inline JavaScript Attribute Context Breakout in Modal Action Handlers
**Vulnerability:** Interpolating dynamic entry IDs (`${safeEscape(entry.id)}`) into single-quoted string literals inside inline `onclick="..."` event attributes in `openUnwatchableModal` allowed JavaScript context breakout.
**Learning:** Browsers decode HTML entities (`&#039;` -> `'`) in HTML attribute values before the JavaScript engine executes inline event handlers. Escaping single quotes as HTML entities does not prevent breaking out of single-quoted string literals in inline `onclick` scripts.
**Prevention:** Avoid inline JavaScript string interpolation in `onclick` attributes. Instead, store dynamic values in `data-*` attributes (`data-movie-id="${escapeHTML(id)}"`) and attach event listeners via `addEventListener` or class-based event delegation.
