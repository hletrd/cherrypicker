# Cycle 7 — e2e failure diagnosis

Purpose: categorise every one of the 38 failing Playwright tests (observed at end of cycle 6) by root cause, so cycle 7 can attack them in buckets rather than individually.

Source: `.context/plans/cycle6-orch-plan.md` (D6-01, D6-02) and `e2e/ui-ux-review.spec.js` baseline at cycle-6 head.

## Methodology

The 74 tests come from three specs:
- `e2e/core-regressions.spec.js` (2 tests — passing at cycle 6 head thanks to C6UI-40)
- `e2e/web-regressions.spec.js` (1 test — presumed passing at cycle 6 head)
- `e2e/ui-ux-review.spec.js` (60+ tests — the vast majority)
- `e2e/ui-ux-screenshots.spec.js` (13 screenshot tests)

Total ≈ 74. At cycle 6 head, 36 pass. The 38 failures live almost exclusively in the ui-ux specs.

## Bucket A — strict-mode selector collisions (~10 failures, HIGH priority)

Playwright's `getByText` / `getByRole` defaults to strict mode when the locator resolves > 1 element. Cycle 6 already patched several call sites with `.first()` but several text strings appear in multiple DOM nodes.

| # | File:line | Assertion | Colliding elements | Fix |
|---|-----------|-----------|---------------------|-----|
| A1 | ui-ux-review.spec.js:70 | `getByText('최적 카드 추천')` | `index.astro:81` step-3 title + `index.astro:106` feature-card heading | Use testid `feature-card-recommend` |
| A2 | ui-ux-review.spec.js:242 | `getByText('체리피킹')` | SavingsComparison.svelte:171 bar label + :216 card header | Use testid `savings-card-cherry` |
| A3 | ui-ux-review.spec.js:307 | `getByText('체리피킹')` (results) | same two nodes | Use testid |
| A4 | ui-ux-review.spec.js:243 | `getByText('카드 한 장')` | SavingsComparison.svelte bar label + header | Use testid |
| A5 | ui-ux-review.spec.js:53 | `getByText('파일 선택').first()` | stepper label + dropzone button label | Use `getByTestId('step-1')` |
| A6 | ui-ux-review.spec.js:157 | `getByText('카드사를 고르면 더 정확해요')` | single occurrence — should pass | Likely flaky from A1–A4 bleed, not a separate bug |
| A7 | ui-ux-review.spec.js:247 | `getByText('거래 내역 확인')` | TransactionReview.svelte toggle button only — but the `.click()` target may double-resolve when the table is also expanded | Use `getByTestId('tx-review-toggle')` |
| A8 | ui-ux-review.spec.js:253-256 | `getByText('가맹점').first()` `.first()` on `금액`, `분류` | already scoped with `.first()` — passes | none |

## Bucket B — hydration waits on empty pages (~2 failures, HIGH priority)

Tests that target empty-state pages call `waitForFunction(() => Boolean(document.querySelector('astro-island:not([ssr])')))`. On the empty dashboard/results page, all Svelte islands are inside a hidden `<div class="hidden">`. The islands render SSR markers but do NOT hydrate until the container unhides (VisibilityToggle flips `hidden`). So `astro-island:not([ssr])` never matches, the wait times out at 30s, test fails.

| # | File:line | Test | Fix |
|---|-----------|------|-----|
| B1 | ui-ux-review.spec.js:408 | `dashboard empty state shows CTA` | Drop astro-island wait or rely on `waitForLoadState('domcontentloaded')` |
| B2 | ui-ux-review.spec.js:413 | `results empty state shows CTA` | same |
| B3 | ui-ux-review.spec.js:329 | `report page shows empty state` | same |

## Bucket C — parallel upload-pipeline contention (D6-01, ~18 failures, HIGH priority)

