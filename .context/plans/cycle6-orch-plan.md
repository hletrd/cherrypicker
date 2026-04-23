# Cycle 6 orchestrator plan — UI/UX deep-dive + optimizer fixture regression

Scope: implementation plan for findings surfaced in `.context/reviews/cycle6-*.md`
and `cycle6-ui-ux-deep.md`. Sized for a single cycle-6 iteration.

## In-scope (implement this cycle)

### P1-01 — Fix Playwright UI/UX spec port mismatch (C6UI-01) [HIGH]
- Files: `e2e/ui-ux-review.spec.js`, `e2e/ui-ux-screenshots.spec.js`.
- Action: replace hardcoded `http://127.0.0.1:4174/cherrypicker/` with `http://127.0.0.1:4173/cherrypicker/`.
- Verify: run `bunx playwright test e2e/ui-ux-review.spec.js --reporter=line`; expect failures to reduce from 57 connection-refused to a smaller set of copy/data-driven failures.
- Exit criterion: specs connect successfully; subsequent failures are about test content not connectivity.

### P1-02 — Unblock core-regressions fixture vs rule-matching (C6UI-40) [HIGH]
- Files: `e2e/core-regressions.spec.js`.
- Action: change 스타벅스 transaction to remove `subcategory: 'cafe'` so the broad-dining rule can match it (keeping the documented business rule). Keep 메가커피 as cafe subcategory to test the specific-merchant cafe rule.
- Verify: `bunx playwright test e2e/core-regressions.spec.js --reporter=line` passes 2/2.

### P1-03 — Data-loss guardrail on upload (C6UI-16) [HIGH]
- Files: `apps/web/src/components/upload/FileDropzone.svelte`.
- Action: add a `beforeunload` listener installed when `uploadStatus === 'uploading'` begins and removed in the `finally` branch of `handleUpload()`. The listener's handler returns a non-empty string.
- Verify: static inspection; Playwright coverage can follow once testids land.

### P1-04 — Clamp 전월실적 input (C6UI-34) [HIGH]
- Files: `apps/web/src/components/upload/FileDropzone.svelte`.
- Action: add `max="10000000000"` on the numeric input. Clamp inside `parsePreviousSpending` via `Math.min(n, 10_000_000_000)` before returning.
- Verify: static inspection; unit-test-able in follow-up.

### P1-05 — Collapse amber/red class stacking (C6UI-08) [HIGH]
- Files: `apps/web/src/components/dashboard/TransactionReview.svelte`.
- Action: rewrite the conditional class so `uncategorized` short-circuits `confidence < 0.5`.

### P1-06 — Align test copy with UI copy (C6UI-06) [MEDIUM]
- Files: `e2e/ui-ux-review.spec.js`.
- Action: change `getByText('총 지출')` to `getByText('최근 월 지출')` in the Dashboard test block.

### P1-07 — Share `cherrypickerPrint()` between results + report (C6UI-13) [MEDIUM]
- Files: add `apps/web/public/scripts/print.js`; update `apps/web/src/pages/results.astro`, `apps/web/src/pages/report.astro`.
- Action: factor the theme-strip+print helper into a shared script; include it in Layout.astro; call `cherrypickerPrint()` from both pages.

### P1-08 — Stepper ARIA cleanup (C6UI-02) [MEDIUM]
- Files: `apps/web/src/components/upload/FileDropzone.svelte`.
- Action: replace the outer `<div role="progressbar">` with `<ol>` + `<li aria-current>` on the active step; drop `aria-valuenow/min/max`.

### P1-09 — Bank-pill `aria-pressed` (C6UI-20) [MEDIUM]
- Files: `apps/web/src/components/upload/FileDropzone.svelte`.
- Action: add `aria-pressed={bank === b.value}` to each bank button and to the "자동 인식" button.

