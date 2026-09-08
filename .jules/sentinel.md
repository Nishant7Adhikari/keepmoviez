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
