
## 2026-09-26 - Mobile Touch Ergonomics & Viewport Insets
**Viewport/Touch Issue:** Sticky hover states on mobile touchscreens caused buttons/cards to stay in hover state post-tap, and small hitboxes (<44px) in the top navbar led to fat-finger tap errors.
**Learning:** Mobile browsers retain CSS `:hover` states after touch interactions unless guarded by device capability media queries `@media (hover: hover)`.
**Responsive Remedy:** Wrap interactive `:hover` styles in `@media (hover: hover)`, enforce `min-width: 44px; min-height: 44px;` hitboxes using flex alignment, and apply `env(safe-area-inset-*)` padding for safe notch/home indicator spacing.
