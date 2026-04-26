# Bulk Import / Featured Packets Feature Analysis

## 1. Overview and Feasibility

The proposed "Bulk Import" feature is highly feasible and aligns perfectly with the current architecture. Since the application already integrates heavily with the TMDB API and stores `tmdb_collection_id` for movies, we can leverage TMDB's native "Collections" and "Lists" endpoints to fetch entire franchises (like the MCU, The Matrix, Harry Potter) in a single API call.

By using TMDB's collection data, we get the exact release order, posters, and metadata for every movie in the franchise simultaneously.

## 2. Design Ideas and UI/UX Suggestions

### A. The "Featured Packets" Entry Point

- **Placement**: In the existing `entryModal` (Add/Edit Modal), add a prominent button at the top: **"📦 Import Franchise / Featured Packets"**.
- **Marketing Name**: "Franchise Importer", "Cinematic Universes", or "Featured Collections" sounds more native to movies than "Packets".

### B. Packet Selection Screen

- Create a new modal (e.g., `bulkImportModal`).
- Provide a grid of "Featured" hardcoded collections with nice posters (e.g., MCU, DCEU, Star Wars, Harry Potter, James Bond).
- **Search Bar**: Allow users to search for _any_ franchise via the TMDB API (`/search/collection` endpoint). This makes the feature infinitely scalable beyond just the hardcoded ones.

### C. The "Modify Before Saving" UI

- Once a packet is selected, display a list of all movies inside it.
- **Sorting**: TMDB provides `release_date`. Sort the list chronologically by default.
- **Visuals**: Display the list as a scrollable list of mini-cards or rows.
- **Selection**:
  - `[✓] Iron Man (2008)`V
  - `[✓] The Incredible Hulk (2008)`
  - `[✓] Iron Man 2 (2010)`
- **Redundancy Indication**: If the user already has "Iron Man" in their library, show it as grayed out or marked as `[Already in Library]`, and uncheck it by default.

### D. "Add Missing / Add Extra"

- At the bottom of the list, provide a simple search input to append additional movies to this import batch that might not officially be in the TMDB collection (e.g., adding "Deadpool" to an older MCU packet, or adding "Venom").

## 3. Handling Redundancy and API Usage (Crucial)

**The Problem**: Importing 50 movies might trigger 50 separate TMDB detail API calls, hitting rate limits and slowing down the app.

**The Solution**:

1. **Initial Fetch**: Call `/collection/{collection_id}` once. This returns an array of all movies in the franchise with basic info (title, year, poster, overview).
2. **Redundancy Check**: Compare the `id` from the TMDB response against the `tmdbId` of items in the user's local `movieData`.
3. **Selective Fetching**: Only make the detailed TMDB API call (`/movie/{id}?append_to_response=...`) for the movies the user keeps checked AND that are not already in the library.
4. **Throttling**: If importing 30+ new movies, process the saves in batches (e.g., 5 at a time) with a visual progress bar (e.g., "Importing 12 of 33...") to prevent UI freezing and API timeouts.

## 4. Fixing the "Related Entries" Feature

**Current Issues**: The current `relatedEntries` logic relies on string matching and a manual comma-separated text input. It is prone to typos, orphaned links when movies are deleted, and UI bugs where suggestions don't disappear.

**How Bulk Import Fixes This**:

- Since we are importing a franchise together, we know exactly which movies are related.
- When the bulk import saves the new movies (and links to the existing ones), we can mathematically cross-link all their newly generated local `id`s into each other's `relatedEntries` array automatically.
- **UI Update for Related Entries**: Instead of a raw text input (`formFieldsGlob.relatedEntriesNames`), we should display related entries as dismissible "Tags/Pills" inside the edit modal.
- If a movie has a `tmdb_collection_id` (which our bulk importer will set), we can optionally use that ID to implicitly group movies in the background, making the `relatedEntries` array self-healing.

## 5. Edge Cases to Consider

- **TV Shows vs. Movies**: The MCU contains Disney+ TV shows, but TMDB "Collections" usually only group movies. To provide a _true_ MCU packet including TV shows, we might need to use TMDB "Lists" (which can contain mixed media) instead of TMDB "Collections", or manually curate the featured packets using a predefined array of TMDB IDs.
- **Sync Conflicts**: If the user triggers a bulk import while offline, ensure the `_sync_state` is set to "new" for all 50 items so they sync properly upon reconnection.
- **Memory/IndexedDB Quota**: Adding 50 items at once with full cast, crew, and high-res poster URLs increases the JSON payload size. Ensure we aren't saving unnecessary heavy data (limit cast to top 10).

## 6. Implementation TODO List

- [ ] **Data Sourcing**: Decide if "Featured Packets" will use TMDB Collections (Movies only) or TMDB Lists (Movies + TV).
- [ ] **UI - Add Modal**: Add the "Import Franchise" entry point button.
- [ ] **UI - Selection Modal**: Build the `bulkImportModal` grid showing featured franchises.
- [ ] **UI - Preview Modal**: Build the list view with checkboxes, integrating the duplicate check against `movieData` (checking `tmdbId`).
- [ ] **Logic - Import Engine**: Create `performBulkImport(selectedTmdbIds)` function.
  - Implement a queue system to fetch detailed TMDB data with a `250ms` delay between requests to avoid rate limits.
  - Show a progress overlay.
- [ ] **Logic - Auto-Relating**: After the batch is generated, map over the new entries and cross-pollinate their `relatedEntries` arrays with each other's local UUIDs.
- [ ] **Logic - Related Entries Fix**: Refactor the current `relatedEntriesNames` input in `index.html` to a visual tag-based system to fix the manual entry bugs.
- [ ] **Database Save**: Execute a single `saveToIndexedDB()` and trigger `renderMovieCards()` after the entire batch is complete.