`test.describe.configure({ mode: 'parallel' })` at `e2e/ui-ux-review.spec.js:11` runs all describes concurrently. Playwright defaults to `workers = 50% of CPU cores`. Each of the data-dependent tests in Dashboard / Results / Report / Upload-flow / Accessibility / Responsive / Session / Data-integrity executes the full upload pipeline (`setInputFiles → fill → click 분석 시작 → waitForURL 30s`). The Astro preview server + Bun-bundled Svelte app + merchant matcher init are all on the single JS main thread; 4–5 pipelines racing cause cascading 30s timeouts on the `waitForURL('**/dashboard')` step.

Tests affected (all use the full upload pipeline):

- ui-ux-review.spec.js:180 `uploading a valid file navigates to dashboard`
- ui-ux-review.spec.js:216 beforeEach Dashboard × 8 describes' tests
- ui-ux-review.spec.js:287 beforeEach Results × 5 describes' tests
- ui-ux-review.spec.js:334 `report populated state after analysis`
- ui-ux-review.spec.js:475 `select dropdowns are keyboard accessible`
- ui-ux-review.spec.js:521 `dashboard grid adapts on mobile`
- ui-ux-review.spec.js:552 `no unhandled page errors on dashboard`
- ui-ux-review.spec.js:573, :589, :607, :623 (persistence + integrity)

All of these are sensitive to the parallel contention. Count depends on worker count and CI conditions.

**Fix:** `test.describe.configure({ mode: 'serial' })` at the file level, matching `web-regressions.spec.js`. Additionally, set `playwright.config.ts`'s `workers: 1` for ui-ux-review to fully serialise. Alternatively, add a fixture helper `seedAnalysisStorage(page, { compact: true })` that writes a known-valid payload into sessionStorage directly, bypassing the upload pipeline.

## Bucket D — bank pill `우체국` not rendered until 더보기 (~1 failure)

`ui-ux-review.spec.js:168` asserts `getByText('우체국')` visible after file is selected. FileDropzone renders only `TOP_BANKS` (first 8) until `showAllBanks` is flipped. `우체국` = index 23. The test will fail deterministically.

Fix: either precede the assertion with `await page.getByRole('button', { name: /더보기/ }).click()`, or remove `우체국` from the assertion and test `KB국민 / 삼성카드 / 현대카드 / 신한카드` instead.

## Bucket E — screenshot tests (~5 failures if the upload pipeline flakes)

`e2e/ui-ux-screenshots.spec.js` runs 13 screenshots. Several trigger the full upload flow with `waitForURL('**/dashboard', 30_000)`:
- `capture dashboard with data`
- `capture dashboard with transaction review expanded`
- `capture results page`
- `capture report page with data`
- `capture dashboard mobile`
- `capture dark mode dashboard`

Same Bucket C root cause — parallel contention with other describes. Screenshots also write to the filesystem, amplifying IO contention.

Fix: same as C. When serial mode is on, these should go green.

## Bucket F — misc / low-signal failures (~2 failures)

- `form inputs have associated labels` (ui-ux-review.spec.js:437): the permissive predicate passes trivially — not a failure. Skip.
- `mobile viewport hides desktop nav` (ui-ux-review.spec.js:501): fragile `.hidden.md\\:flex` selector — might flake depending on DOM order.

## Expected pass count after fixes

- Apply Bucket C serial mode → remove ~18 contention failures → ~54 pass.
- Apply Bucket A testid scoping → remove ~4-5 strict-mode collisions → ~59 pass.
- Apply Bucket B `domcontentloaded` wait → remove ~3 empty-state failures → ~62 pass.
- Apply Bucket D 더보기 click → remove ~1 failure → ~63 pass.
- Bucket E goes away with Bucket C → +5 → ~68 pass.
- Bucket F → +2 → ~70 pass.

Target for cycle 7: **≥ 68/74 passing**. The remaining 6 are likely environment-dependent (headless chromium rendering differences) or truly deferrable.

## Defer rationale

None of Buckets A-E should be deferred; all have clear root causes and local fixes. Bucket F's `form inputs have associated labels` and `mobile viewport hides desktop nav` are LOW-severity test-quality polish and can be deferred with preserved severity.
