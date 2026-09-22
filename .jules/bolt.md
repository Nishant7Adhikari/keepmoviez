## 2026-09-07 - Date instantiation & static data lookups in calculateAllStatistics
**Learning:** `calculateAllStatistics` processes watch instances in single-pass aggregation. Calling `Date.prototype.toLocaleString` or instantiating `new Date(wi.date)` inside iteration loops over `allWatchInstances` causes high GC pressure and CPU bottleneck on large datasets (>1000 items). Caching timestamps (`wi.timestamp`) and pre-filtering `specialTitleAchievements` reduced execution time by ~70%.
**Action:** When working on statistics or array aggregations in this app, avoid `new Date()` allocations or locale formatting inside inner loops; pre-parse or compute timestamps during the initial item loop.

## 2026-09-08 - Connected Component Lookup in recalculateAndApplyAllRelationships
**Learning:** `recalculateAndApplyAllRelationships` previously performed `allComponents.find(comp => comp.includes(movie.id))` inside a `movieData` iteration loop. Scanning all components using nested array searches for each movie created an O(N^2) CPU bottleneck (~231ms for 5,000 items). Pre-indexing movies in a `movieMap` and assigning `relatedEntries` directly during BFS connected component traversal reduced runtime to ~14ms (16x speedup).
**Action:** When grouping or partitioning graph nodes / data items in this app, avoid post-hoc `.find()`/`.includes()` scans over partition arrays; assign properties directly during traversal or index items using a Map.

## 2026-09-09 - Pre-normalizing & early exit for special title achievements in calculateAllStatistics
**Learning:** In `calculateAllStatistics`, checking special title achievements for every watched movie repeatedly executed `toLowerCase()`, `trim()`, and `.replace()` on title name arrays and movie titles. Pre-normalizing achievement title names prior to the movie loop and skipping already unlocked achievements (`if (specialTitleStatus[ach.id]) return;`) reduced statistical aggregation time by ~2.7x (~120ms to ~44ms for 5,000 entries).
**Action:** Pre-normalize static strings outside data aggregation loops and short-circuit unlocked status evaluations when checking entries against achievements or target lists.

## 2026-09-10 - Single-pass getLatestWatchInstance & Map pre-indexing in sortMovies
**Learning:** `getLatestWatchInstance` previously copied, filtered, and sorted watch history arrays (`.sort((a, b) => new Date(b.date) - new Date(a.date))`). Invoking this helper inside `sortMovies("LastWatchedDate")` executed $O(M \log M)$ sorts repeatedly inside an $O(N \log N)$ comparator, taking ~290ms for 5,000 items. Refactoring `getLatestWatchInstance` to a single-pass $O(M)$ linear scan and pre-indexing latest timestamps into a `Map` prior to `movieData.sort()` reduced sort runtime to ~19ms (~15x speedup).
**Action:** Replace `Array.prototype.sort()` for finding min/max array elements with single-pass linear scans, and pre-index derived/computed sorting keys into a Map before calling `Array.prototype.sort()`.

## 2026-09-11 - Pre-parsing lastModifiedDate into Map before Array.prototype.sort
**Learning:** Sorting by `lastModifiedDate` previously executed `new Date(a.lastModifiedDate).getTime()` directly inside `movieData.sort()`, causing $O(N \log N)$ redundant date parses (~140ms for 5,000 entries). Pre-parsing `lastModifiedDate` into a `Map` in an $O(N)$ pass prior to calling `movieData.sort()` reduced sort runtime to ~64ms (~2.2x speedup).
**Action:** Pre-parse date strings into numeric timestamps in a Map before sorting array entries by date fields.

