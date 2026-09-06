## 2025-09-05 - Accessible Icon-Only Buttons Pattern
**Learning:** Icon-only buttons relying solely on `title` attributes or Font Awesome `<i>` elements lack accessible names for screen reader users.
**Action:** Ensure all fixed and dynamically rendered icon-only buttons include descriptive `aria-label` attributes matching their intent.

## 2026-09-06 - Responsive Icon-Only Buttons Pattern
**Learning:** Buttons using responsive text helper classes like `d-none d-sm-inline` collapse into icon-only buttons on narrow viewports, losing their accessible name for screen readers when text is hidden.
**Action:** Always add an `aria-label` matching the button's intent to buttons that visually hide their text label on mobile screens.
