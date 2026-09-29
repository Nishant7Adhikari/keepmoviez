# Flex's Journal - Critical Responsive & Touch Ergonomics Learnings

## 2026-09-28 - Dynamic Viewport Units and Touch Target Sizing
**Viewport/Touch Issue:**
In mobile browsers (such as iOS Safari and Android Chrome), fixed `100vh` layouts cause bottom overlay elements and scrollable containers to be partially covered or clipped by dynamic browser address/navigation bars. Additionally, compact icon buttons (like `#clearSearchBtn`) had touch targets smaller than 44x44px.

**Learning:**
`100vh` represents the maximum potential height of the viewport when browser UI bars are collapsed, causing offcanvas overlays and scrollable main views to overflow behind active browser UI controls.

**Responsive Remedy:**
Use dynamic viewport height units (`100dvh` and `calc(100dvh - ...)` max-heights) for full-height fixed sidebars (`.offcanvas-menu`), backdrops (`.offcanvas-backdrop`), and primary scroll containers (`.table-responsive`). Ensure interactive touch controls maintain a minimum `44x44px` hit area via flex alignment or padding constraints (`min-width: 44px; min-height: 44px; display: inline-flex`).

## 2026-09-29 - Modal Footers and Touch Target Parity
**Viewport/Touch Issue:**
On narrow mobile screens (<375px), modal action buttons in `#entryModal` and `#backfillModal` were squished together with sub-44px touch targets and hidden text labels (`d-none d-sm-inline`), leading to fat-finger errors and awkward visual asymmetry. Furthermore, `:hover` scale/translate effects on cards and buttons remained sticky on mobile touch screens after tapping.

**Learning:**
Mobile viewports require stacked or flexible full-width modal footers with explicit `min-height: 44px` touch targets rather than relying on inline icon-only button groups designed for desktop widths. Unscoped `:hover` CSS transforms on touch devices cause persistent active states.

**Responsive Remedy:**
Enforce `@media (max-width: 575.98px)` flex-column / flex-wrap rules for modal footers with full-width primary actions and `min-height: 44px`. Wrap all interactive hover transformations inside `@media (hover: hover)` media queries.
