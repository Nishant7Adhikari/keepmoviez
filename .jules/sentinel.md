## 2025-05-10 - HTML Sanitization for Notifications and User Notes
**Vulnerability:** jQuery `.html()` in `showToast` and raw string template interpolation for watch history notes enabled DOM-based Cross-Site Scripting (XSS).
**Learning:** `showToast` receives unescaped error messages or movie titles, and watch history UI renders user notes directly into HTML string templates.
**Prevention:** Use `.text()` for toast notifications and `escapeHTML()` from `js/utils.js` whenever inserting user input strings into HTML templates.
