# Cycle 6 — Designer (UI/UX)

**Date:** 2026-04-24
**Reviewer:** designer
**Scope:** Web frontend UI/UX

---

## C6-D01: Layout.astro nav links use raw BASE_URL (UI consistency)

- **Severity:** MEDIUM
- **Confidence:** High
- **File+line:** `apps/web/src/layouts/Layout.astro:54,64,68,72,76`
- **Description:** Confirms C6-CR01/C6-A01 from a UX perspective. Navigation is the primary user interaction with layout chrome. If BASE_URL breaks, all navigation fails simultaneously — this is worse than a single page having broken links because it affects the entire site shell. The `buildPageUrl()` migration should be completed for the layout.

---

## Final Sweep

UI patterns are consistent and well-implemented:
- Skip-to-content link present (Layout.astro:49)
- ARIA labels on interactive elements (bank pills, category selects, theme toggles)
- Dark mode support with proper contrast adjustments
- Print stylesheet for report page
- Mobile responsive navigation with hamburger menu
- Loading/empty/error states handled across all components
- Keyboard navigation supported (tabindex, onkeydown handlers)
- prefers-reduced-motion respected (SavingsComparison count-up animation)
- WCAG AA contrast ratios documented in comments (green-700 on white, blue-600 on blue-50)
