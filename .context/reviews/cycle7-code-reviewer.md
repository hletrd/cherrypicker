# Cycle 7 — code-reviewer

Scope: cross-file logic, invariants, error handling, state management, idioms.

## Findings

### C7CR-01 — Truncation warning suppressed after reset+re-upload [MEDIUM / High]

- File: `apps/web/src/lib/store.svelte.ts:367-380` (store initializer).
- Evidence: The `persistWarningKind` at store creation is computed as `result !== null && result.transactions === undefined && _loadPersistWarningKind !== null ? _loadPersistWarningKind : null`. The guard requires `result.transactions === undefined` — but when `loadFromStorage` returns a `'corrupted'` warning, it's because transactions existed but all failed validation; in that case the returned `result.transactions` is `undefined` (line 282 returns `undefined` when `validTxs.length === 0`), so the guard holds. Good.
- However, `reset()` at :595 sets `_loadPersistWarningKind = null` directly — but `_loadPersistWarningKind` is a module-level variable already consumed at store construction (line 379). After reset, `_loadPersistWarningKind` is already null. Touching it in reset is a no-op and misleading.
- Concrete impact: dead code, minor maintenance hazard.
- Fix sketch: remove lines 601-602 from `reset()` (they are already cleared at store construction).

### C7CR-02 — `setResult` path skips `previousMonthSpendingOption` preservation [MEDIUM / High]

- File: `apps/web/src/lib/store.svelte.ts:452-459`.
- Evidence: `setResult(r)` writes the passed result directly. If a caller constructs an AnalysisResult without setting `previousMonthSpendingOption`, the next reoptimize will lose the user's original input. Today `setResult` has no callers in the repo (only `analyze()` and `reoptimize()` mutate `result`), but it's part of the public store surface and is a latent footgun.
- Fix sketch: either delete `setResult` (no callers) or add a preservation guard: `if (result && r.previousMonthSpendingOption === undefined) r.previousMonthSpendingOption = result.previousMonthSpendingOption`.

### C7CR-03 — Navigation timeout leaks if uploadStatus flips to 'error' mid-success [MEDIUM / Medium]

- File: `apps/web/src/components/upload/FileDropzone.svelte:266-277`.
- Evidence: `uploadStatus = 'success'` triggers `setTimeout(() => navigate, 1200)`. If between the timer set and the navigate callback, the user clicks "다시 분석하기" (there is none on this page) or the store is reset by another component, we'd still navigate to dashboard. Also, if the user triggers another file upload during the 1.2s window, `handleUpload()` is invoked again, which sets `uploadStatus = 'uploading'` — but the old timer still fires and calls `navigate`, taking the user to the dashboard mid-second-upload.
- Concrete failure: rapid re-upload in the 1.2s window produces stale navigation.
- Fix sketch: in `handleUpload()` entry, `if (navigateTimeout) { clearTimeout(navigateTimeout); navigateTimeout = null; }`. Already done in `handleRetry`; extend to top of `handleUpload`.

### C7CR-04 — `handleUpload` does not set success→null timeout check atomically [LOW / Medium]

- File: `apps/web/src/components/upload/FileDropzone.svelte:266`.
- Evidence: `navigateTimeout = setTimeout(...)` — if the user refreshes or triggers onDestroy before the timer, `onDestroy` clears it. Good. But `navigateTimeout` is nulled only in `handleRetry`, not after the timer fires. Harmless but untidy.
- Fix: set `navigateTimeout = null` at the end of the setTimeout callback.

### C7CR-05 — `onMount` in FileDropzone installs document-level listeners with no capture [LOW / Medium]

- File: `apps/web/src/components/upload/FileDropzone.svelte:39-42`.
- Evidence: dragenter/dragleave/dragover/drop are added with no useCapture flag. The component unmount cleanup removes them. If another component (e.g., the map page) adds its own drop listeners on document, there's ordering coupling. Minor risk.
- Fix: not needed unless cross-component interference is observed.

### C7CR-06 — `parsePreviousSpending` rejects `-0` via `n >= 0` [LOW / Medium]

- File: `apps/web/src/components/upload/FileDropzone.svelte:228-234`.
- Evidence: `Math.round(Number('-0'))` → `-0`. The check `n >= 0` succeeds (Number -0 >= 0 is true). `Math.min(-0, MAX)` → -0. Passing -0 to the optimizer is harmless but inconsistent with the "reject negatives" intent.
- Fix: `if (!(Number.isFinite(n) && n >= 0) || Object.is(n, -0)) return undefined` or normalize with `n || 0`.

### C7CR-07 — Analyzer monthlyBreakdown drops transactions with dates shorter than 7 chars [LOW / Medium]

