# Flex's Journal - Responsive Architecture & Touch Ergonomics

## 2025-09-27 - Minimum Touch Hitboxes & Sticky Hover State Prevention
**Viewport/Touch Issue:** Compact action buttons on movie cards and navbar search controls were as small as 24px x 20px, presenting severe fat-finger hazards on mobile touch devices. Furthermore, desktop hover transformations (`translateY`, active shadows) remained sticky on mobile screens after tapping.
**Learning:** Mobile browsers simulate hover states when elements are tapped, causing desktop `:hover` styles to stick. Additionally, small icon buttons without minimum sizing violate WCAG 2.5.5 / 2.5.8 (44x44px target size).
**Responsive Remedy:** Enforce `min-width: 44px; min-height: 44px;` hitboxes with `display: inline-flex; align-items: center; justify-content: center;` for interactive buttons, and wrap hover transforms inside `@media (hover: hover)` capability queries.
