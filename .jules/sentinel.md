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