### P1-10 — Disclosure ARIA for TransactionReview toggle (C6UI-09) [MEDIUM]
- Files: `apps/web/src/components/dashboard/TransactionReview.svelte`.
- Action: add `aria-expanded={expanded}` + `aria-controls="tx-review-panel"`; assign `id="tx-review-panel"` to the disclosed container.

### P1-11 — Error banner role=alert (C6UI-35) [MEDIUM]
- Files: `apps/web/src/components/upload/FileDropzone.svelte`.
- Action: add `role="alert"` on the error `<div>` rendered when `uploadStatus === 'error'`.

### P1-12 — Dashboard grid breakpoint (C6UI-27) [MEDIUM]
- Files: `apps/web/src/pages/dashboard.astro`.
- Action: `grid-cols-1 lg:grid-cols-2` → `grid-cols-1 md:grid-cols-2`.

### P1-13 — TransactionReview horizontal overflow (C6UI-26) [MEDIUM]
- Files: `apps/web/src/components/dashboard/TransactionReview.svelte`.
- Action: wrap the table scroll container with `overflow-x-auto` and add `min-w-max` on the table.

### P1-14 — Contrast: text-blue-500 → text-blue-600 + text-green-600 → text-green-700 (C6UI-22, C6UI-31) [MEDIUM]
- Files: `apps/web/src/components/dashboard/SavingsComparison.svelte`, `SpendingSummary.svelte`, `FileDropzone.svelte`.
- Action: replace the offending utilities in the specific lines flagged in the reviews.

### P1-15 — Seed minimal `data-testid` attributes (C6UI-38) [HIGH, partial-scope first pass]
- Files: Layout.astro, FileDropzone.svelte, SpendingSummary.svelte, SavingsComparison.svelte, CardGrid.svelte, dashboard.astro, results.astro.
- Action: add testids on: stepper container+steps, bank pills, file-remove button, previous-spending input, analysis-start button, top summary cards, savings numbers, bar-chart container, transaction-toggle, optimal-card map container, results stats (3), card grid cards, theme toggle, mobile menu button.
- Rationale: testids must exist BEFORE meaningful regressions can be guarded.

## Deferred items

The remaining findings in `cycle6-ui-ux-deep.md` (C6UI-03, 04, 05, 07, 10, 11, 12, 14, 15, 17, 18, 19, 21, 23, 24, 25, 28, 29, 30, 32, 33, 36, 37, 39) are deferred to subsequent cycles because (a) they are MEDIUM/LOW severity and (b) cycle-6 implementation capacity is constrained by gate runtime (playwright build + full e2e).

For each deferred item the review file (`cycle6-ui-ux-deep.md`) already carries file+line citation, original severity/confidence, the failure mode (concrete scenario or WCAG/HIG clause), and the fix sketch. No severity was downgraded to justify deferral. No security / correctness / data-loss finding is deferred — every HIGH-severity item is scheduled in-scope above. WCAG AA failures that are not scheduled are specifically the contrast items P1-14 handles plus C6UI-04, C6UI-05 (non-text contrast), and C6UI-23 (target size) — these are deferred per severity/scope triage: C6UI-04 and C6UI-05 are LOW; C6UI-23 already meets SC 2.5.8 at exactly 24×24 and is deferred to a future polish cycle (exit criterion: upgrade to 44×44 for WCAG AAA).

The deferred list above is scoped only to findings introduced this cycle; no pre-existing deferred items are moved without their own exit criteria.

## Verification plan

1. After P1-01, P1-02 land: `bunx playwright test e2e/core-regressions.spec.js` → 2/2 pass.
2. `bun run verify` → lint+typecheck+unit tests pass.
3. `bun run build` → turbo build succeeds.
4. `bun run test:e2e` → full suite runs; record any remaining failures as follow-up plan items.

## Archive sweep

No pre-existing plans are fully implemented-and-done this cycle (this is the first pass of the UI/UX deep dive). Archive pass deferred.
