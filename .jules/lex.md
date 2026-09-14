# Lex's Journal - Legal, Phrasing & Compliance Learnings

## 2026-03-31 - Overpromising Privacy and Absolute Offline Guarantees

**Legal/Copy Risk:** Claiming "100% offline" and labeling local mode as "Strict Privacy Mode" without clarifying third-party API interactions creates legal exposure and misleads users regarding network traffic.
**Learning:** Even when cloud database sync is disabled, on-demand features like metadata and poster searches trigger outbound HTTPS requests to third-party endpoints (TMDB). Absolute claims like "100% offline" or "Strict Privacy" without qualification can lead to misrepresentation claims under privacy standards.
**Remedy:** Qualify feature descriptions with standard, protective microcopy ("Disables cloud database synchronization. Local storage is prioritized; metadata lookups query third-party APIs on request") and add contextual helper icons (`(i)`) with accessible labels linking to full documentation.
