# Cycle 10 — tracer

## Scope
- Trace the upload → analyze → dashboard → reoptimize data flow.
- Verify state transitions remain deterministic.

## Flow traced

1. `FileDropzone.handleUpload` (FileDropzone.svelte:266)
   → install `beforeUnloadGuard` (:270)
   → `analysisStore.analyze(uploadedFiles, { bank, previousMonthSpending: parsePreviousSpending(raw) })` (:273-276)
   → `analyzeMultipleFiles` constructs shared `MerchantMatcher`, parses each file, merges, optimizes latest month.
   → `result = analysisResult`, `generation++`, `persistToStorage(...)`.
   → FileDropzone checks `analysisStore.error` (:280-284) and either shows error OR triggers success state + 1200ms navigate timer.
   → Remove `beforeUnloadGuard` in finally (:309).
2. Dashboard (`dashboard.astro` → Svelte islands) reads `analysisStore.result` + derived getters.
3. `TransactionReview.svelte` `$effect` syncs `editedTxs` from `store.transactions` when `generation !== lastSyncedGeneration` (C7-01 fix ensures post-refresh generation starts at 1 if restored from sessionStorage).
4. On category edit, `TransactionReview` calls `analysisStore.reoptimize(editedTxs)`:
   → early null-guard (:485-489)
   → snapshot `result` (:497)
   → `getCategoryLabels()` (cache-hit path) (:499)
   → filter to latest month (:503-506)
   → rebuild monthlyBreakdown (:513-533)
   → compute previousMonthSpending (:541-557)
   → `optimizeFromTransactions` returns with `cachedCoreRules` hit
   → `result = { ...snapshot, transactions: editedTransactions, optimization, monthlyBreakdown }`, `generation++`, persist.

### T10-00 — No deviations from the documented flow [High]
All callsites preserve the invariant: `result` non-null ⇒ `optimization` non-null ⇒ `monthlyBreakdown` non-null. `generation++` is the single source of truth for UI re-sync. No new concurrency risks introduced since cycle 9.

## Confidence
High.
