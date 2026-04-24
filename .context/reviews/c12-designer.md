# Designer (UI/UX) — Cycle 12

**Date:** 2026-04-24
**Reviewer:** designer

## Findings

### C12-UX01: `CategoryBreakdown` hover expansion not discoverable on mobile [LOW]
- **File:** `apps/web/src/components/dashboard/CategoryBreakdown.svelte:203-275`
- **Description:** The category breakdown rows expand on hover (mouseenter) to show detailed tooltips. On touch devices, the `onclick` handler (line 218) also triggers expansion, so the feature works on mobile. However, there is no visual affordance (chevron, arrow, or "tap to expand" hint) indicating that rows are expandable. Users may not discover the detailed breakdown.
- **Confidence:** Medium
- **Severity:** LOW

### C12-UX02: `SpendingSummary` warning banner dismiss button has no visible focus ring [LOW]
- **File:** `apps/web/src/components/dashboard/SpendingSummary.svelte:158`
- **Description:** The dismiss button in the data-loss warning banner uses inline styles and Tailwind classes but lacks an explicit focus ring. Keyboard-only users may not be able to see when the button has focus.
- **Confidence:** High
- **Severity:** LOW

### C12-UX03: `FileDropzone` step indicator uses `aria-current="step"` correctly [INFORMATIONAL]
- **File:** `apps/web/src/components/upload/FileDropzone.svelte:331`
- **Description:** The step indicator uses `aria-current="step"` on the active step, which is correct per WAI-ARIA APG. The stepper also uses an ordered list (`<ol>`) for semantic structure. This is well-implemented.
- **Confidence:** High
- **Severity:** INFORMATIONAL (positive finding)

### C12-UX04: TransactionReview table horizontal scroll without scroll indicator [LOW]
- **File:** `apps/web/src/components/dashboard/TransactionReview.svelte:272`
- **Description:** The transaction table has `overflow-x-auto` for narrow viewports, but there is no visual indicator (fade gradient, scrollbar hint) that horizontal scrolling is available. Users on narrow screens may not realize there are more columns.
- **Confidence:** Medium
- **Severity:** LOW

## Convergence Note

All findings are LOW-severity UX polish items. No WCAG AA failures or critical usability issues. The app correctly uses semantic HTML, ARIA attributes, and keyboard navigation. The `prefers-reduced-motion` check in SavingsComparison (line 59-61) is a positive accessibility pattern.