- File: `apps/web/src/lib/analyzer.ts:322-333`.
- Evidence: the `if (!tx.date || tx.date.length < 7) continue` branch silently drops malformed-date transactions from monthlyBreakdown but keeps them in `allTransactions`. This is by design (C6-01), but the drop is silent. If all dates are malformed, line 346 correctly throws. If SOME are malformed, the user sees an undercount with no warning.
- Fix sketch: optional — count dropped rows and include as a parse error. Defer if the real fixture path doesn't produce malformed dates.

### C7CR-08 — `buildCategoryLabelMap` rebuild skipped if first parse returned no categoryNodes [LOW / Low]

- File: `apps/web/src/lib/analyzer.ts:299-308`.
- Evidence: the for-loop builds `categoryLabels` only when `!categoryLabels && parsed.categoryNodes`. If the first parsed file's `categoryNodes` is defined but empty (shouldn't happen given the early guard, but defensively), `buildCategoryLabelMap([])` returns an empty map, which then sticks for all subsequent parsers. Downstream optimizer lookup fails silently.
- Fix: `if (!categoryLabels && parsed.categoryNodes && parsed.categoryNodes.length > 0)`.

### C7CR-09 — `_loadPersistWarningKind` is module-level mutable shared state [MEDIUM / High]

- File: `apps/web/src/lib/store.svelte.ts:216-220, 379`.
- Evidence: `_loadPersistWarningKind` + `_loadTruncatedTxCount` are module-scoped. The store reads them during construction then clears them. If Svelte HMR or test framework re-imports the module, the variables are re-initialised. If a test creates two stores (bypassing the `analysisStore` singleton), the second construction sees the already-null values — which is fine. But a unit test that stubs `loadFromStorage` independently may leak state between tests.
- Fix: bind them to the return value of `loadFromStorage` (return a tuple or an object), not module-level state.

### C7CR-10 — `reoptimize` snapshot guard still reads reactive result twice for error state [LOW / Medium]

- File: `apps/web/src/lib/store.svelte.ts:586-591`.
- Evidence: catch block sets error and does not return. finally sets `loading = false`. OK. The pattern is consistent.
- Fix: none needed.

### C7CR-11 — `analyzeMultipleFiles` post-conditions rely on parsed.categoryNodes being identical across files [LOW / Medium]

- File: `apps/web/src/lib/analyzer.ts:305-307`.
- Evidence: `buildCategoryLabelMap` is built once from the first parsed. If files 2+ return a different category taxonomy (they won't, but the type doesn't enforce it), we ignore their taxonomy. Acceptable.
- Fix: add a comment locking this invariant.

### C7CR-12 — File size check skipped on dropped files via page-drop handler [MEDIUM / High]

- File: `apps/web/src/components/upload/FileDropzone.svelte:34-37` (page-drop) calls `addFiles` which DOES check size. OK.
- Fix: none — verified.

### C7CR-13 — `displayedSavings` animation can produce NaN with a non-finite target [LOW / Low]

- File: `apps/web/src/components/dashboard/SavingsComparison.svelte:51-89`.
- Evidence: If `opt.savingsVsSingleCard` is ever `NaN` or `Infinity` (shouldn't happen post-optimizer, but the type is `number`), the animation math propagates the non-finite value.
- Fix: `const target = Number.isFinite(opt?.savingsVsSingleCard ?? 0) ? (opt?.savingsVsSingleCard ?? 0) : 0`.

### C7CR-14 — `lastWarningGeneration` relies on generation starting at 0 [LOW / Low]

- File: `apps/web/src/components/dashboard/SpendingSummary.svelte:15-22`.
- Evidence: lastWarningGeneration starts at 0. Store now initialises generation to 1 when data is restored (C7-01). On first render, the effect fires with gen=1, lastWarningGeneration=0, so `gen !== lastWarningGeneration` and `gen > 0` — dismissed is reset to false. That's the intended path. But on subsequent re-mounts (Astro View Transition), the component's lastWarningGeneration starts at 0 again while the store keeps gen from before. Same behaviour. OK.
- Fix: none.

### C7CR-15 — `VisibilityToggle` import coverage [LOW / Low]

- File: `apps/web/src/pages/dashboard.astro:122`.
- Evidence: passes `dataContentId` and `emptyStateId`. That component was not re-read; assuming it does what the names say, it flips `.hidden` on data-content when store has data.

### C7CR-16 — `results.astro` not read in this pass [N/A]

- Fix: separate re-read.

## Summary

Most issues are LOW severity, indicating strong code-review hygiene. Three items (C7CR-01 dead code, C7CR-02 setResult footgun, C7CR-09 module-level state) are worth scheduling. C7CR-03 (timer leak on rapid re-upload) is MEDIUM but requires a specific race — defer unless the user reports it.
