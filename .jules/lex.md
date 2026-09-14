# Lex's Journal - Legal, Phrasing & Compliance Learnings

## 2026-03-31 - Overpromising Privacy and Absolute Offline Guarantees

**Legal/Copy Risk:** Claiming "100% offline" and labeling local mode as "Strict Privacy Mode" without clarifying third-party API interactions creates legal exposure and misleads users regarding network traffic.
**Learning:** Even when cloud database sync is disabled, on-demand features like metadata and poster searches trigger outbound HTTPS requests to third-party endpoints (TMDB). Absolute claims like "100% offline" or "Strict Privacy" without qualification can lead to misrepresentation claims under privacy standards.
**Remedy:** Qualify feature descriptions with standard, protective microcopy ("Disables cloud database synchronization. Local storage is prioritized; metadata lookups query third-party APIs on request") and add contextual helper icons (`(i)`) with accessible labels linking to full documentation.

## 2026-09-14 - Informal Prank Error Messaging Obscuring System State

**Legal/Copy Risk:** Randomly replacing legitimate system error notifications with informal or joke error messages ("hamsters took a coffee break", "digital gremlins") creates user confusion and obscures actual failure causes.
**Learning:** Informal and misleading error microcopy damages user trust, hinders troubleshooting, and creates an impression of app instability or lost data. Professional, objective advisories are essential for user confidence and regulatory transparency.
**Remedy:** Remove random prank error generators and enforce direct, professional, and descriptive error advisories across all UI toast notifications.
