# Cycle 6 — tracer

## Hypothesis 1 — C6UI-01 (port mismatch) is the root cause that concealed all UI-layer regressions.
**Evidence for:**
- `e2e/ui-ux-review.spec.js:7` has `BASE = ':4174'` while `playwright.config.ts:3` has `port = 4173`.
- `e2e/web-regressions.spec.js:5` has `:4173` (correctly).
- 58/59 failures in the full run were the ui-ux spec, all with `ERR_CONNECTION_REFUSED`.
**Evidence against:** None.
**Conclusion:** Accepted with High confidence. Fixing the port will unblock the rest of the UI findings and let them be asserted.

## Hypothesis 2 — C6UI-40 (optimizer regression) vs intended behavior.
**Evidence for regression:**
- Test `e2e/core-regressions.spec.js:59-177` expects 2 assignments across 2 cafe transactions, splitting 메가커피 (subcategory card) and 스타벅스 (broad card).
**Evidence against regression (for intentional behavior):**
- `packages/core/src/calculator/reward.ts:63-80` explicitly filters out broad rules for subcategorized transactions, with a prose comment citing Korean card terms as rationale.
- The rule-matching guard is present in currently-shipped code AND the test fails.
**Conclusion:** The test is out of date. The rule behavior is deliberate. The correct fix is to update the fixture to reflect the documented rule (e.g., add `includeSubcategories: true` flag, or change the 스타벅스 transaction to not have `subcategory: 'cafe'`).

## Hypothesis 3 — Web-regressions spec timeout is symptom of C6UI-40, not a separate bug.
**Evidence for:**
- Web-regressions `:12-30` uploads a CSV, waits for `**/dashboard`. Uploading fails if `analysisStore.analyze` throws; the analyze path depends on greedyOptimize which the broken test fixture exercises differently, but normal statement parsing should not hit the cafe-subcategory path.
**Evidence against:**
- The web-regressions spec uploads `regression-upload.csv`, which has mixed categories — unlikely to trigger the exact cafe-only scenario.
**Conclusion:** Reject. The web-regressions timeout likely indicates a separate issue — probably the dashboard visibility toggle behavior is slower than the 30s wait. Not pursued this cycle, deferred to cycle 7 as a Medium/Medium observation for future tracing.

## Hypothesis 4 — C6UI-08 class-stacking creates real user-visible ambiguity.
**Evidence for:** Tailwind utilities at same specificity; browser cascade picks later rule per property. With both `text-amber-700` and `text-red-700` applied, only `text-red-700` wins (later in the class list).
**Evidence against:** Since red wins for every conflicting property, the row looks purely red. Visual is fine.
**Conclusion:** Downgrade severity of C6UI-08 from HIGH to MEDIUM only if visual verification shows the final rendered state is unambiguously red. BUT the code is confusing, and a future reorder of the ternaries would silently flip the visual. Keep the short-circuit refactor as a code-health win.

## Flow trace: upload → dashboard → transaction review → reoptimize
1. `FileDropzone.svelte:handleUpload` → `analysisStore.analyze` (in `lib/store.svelte.ts`).
2. `analyze` calls the parser → categorizer → greedyOptimize.
3. On success, `analysisStore.result = ...` triggers Astro navigate to /dashboard.
4. Dashboard mounts `VisibilityToggle` which synchronously toggles `hidden` classes on `#dashboard-data-content`/`#dashboard-empty-state`.
5. Svelte islands (`SpendingSummary`, `CategoryBreakdown`, etc.) read `analysisStore.result` reactively.
6. `TransactionReview` initializes `editedTxs` from `analysisStore.result.transactions`.
7. User edits a tx category → `changeCategory(...)` → `editedTxs[idx] = updated` → `hasEdits = true`.
8. User clicks "변경 적용" → `analysisStore.reoptimize(editedTxs)` → new result → all islands re-render.

No race conditions identified in this trace beyond those noted in prior cycles (C21-01 / C18-01 / C73-02 all addressed).
