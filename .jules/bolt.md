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
