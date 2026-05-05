# Cycle 24 Implementation Plan

## New Findings to Address

### C24-01 (MEDIUM): Installment NaN guard duplicated across 10 CSV bank adapters
- **File:** `apps/web/src/lib/parser/csv.ts` (lines 263-269, 332-338, 402-408, 472-478, 541-547, 610-616, 680-686, 749-755, 819-825, 889-894)
- **Problem:** The installment parsing logic (`parseInt(...)`, NaN check, `inst > 1` assignment) is duplicated across all 10 bank adapters. Each copy has the identical C8-10 comment. If the logic ever changes, all 10 copies must be updated. The xlsx parser already has a clean `parseInstallments()` helper (xlsx.ts:227-234) that could be used as a model.
- **Fix:** Extract a shared `parseInstallments(raw: unknown): number | undefined` helper function in csv.ts (following the same pattern as xlsx.ts:227-234). Replace all 10 duplicated blocks with calls to this helper. The helper handles both string and numeric input, returns `undefined` for NaN/<=1 values, and documents the "일시불" convention in one place.
- **Status:** DONE -- committed as `000000022b3de84caf81d863291903f869fe1e51`

### C24-02 (MEDIUM): clearStorage() silently swallows non-SSR errors
- **File:** `apps/web/src/lib/store.svelte.ts:264`
- **Problem:** `clearStorage()` has a bare `catch { /* SSR */ }` with no error logging. If sessionStorage removal fails for a non-SSR reason (e.g., SecurityError in a sandboxed iframe), the failure is silently swallowed with no diagnostic trail.
- **Fix:** Add a conditional `console.warn` for non-SSR failures. Check if the error is a SecurityError or other non-expected failure and log it. Keep the silent catch for genuine SSR environments (where `typeof sessionStorage === 'undefined'`).
- **Status:** DONE -- committed as `0000000e5eca49a90c0fba966bf1e8934c3050d4`

### C24-03 (LOW): SpendingSummary shows "0개월 전 실적" when monthDiff is 0
- **File:** `apps/web/src/components/dashboard/SpendingSummary.svelte:138`
- **Problem:** When `monthDiff === 0` (e.g., two monthlyBreakdown entries for the same month due to a data anomaly), the template shows "0개월 전 실적" which is confusing.
- **Fix:** Add a `monthDiff === 0` guard to the prevLabel derivation. Change the ternary to handle the zero case: `{@const prevLabel = !Number.isFinite(monthDiff) ? '이전 실적' : monthDiff === 0 ? '이전 실적' : monthDiff === 1 ? '전월실적' : `${monthDiff}개월 전 실적`}`.
- **Status:** DONE -- committed as `00000002a787db75df0800a7d10e89abc6282f7e`

## Previously Open Findings -- Assessment

### MEDIUM findings still open:
- **C8-01** (AI categorizer dead code): The 40-line stub documents the disabled state. TransactionReview comment is already one line. Removing the stub entirely risks losing the feature-flag intent. Could be addressed by removing the stub and adding a comment in TransactionReview pointing to the git history for re-enable instructions.
- **C18-01/C21-01** (VisibilityToggle DOM manipulation): The pattern is functional with isConnected checks. A proper fix requires refactoring to Svelte reactive bindings, which is a larger architectural change. Defer.

### Plan for C8-01 this cycle:
Remove the `categorizer-ai.ts` file entirely and update TransactionReview.svelte to remove the import comment. The disabled categorizer adds no value as a 40-line stub -- the git history preserves the intent.
- **Status:** DONE -- committed as `00000000ed9bbf17334ba68508c299ba6293e359`

## Deferred Items

### C24-04 (LOW): Dangling AbortSignal listener on dead controller in cards.ts
- **Reason for deferral:** The `{ once: true }` listener ensures the callback fires at most once and is automatically removed. The dangling listener on an abandoned controller has no functional impact. Cleaning this up would require restructuring the shared-fetch pattern (e.g., using a WeakRef or a per-call AbortController), adding complexity for no practical benefit.
- **Exit criterion:** If the shared-fetch pattern is refactored (e.g., to support request deduplication or cache invalidation), clean up the listener management at that time.

### C24-05 (LOW): buildPageUrl() does not strip trailing slashes from path
- **Reason for deferral:** All current call sites pass bare page names without slashes (e.g., `'dashboard'`, `'cards'`). Adding a trailing-slash strip is defensive but addresses no actual bug. The function's JSDoc already documents the expected input format.
- **Exit criterion:** If a call site ever passes a path with a trailing slash, add a `path.replace(/\/+$/, '')` strip to the function.

### C24-06 (LOW): buildCardResults totalSpending does not guard against negative amounts
- **Reason for deferral:** The only caller of `buildCardResults` is `greedyOptimize`, which pre-filters transactions to `amount > 0 && Number.isFinite(amount)`. Adding an internal guard would be defensive but addresses no actual bug given the current call chain. The function is not exported as a public API.
- **Exit criterion:** If `buildCardResults` is ever called from a code path that doesn't pre-filter transactions, add an internal `Math.max(0, tx.amount)` guard or assert the invariant.
