# Cycle 10 — Tracer

Date: 2026-04-24

## Causal tracing of suspicious flows

### Flow 1: User uploads file -> analyze -> reoptimize -> persist
- **Path:** FileDropzone.handleUpload() -> analysisStore.analyze() -> analyzeMultipleFiles() -> optimizeFromTransactions() -> greedyOptimize() -> buildConstraints() -> calculateRewards()
- **Suspicion:** Could `buildConstraints` receive stale transactions after the C9-06 fix (removal of shallow copy)?
- **Trace:** `buildConstraints` receives `categorized` (freshly mapped from `editedTransactions` in `reoptimize`, or from `parseAndCategorize` in `analyze`). `greedyOptimize` creates its own working copy at line 288 (`[...constraints.transactions].filter().sort()`). The removal of the redundant copy in `buildConstraints` is safe — the original array is never mutated.
- **Verdict:** No issue. C9-06 fix is safe.

### Flow 2: Store reset during active reoptimize
- **Path:** User clicks reset while reoptimize is in-flight
- **Suspicion:** Could the reoptimize callback write stale data after reset?
- **Trace:** `reoptimize()` captures `snapshot = result` at line 497 after the null guard. If `reset()` is called during the async gap (after `await getCategoryLabels()` but before `result = {...snapshot, ...}`), the snapshot is non-null but the store has been reset. The `result = {...snapshot, ...}` assignment would overwrite the null from reset with stale data.
- **Analysis:** This is the same scenario tracked as D-30. The `snapshot` pattern prevents mixing data from two analysis runs, but it doesn't prevent a reset from being overwritten by a stale in-flight reoptimize. However, the `generation++` at line 579 would cause TransactionReview to re-sync, and the stale data would be immediately visible as "old" results. The practical risk is low because reset and reoptimize are user-initiated and would require very specific timing.
- **Status:** ALREADY TRACKED (D-30)

### Flow 3: `loadCategories` returns [] on AbortError -> MerchantMatcher categorizes everything as uncategorized
- **Path:** `parseAndCategorize` -> `loadCategories()` -> AbortError -> [] -> throw Error
- **Trace:** The guard at analyzer.ts line 114-116 checks `nodes.length === 0` and throws, preventing the silent-wrong-results scenario. The C71-02 fix is intact.
- **Verdict:** No issue. C71-02 fix is safe.

### Flow 4: `cachedCoreRules` never cleared -> stale rules after cards.json update
- **Path:** `optimizeFromTransactions` -> `cachedCoreRules` check -> uses cached rules
- **Trace:** `cachedCoreRules` is set once per session when `loadCardsData()` first resolves. Since `cards.json` is a static asset built at deploy time, it cannot change within a session. The cache is invalidated by `invalidateAnalyzerCaches()` on `reset()`. No stale rules risk.
- **Verdict:** No issue.

## Competing hypotheses

None. All traced flows confirm correct behavior.

## Conclusion

Zero net-new causal flow issues. The C9-06 fix (shallow copy removal) and C71-02 fix (empty categories guard) are verified safe through causal tracing.
