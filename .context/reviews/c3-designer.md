# Cycle 3 — Designer (UI/UX)

**Date:** 2026-04-24
**Reviewer:** designer
**Scope:** Web frontend (apps/web/)

---

## C3-U01: WCAG `scope="col"` missing on OptimalCardMap, SavingsComparison, and ReportContent tables

- **Severity:** LOW
- **Confidence:** High
- **File+line:** `apps/web/src/components/dashboard/OptimalCardMap.svelte:81-86`, `apps/web/src/components/dashboard/SavingsComparison.svelte:279-283`, `apps/web/src/components/report/ReportContent.svelte:70-76,108-113`
- **Description:** C2-05 added `scope="col"` to CardDetail's rewards table, but the same WCAG 1.3.1 issue exists in three other tables: OptimalCardMap's main table, SavingsComparison's card breakdown table, and both tables in ReportContent. Screen readers need `scope` attributes to correctly associate header cells with data cells in data tables.
- **Failure scenario:** Screen reader users cannot determine column context when navigating these tables.
- **Fix:** Add `scope="col"` to all `<th>` elements in OptimalCardMap, SavingsComparison, and ReportContent tables.

## C3-U02: ReportContent empty-state link uses raw BASE_URL instead of buildPageUrl

- **Severity:** LOW
- **Confidence:** High
- **File+line:** `apps/web/src/components/report/ReportContent.svelte:138`
- **Description:** Same as C3-CR05. The "명세서 올리러 가기" link uses `import.meta.env.BASE_URL ?? '/'` directly. CategoryBreakdown (line 279) and OptimalCardMap (line 176) also use raw BASE_URL. These should use `buildPageUrl()` for consistency with FileDropzone and CardDetail.
- **Failure scenario:** If BASE_URL configuration changes, these links may produce incorrect URLs while FileDropzone/CardDetail links work correctly.
- **Fix:** Replace `import.meta.env.BASE_URL ?? '/'` with `buildPageUrl('')` in all three components.

---

## Final Sweep

WCAG accessibility is generally good across the application. The upload form has proper ARIA attributes (aria-busy, aria-label, role="group"), the step indicator uses aria-current="step", and card selection pills use aria-pressed. Loading skeletons provide visual feedback. The main gaps are the missing `scope="col"` attributes (C3-U01) and the inconsistent navigation link pattern (C3-U02). Dark mode support is present via Tailwind dark: variants. No contrast violations found in the primary color scheme.
