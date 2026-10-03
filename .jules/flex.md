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

## 2026-09-30 - Button Flex Text Wrapping and Touch Control Ergonomics
**Viewport/Touch Issue:**
Compact floating action buttons (`.quick-action-btn`, `.daily-pick-close-btn`, `.btn-pg-stepper`) used sub-44px dimensions (36x36px), leading to fat-finger hazards on touch devices. Additionally, flex buttons containing descriptive subtext on the welcome screen (`.initial-upload-section .btn`) overflowed horizontally on narrow 320px screens due to default button `white-space: nowrap`.

**Learning:**
Bootstrap `.btn` elements enforce `white-space: nowrap` by default, which prevents nested flex text containers from wrapping even when `min-width: 0` and `overflow-wrap: break-word` are set. Unscoped `:hover` states on recommendation cards and chip controls cause persistent visual transforms on touch devices.

**Responsive Remedy:**
Explicitly set `white-space: normal !important` and `flex: 1 1 auto; min-width: 0;` on flex button text containers inside narrow layout wrappers. Enforce minimum `44x44px` hit areas for floating actions and pagination controls, and wrap interactive hover styles inside `@media (hover: hover)` media queries.
