## 2026-09-07 - Date instantiation & static data lookups in calculateAllStatistics
**Learning:** `calculateAllStatistics` processes watch instances in single-pass aggregation. Calling `Date.prototype.toLocaleString` or instantiating `new Date(wi.date)` inside iteration loops over `allWatchInstances` causes high GC pressure and CPU bottleneck on large datasets (>1000 items). Caching timestamps (`wi.timestamp`) and pre-filtering `specialTitleAchievements` reduced execution time by ~70%.
**Action:** When working on statistics or array aggregations in this app, avoid `new Date()` allocations or locale formatting inside inner loops; pre-parse or compute timestamps during the initial item loop.

## 2026-09-08 - Connected Component Lookup in recalculateAndApplyAllRelationships
**Learning:** `recalculateAndApplyAllRelationships` previously performed `allComponents.find(comp => comp.includes(movie.id))` inside a `movieData` iteration loop. Scanning all components using nested array searches for each movie created an O(N^2) CPU bottleneck (~231ms for 5,000 items). Pre-indexing movies in a `movieMap` and assigning `relatedEntries` directly during BFS connected component traversal reduced runtime to ~14ms (16x speedup).
**Action:** When grouping or partitioning graph nodes / data items in this app, avoid post-hoc `.find()`/`.includes()` scans over partition arrays; assign properties directly during traversal or index items using a Map.

## 2026-09-09 - Pre-normalizing & early exit for special title achievements in calculateAllStatistics
**Learning:** In `calculateAllStatistics`, checking special title achievements for every watched movie repeatedly executed `toLowerCase()`, `trim()`, and `.replace()` on title name arrays and movie titles. Pre-normalizing achievement title names prior to the movie loop and skipping already unlocked achievements (`if (specialTitleStatus[ach.id]) return;`) reduced statistical aggregation time by ~2.7x (~120ms to ~44ms for 5,000 entries).
**Action:** Pre-normalize static strings outside data aggregation loops and short-circuit unlocked status evaluations when checking entries against achievements or target lists.
