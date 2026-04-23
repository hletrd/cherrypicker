# Cycle 6 — debugger

## Latent bug surface & regressions

1. **(HIGH, High) C6UI-40 — e2e/core-regressions.spec.js:149 fails with "Received length: 1".**
   Reproduction:
   ```
   $ bunx playwright test e2e/core-regressions.spec.js --reporter=line
   1 passed
   1 failed: optimizer uses transaction-level facts and keeps card totals aligned
   ```
   Failure mode: `greedyOptimize` returns a single assignment for the two cafe transactions because the broad-dining fixture's rule cannot match subcategorized transactions (per `reward.ts:67-80` logic).

2. **(HIGH, High) C6UI-01 — Port mismatch silently reduces test coverage to zero.**
   Reproduction:
   ```
   $ bunx playwright test e2e/ui-ux-review.spec.js --reporter=line
   58 failed (all with ERR_CONNECTION_REFUSED http://127.0.0.1:4174/...)
   ```

3. **(MEDIUM, High) C6UI-06 — label mismatch silently broke "총 지출" assertion.**
   Mode: copy changed in SpendingSummary.svelte:74 without updating the spec; the port-mismatch (C6UI-01) hides the failure so no one noticed.

4. **(MEDIUM, Medium) web-regressions spec:30 timeouts waiting for dashboard URL.**
   Possible root causes:
   - Spinner hung because `analysisStore.error` is set but the spinner UI does not flip to error (but FileDropzone does check `analysisStore.error` at `:245`).
   - Navigate-to-dashboard timing fires before the URL change because `import('astro:transitions/client')` is async and `navigate()` might resolve slower than 30s only if the site's `_astro/` chunk is cold-cached in the preview server.
   - Genuine analyzer hang on the `regression-upload.csv` fixture (unlikely — it has ~50 txs).
   Deferred to cycle 7 as an observational Medium/Medium lead.

5. **(LOW, High) `TransactionReview.svelte:123-139` `$effect` reads `analysisStore.result` THEN `analysisStore.generation`.**
   The snapshot is consistent per Svelte 5 reactivity, BUT reading `.result` via a getter that returns a fresh object could cause `.result` to momentarily be non-null while `.generation` has not yet advanced. The code defensively checks `gen !== lastSyncedGeneration`, so behavior is correct. No action.

6. **(LOW, Medium) `SavingsComparison.svelte:88` `return () => { cancelled = true; cancelAnimationFrame(rafId); };`**
   If `rafId` is undefined before `tick` runs (cleanup fired before first frame), `cancelAnimationFrame(undefined)` is spec-safe; no bug.

## Regressions introduced by recent commits (compared to git log)
- None of the last 20 commits directly touch FileDropzone.svelte, reward.ts, or the e2e spec port. The port discrepancy predates the log window — likely stale since port 4174 was used historically.

## Fix order
1. C6UI-01 (unblocks diagnostics).
2. C6UI-40 (unblocks CI).
3. All other findings (can be verified incrementally once 1 and 2 land).
