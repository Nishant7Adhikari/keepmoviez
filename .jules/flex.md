# Flex's Journal - Critical Responsive Architecture Learnings

## 2026-09-25 - Dynamic Viewports and Mobile Touch Target Ergonomics

**Viewport/Touch Issue:**
1. Offcanvas menus, overlays, and responsive containers using `100vh` suffered from dynamic height clipping when mobile browser address bars expanded or collapsed on iOS Safari and Chrome Mobile.
2. Card action buttons (Edit, Delete, Watch History) on viewports $\le 400\text{px}$ had reduced padding (`0.15rem 0.3rem`), shrinking touch targets to $\approx 26\text{px}$ height—causing frequent misclicks on mobile touch screens.
3. Hover animations (`:hover`) on cards and action buttons stayed permanently active on touch screens after tapping (sticky mobile hover state).

**Learning:**
1. Mobile browser viewports change height dynamically when scrolling or opening menus. `100vh` represents the maximum viewport height assuming hidden browser chrome, causing elements to extend beyond visible screen bounds.
2. Hardcoded pixel reductions or tight padding on small screens break human touch ergonomics ($44\times44\text{px}$ minimum safe hitbox).
3. Mobile touch devices trigger mouseover/hover events on tap but do not clear them on tap release, causing persistent active visual states.

**Responsive Remedy:**
1. Use `100dvh` (Dynamic Viewport Height) with `100vh` fallback for offcanvas elements, mobile modals, and full-screen viewports.
2. Ensure touch target hitboxes maintain a $44\times44\text{px}$ minimum interactive boundary using transparent padding, flex alignment, and minimum dimensions without breaking visual inline alignment.
3. Guard desktop-only hover styles inside `@media (hover: hover) and (pointer: fine)` so touch devices remain clean and fluid without sticky hover highlights.
