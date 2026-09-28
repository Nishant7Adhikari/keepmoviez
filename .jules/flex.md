# Flex's Journal - Critical Responsive & Touch Ergonomics Learnings

## 2026-09-28 - Dynamic Viewport Units and Touch Target Sizing
**Viewport/Touch Issue:**
In mobile browsers (such as iOS Safari and Android Chrome), fixed `100vh` layouts cause bottom overlay elements and scrollable containers to be partially covered or clipped by dynamic browser address/navigation bars. Additionally, compact icon buttons (like `#clearSearchBtn`) had touch targets smaller than 44x44px.

**Learning:**
`100vh` represents the maximum potential height of the viewport when browser UI bars are collapsed, causing offcanvas overlays and scrollable main views to overflow behind active browser UI controls.

**Responsive Remedy:**
Use dynamic viewport height units (`100dvh` and `calc(100dvh - ...)` max-heights) for full-height fixed sidebars (`.offcanvas-menu`), backdrops (`.offcanvas-backdrop`), and primary scroll containers (`.table-responsive`). Ensure interactive touch controls maintain a minimum `44x44px` hit area via flex alignment or padding constraints (`min-width: 44px; min-height: 44px; display: inline-flex`).
