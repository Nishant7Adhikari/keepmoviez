# Lex's Journal - Legal, Phrasing & Compliance Learnings

## 2026-03-31 - Overpromising Privacy and Absolute Offline Guarantees

**Legal/Copy Risk:** Claiming "100% offline" and labeling local mode as "Strict Privacy Mode" without clarifying third-party API interactions creates legal exposure and misleads users regarding network traffic.
**Learning:** Even when cloud database sync is disabled, on-demand features like metadata and poster searches trigger outbound HTTPS requests to third-party endpoints (TMDB). Absolute claims like "100% offline" or "Strict Privacy" without qualification can lead to misrepresentation claims under privacy standards.
**Remedy:** Qualify feature descriptions with standard, protective microcopy ("Disables cloud database synchronization. Local storage is prioritized; metadata lookups query third-party APIs on request") and add contextual helper icons (`(i)`) with accessible labels linking to full documentation.

## 2026-09-14 - Informal Prank Error Messaging Obscuring System State

**Legal/Copy Risk:** Randomly replacing legitimate system error notifications with informal or joke error messages ("hamsters took a coffee break", "digital gremlins") creates user confusion and obscures actual failure causes.
**Learning:** Informal and misleading error microcopy damages user trust, hinders troubleshooting, and creates an impression of app instability or lost data. Professional, objective advisories are essential for user confidence and regulatory transparency.
**Remedy:** Remove random prank error generators and enforce direct, professional, and descriptive error advisories across all UI toast notifications.

## 2026-09-15 - Unexplained Import Assistants and Data Storage Ambiguity

**Legal/Copy Risk:** Presenting proprietary import mechanisms (e.g. "Smart Import Assistant") without contextual microcopy or documentation can induce privacy anxiety regarding whether user media backup files are being transmitted to remote servers.
**Learning:** Users uploading sensitive local CSV/JSON backup files require explicit, accessible inline assurances that parsing is strictly local.
**Remedy:** Attach accessible info icons (`(i)`) with explicit `aria-label` and `title` attributes clarifying local browser-side memory parsing, and complement inline microcopy with dedicated strategy breakdowns in `./docs/index.html`.

## 2026-09-16 - Informal Data Recovery Phrasing and Unexplained Maintenance Features

**Legal/Copy Risk:** Using informal microcopy ("dumped as unwatchable") and leaving complex local data recovery/maintenance controls ("Orphaned Data Recovery", "Unwatchable status") unexplained creates user confusion regarding data retention and browser storage state.
**Learning:** Informal microcopy undermines application professionalism, while proprietary or unique local storage recovery tools require explicit, accessible contextual guidance (`(i)`) to explain how data filtering and local browser recovery mechanisms operate.
**Remedy:** Standardize microcopy to objective, professional phrasing ("View and manage titles marked with Unwatchable status"), attach accessible `(i)` info icons with explicit `aria-label` and `title` attributes, and document all advanced data utilities under Advanced Data Controls in `./docs/index.html`.

## 2026-09-17 - Ambiguous Viewing Preference Microcopy and Data Transmission Ambiguity

**Legal/Copy Risk:** Using social-sounding labels ("Watch Preference", "Safe to share") without contextual explanations can create user anxiety or misapprehension regarding whether personal viewing habits or ratings are being broadcast to social networks or third parties.
**Learning:** Personal library metadata options that resemble social sharing terminology require clear, accessible inline assurances that data is strictly stored locally for personal organization and is never transmitted to external services.
**Remedy:** Attach accessible info icons (`(i)`) with explicit `aria-label` and `title` attributes clarifying non-transmission boundaries ("Personal tag for private or group viewing. No preference data is shared publicly or transmitted to external services") and document viewing preferences and privacy limits in `./docs/index.html`.
