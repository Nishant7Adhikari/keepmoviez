## 2025-09-05 - Accessible Icon-Only Buttons Pattern
**Learning:** Icon-only buttons relying solely on `title` attributes or Font Awesome `<i>` elements lack accessible names for screen reader users.
**Action:** Ensure all fixed and dynamically rendered icon-only buttons include descriptive `aria-label` attributes matching their intent.

## 2026-09-06 - Responsive Icon-Only Buttons Pattern
**Learning:** Buttons using responsive text helper classes like `d-none d-sm-inline` collapse into icon-only buttons on narrow viewports, losing their accessible name for screen readers when text is hidden.
**Action:** Always add an `aria-label` matching the button's intent to buttons that visually hide their text label on mobile screens.

## 2026-09-09 - Context-Specific Accessible Action Labels Pattern
**Learning:** Dynamic list and card action buttons using generic labels like "Edit entry" or "Delete entry" lack item context when screen reader users navigate controls out of document flow.
**Action:** Include the escaped item title in dynamic action button `aria-label`s (e.g. `aria-label="Edit ${escapeHTML(item.Name)}"`) to provide distinct, meaningful context for screen readers.

## 2026-09-16 - WCAG 2.5.3 Label in Name Compliance
**Learning:** Adding an `aria-label` that overrides visible button text without including the exact visible text string violates WCAG 2.5.3 (Label in Name), breaking speech recognition navigation for voice users.
**Action:** Ensure `aria-label` on buttons with visible text includes the visual string (e.g. `aria-label="Awesome! Dismiss achievement celebration"`).

## 2026-09-18 - OAuth Button Visible Contrast & Decorative Icon Hiding
**Learning:** OAuth buttons in themed forms can inherit parent text colors causing low contrast on light button backgrounds, and decorative FontAwesome icons in buttons with `aria-label`s generate duplicate screen reader announcements unless marked with `aria-hidden="true"`.
**Action:** Explicitly style text inside light OAuth buttons (`text-dark`) and ensure decorative icons inside labeled action buttons include `aria-hidden="true"`.

## 2026-09-20 - Global Focus Ring & Decorative Icon Hiding
**Learning:** FontAwesome icons embedded within text-labeled action buttons generate duplicate announcements unless hidden with `aria-hidden="true"`, and missing `:focus-visible` outline styles impair keyboard navigation across light/dark themes.
**Action:** Always add `aria-hidden="true"` to decorative icons inside labeled action buttons and maintain explicit `:focus-visible` focus rings for interactive components in `style.css`.

## 2026-10-15 - Dynamic Feedback in Static Utility Pages
**Learning:** Micro-game and interactive feedback components on fallback utility pages (`404.html`, `offline.html`) fail to announce result state changes to screen reader users unless containers include `aria-live="polite"` and `role="status"`.
**Action:** Ensure dynamic output or feedback containers on offline/error pages include `aria-live="polite"` and `role="status"`, and all controls have explicit `aria-label` attributes.
