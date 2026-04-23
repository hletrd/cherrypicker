# Cycle 8 — tracer

## Inventory of dataflow edges

Upload dataflow:
`FileDropzone.handleUpload` → `analysisStore.analyze(files, {bank, previousMonthSpending})` → `analyzeMultipleFiles` → `parseAndCategorize` (per file) → merge → `optimizeFromTransactions` → greedy → result. Result persisted via `persistToStorage`.

Re-optimize dataflow:
`TransactionReview.save` → `analysisStore.reoptimize(editedTxs, options)` → snapshot → filter latest month → rebuild monthlyBreakdown → `optimizeFromTransactions` → result merge via snapshot spread.

SessionStorage persistence dataflow:
`persistToStorage(data)` → JSON.stringify → setItem → (if QUOTA_EXCEEDED) return 'corrupted'.
`loadFromStorage()` → getItem → JSON.parse → migrate → validate → set `_loadPersistWarningKind` module var → return `AnalysisResult`.

## Re-audit of module-level mutable state (D7-M6)

`_loadPersistWarningKind` and `_loadTruncatedTxCount` are module-level. They're SET by `loadFromStorage` and READ by the `createAnalysisStore` IIFE during store construction. They're RESET to null at line 379-380 after store construction (consumed).

Path that mutates them after construction:
- `reset()` at line 601-602 assigns `null` to both. Since construction already nullified them and nothing re-reads them (store is a singleton), this `reset` path is a no-op. **Confirmed D7-M1 dead code.**
- No other writer.

Testability concern (D7-M6): importing the module in a test with `vi.resetModules()` would re-trigger `createAnalysisStore()`, which would re-invoke `loadFromStorage()`. If another test wrote sessionStorage between, `_loadPersistWarningKind` would be set for the re-import but also read only once during construction. Correct behavior. No cross-test leakage confirmed.

**Keep D7-M6 deferred** — architectural refactor, no runtime failure mode.

## New tracer findings

### TR8-01 — `reoptimize` snapshot fix (C81-01) is correctly deployed

- File: `store.svelte.ts:506, :578-583`
- Verified: `const snapshot = result;` at line 506, then `...snapshot` at line 579. Async gaps between `await getCategoryLabels()` and `await optimizeFromTransactions(...)` cannot cause a state mismatch.
- No new finding.

### TR8-02 — `persistToStorage` path split for 'truncated' vs 'corrupted' vs 'error' is consistent

- File: `store.svelte.ts:146-191`
- Verified 3-way return. Consumer at :365-371 only treats non-null as warning. Distinguishing in UI is a separate feature.
- No new finding.

## Actionable: none (all new findings are confirms). Land D7-M1 cleanup in plan.
