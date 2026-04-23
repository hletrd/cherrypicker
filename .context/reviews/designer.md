# Cycle 6 — Designer review (UI/UX)

Primary detailed report is in `cycle6-ui-ux-deep.md`. This file is the
designer-lane summary, kept for provenance.

## Method
- Static inspection of all `apps/web/src/pages/*.astro` and `components/**` Svelte islands.
- Playwright runs against the preview server:
  - `bunx playwright test e2e/ui-ux-review.spec.js` → 57/57 connection-refused because the spec hard-codes port 4174 while the config serves on 4173 (C6UI-01).
  - `bunx playwright test e2e/web-regressions.spec.js` → dashboard upload flow timeout (related; fixture+optimizer regression).
  - `bunx playwright test e2e/core-regressions.spec.js` → 1/2 failing, unrelated to UI but surfaced during the run (C6UI-40).

## Highest-impact findings (see cycle6-ui-ux-deep.md for the full set)
- HIGH C6UI-01: UI/UX e2e spec BASE hardcoded to `:4174` but server is on `:4173`. Every test errors. Fix: align to 4173 or read from env.
- HIGH C6UI-08: TransactionReview select stacks amber+red class fragments when a tx is uncategorized AND low-confidence; fix with a short-circuit ternary.
- HIGH C6UI-16: upload flow has no `beforeunload` guard during `uploadStatus === 'uploading'`; refresh discards in-flight analysis.
- HIGH C6UI-34: 전월실적 input has no `max`, no clamping, no inline error. A 10-digit slip passes into the optimizer.
- HIGH C6UI-38: zero `data-testid` attributes; tests rely on Korean text and break silently when copy changes.
- MEDIUM C6UI-02: step indicator uses `role="progressbar"` incorrectly; replace with `<ol>` + `aria-current="step"`.
- MEDIUM C6UI-09: "거래 내역 확인" disclosure lacks `aria-expanded` and `aria-controls`.
- MEDIUM C6UI-10: CategoryBreakdown rows claim `role="button"`+`aria-expanded` but the interaction is decorative only.
- MEDIUM C6UI-20: bank pills lack `aria-pressed`.
- MEDIUM C6UI-22: `text-blue-500` on `from-blue-50/from-blue-100` fails WCAG AA 4.5:1 for small text (3.03:1–4.14:1).
- MEDIUM C6UI-26: TransactionReview table overflows horizontally at 320px (no `overflow-x-auto`).
- MEDIUM C6UI-27: dashboard grid jumps straight to 2-col at `lg:` (1024px); use `md:` (768px).
- MEDIUM C6UI-31: `text-green-600` fails 4.5:1 on white; use `text-green-700`.
- MEDIUM C6UI-35: error banner lacks `role="alert"` / live region.

## Lower-severity notes
- LOW C6UI-04: step connector + inactive badge `--color-border` against `--color-bg` = 1.12:1, non-text UI fails 3:1.
- LOW C6UI-13: results page uses raw `window.print()`; report page uses `cherrypickerPrint()` which strips `.dark` first — inconsistency produces near-black PDFs if user prints from /results in dark mode.
- LOW C6UI-14: `afterprint` single-fire listener does not restore `.dark` on cancelled print.
- LOW C6UI-23: "파일 제거" button is exactly 24×24 — at WCAG 2.5.8 minimum; bump to 28 for safety.
- LOW C6UI-28: CategoryBreakdown skeleton always renders 6 rows.
- LOW C6UI-32: left/right physical properties would need logical-property migration for RTL.

## Deferred (severity preserved)
None — all actionable findings are included in the cycle6 plan. See plan file for deferral rules.