## 2026-09-12 - Single-pass filtering & short-circuiting in applyFilters
**Learning:** `applyFilters` previously chained up to 5 consecutive `Array.prototype.filter` passes over `movieData`, re-allocating intermediate arrays on each filter tier and executing expensive text lowercasing (`filterQuery`) and genre string splits (`m.Genre.split(",")`) across all entries. Consolidating filters into a single-pass `data.filter()` callback and short-circuiting fast property equality checks (`Category`, `Country`, `Language`) before executing text search or genre splits reduced filter processing time by ~2.25x (~1.04s to ~0.46s for 1,000 calls over 5,000 items).
**Action:** Consolidate multi-stage array filtering into single-pass pipelines and order predicate conditions so that cheap property equality checks short-circuit before expensive string parsing/searching functions.

## 2026-09-13 - Pre-parsing dates & using localeCompare for ISO string sorting in calculateAllStatistics
**Learning:** In `calculateAllStatistics`, streak calculations repeatedly allocated `new Date()` instances inside iteration loops, and `watchesByMonth`/`avgRatingByMonth` sorting invoked `new Date(a.iso)` parsing inside `Array.prototype.sort()` comparators. Pre-parsing date strings into numeric UTC timestamps once prior to streak loops and replacing `new Date()` sort comparisons with `String.prototype.localeCompare()` on ISO (`YYYY-MM`) strings reduced aggregation execution time by ~7-8%.
**Action:** Pre-parse date strings to numeric timestamps before streak/range loops, and use `localeCompare` for sorting ISO formatted date strings (`YYYY-MM`) instead of parsing `Date` objects inside sort comparators.

## 2026-09-14 - Single-pass getLatestWatchInstance & Date.parse in scatter charts and UI sorting
**Learning:** `renderRatingReleaseYearScatter` previously copied `[...movie.watchHistory]` and sorted it with $O(M \log M)$ `new Date()` comparators to find the latest watch date for each movie. Replacing array cloning and sorting with $O(M)$ linear scan helper `getLatestWatchInstance` and wall-clock safe `formatWatchDateDisplay` eliminated $O(N \cdot M)$ temporary array allocations and date parses. Replacing `new Date()` in `findNextBestSeedMovie` and watch history UI sort comparators with numeric `Date.parse()` timestamps further reduced GC pressure during modal rendering.
**Action:** Use single-pass helper `getLatestWatchInstance` rather than `[...history].sort()` to find latest watch instances, and use `Date.parse()` rather than `new Date()` inside sort comparators.

## 2026-09-16 - Memoizing renderStars via Map cache
**Learning:** `renderStars` was invoked repeatedly during card batch rendering, modal popups, and watch history lists to build HTML star icons. Computing `parseFloat`, `Math.round`, and string concatenations on every single card and list item created redundant CPU cycles. Caching generated star HTML strings in a `Map` (`RENDER_STARS_CACHE`) reduced benchmark execution time by ~2.5x (from ~160ms to ~62ms over 1,000,000 calls).
**Action:** Cache deterministic UI helper outputs (such as star rating HTML snippets) in a `Map` when inputs are bounded and called repeatedly during list and card rendering.

## 2026-09-17 - Fast-path regex short-circuiting in escapeHTML
**Learning:** `escapeHTML` executed 5 sequential `.replace()` calls on every string passed during card and list rendering, even when strings contained no special characters needing entity escaping (`&`, `<`, `>`, `"`, `'`). Fast-path checking strings with a single top-level compiled regex (`/[&<>"']/`) before running replacement pipelines short-circuits execution for plain text strings and reduced benchmark runtime by ~3.8x (3.62s to 0.95s over 1,000,000 calls).
**Action:** Short-circuit multi-pass string sanitizer/formatter functions with a single regex `.test()` check when input strings rarely contain escaped target characters.

## 2026-09-18 - Case-insensitive Map pre-indexing in getCountryFullName
**Learning:** `getCountryFullName` previously executed `Object.entries(countryCodeToNameMap)` and `mapName.toUpperCase()` linear scans on every call for full country names or non-direct code matches. Pre-indexing country codes and full names lazily into a case-insensitive `Map` (`COUNTRY_LOOKUP_MAP`) eliminated $O(K)$ linear array scans and string allocations, reducing execution time by ~43.8x (from ~2642ms to ~60ms for 500,000 calls).
**Action:** Pre-index static dictionary/lookup objects into case-insensitive Maps rather than iterating over `Object.entries()` inside repeatedly called helper functions.

## 2026-09-19 - Pre-indexing GENRE_MAP in calculateMatchScoreForRecommendation
**Learning:** `calculateMatchScoreForRecommendation` previously executed `GENRE_MAP.find(g => g.id === id)` for every genre ID on every recommendation card rendered in suggestion carousels. Pre-indexing `GENRE_MAP` into a `Map` (`GENRE_MAP_LOOKUP`) eliminated $O(G)$ linear array scans per recommendation item, reducing calculation time by ~1.43x (from ~1887ms to ~1320ms over 500,000 calls).
**Action:** Pre-index static arrays into a Map by ID when looking up references repeatedly inside rendering or scoring callbacks.

## 2026-09-20 - Pre-indexing Map in openPersonDetailsModal, details modals, and country sort
**Learning:** `openPersonDetailsModal` previously performed `movieData.find(entry => entry.tmdbId === credit.id && entry.tmdbMediaType === credit.media_type)` inside a `uniqueCredits` loop over a person's combined credits (50-200 items). For large libraries, this created up to $O(C \cdot N)$ linear array scans. Pre-indexing `movieData` into a `localTmdbMap` keyed by `${mediaType}_${tmdbId}` prior to mapping over `uniqueCredits` reduced execution time by ~7.3x (928ms to 126ms over 100 queries). Similarly, pre-indexing `movieData` by `id` in `openDetailsModal`/`prepareEditModal` for related entries and pre-mapping country full names in `populateFilterModalOptions` eliminated $O(R \cdot N)$ and $O(K \log K)$ redundant lookups.
**Action:** Pre-index collection items into a Map prior to array transformation loops or sort comparators when searching by composite keys or looking up entity references repeatedly.

## 2026-09-21 - Pre-indexing primary values and tie-breaker names in sortMovies
**Learning:** `sortMovies` in `js/app.js` previously only pre-indexed `LastWatchedDate` and `lastModifiedDate`, while calling `parseInt(a.Year, 10)`, `parseFloat(a.overallRating)`, `String(a[column] || "").toLowerCase().trim()`, and tie-breaker `String(a.Name || "").toLowerCase()` repeatedly inside $O(N \log N)$ comparator loops (~50,000+ executions for 5,000 items). Pre-indexing primary sort values into `valueMap` and lowercased names into `nameMap` in a single $O(N)$ pass before `movieData.sort()` reduced `Year` sort time from ~538ms to ~70ms (~7.6x speedup) and `overallRating` sort time from ~373ms to ~80ms (~4.6x speedup).
**Action:** Always pre-calculate both primary sort keys and tie-breaker comparison values in a single $O(N)$ pass prior to `Array.prototype.sort()`.

## 2026-09-22 - Pre-indexing top-rated genres in calculateMatchScoreForRecommendation
**Learning:** `calculateMatchScoreForRecommendation` in `js/reporting.js` previously iterated through `window.globalStatsData.topRatedGenresOverall` array for every genre ID on every recommendation card rendered, executing `ratedGenre.label.toLowerCase()` and `parseFloat(ratedGenre.value)` repeatedly. Caching `topRatedGenresOverall` in a lowercased Map (`TOP_RATED_GENRES_LOOKUP`) eliminated $O(G_1 \cdot G_2)$ double nested loops and string lowercasing per card, reducing execution time from ~275ms to ~124ms (~2.2x speedup over 50,000 calls).
**Action:** Pre-index top-rated user preference arrays into a Map with reference-equality caching before evaluating recommendation match scores across multi-item carousels.
