# Cycle 26 Implementation Plan

**Date:** 2026-04-21
**Cycle:** 26/100

## Newly Fixed Findings (confirmed in review, already committed in prior cycles)

| ID | Description | Status |
|---|---|---|
| C8-01 | categorizer-ai.ts removed; TransactionReview no longer imports it | FIXED (prior cycle) |
| C25-06/D-106 | pdf.ts tryStructuredParse catch now logs console.warn | FIXED (cycle 25) |
| C22-02 | SavingsComparison count-up animation respects prefers-reduced-motion | FIXED (prior cycle) |

## New Actionable Findings This Cycle

### MEDIUM Priority

No new MEDIUM findings this cycle.

### LOW Priority

| ID | File | Description | Action |
|---|---|---|---|
| C26-01 | `SpendingSummary.svelte:147` | Inline `catch {}` in dismiss button event handler inconsistent with C24-02 fix pattern | Add explanatory comment inside catch |
| C26-02 | `csv.ts:183-210` | parseGenericCSV does not skip zero-amount rows (unlike PDF parser) | Add `if (amount === 0) continue;` after isValidAmount check |
| C26-03 | `analyzer.ts:47` | cachedCoreRules never reset by store.reset() (unlike cachedCategoryLabels) | Export invalidateCaches() from analyzer.ts and call from store.reset() |

## Implementation Steps

### Step 1: Fix SpendingSummary inline catch {} (C26-01)

- File: `apps/web/src/components/dashboard/SpendingSummary.svelte`
- Change: Replace `catch {}` with `catch { /* non-critical: dismissal won't persist */ }`
- Rationale: Consistent with C24-02 fix pattern. The sessionStorage write is best-effort and failure only means the dismiss warning reappears on next load.

### Step 2: Skip zero-amount rows in parseGenericCSV (C26-02)

- File: `apps/web/src/lib/parser/csv.ts`
- Change: Add `if (amount === 0) continue;` after the `isValidAmount` check (around line 186)
- Rationale: Matches PDF parser behavior (pdf.ts:231-237). Zero-amount rows are balance inquiries or declined transactions that should not appear in the transaction list or optimization.
- Note: Also add the same guard in each bank-specific adapter's parseCSV method if they don't already skip zero amounts. Check samsung, shinhan, kb, hyundai, lotte, hana, woori, nh, ibk, bc adapters.

### Step 3: Add cache invalidation to analyzer.ts and wire to store.reset() (C26-03)

- File: `apps/web/src/lib/analyzer.ts`
- Change: Export a `invalidateAnalyzerCaches()` function that sets `cachedCoreRules = null`
- File: `apps/web/src/lib/store.svelte.ts`
- Change: Call `invalidateAnalyzerCaches()` inside `reset()` method (alongside `cachedCategoryLabels = undefined`)
- Rationale: Asymmetry with cachedCategoryLabels which is cleared on reset. Same class as C21-04/C23-02/C25-02.

### Step 4: Run quality gates

- Lint: `bun run lint` across all workspaces
- Typecheck: `bun run typecheck` across all workspaces
- Tests: `bun test` across all workspaces
- Build: `bun run build` for apps/web

## Deferred Items

The following findings from this cycle are deferred per repo rules:

| ID | Severity | Reason | Exit Criterion |
|---|---|---|---|
| C25-01/C8-05 | MEDIUM | CATEGORY_COLORS dark mode contrast was partially fixed in cycle 25 (water, gas, electricity updated to lighter values). The `toll` color (#a8a29e) remains borderline but acceptable. No further action needed until specific user reports. | When user reports indicate specific color readability issues |
| C25-02/C23-02/C21-04 | LOW→MEDIUM | cachedCategoryLabels invalidation same class as C26-03. C26-03 adds reset for cachedCoreRules but cachedCategoryLabels is already reset in store.reset(). Both now handled. | When long-lived tabs become a reported user issue |
| C25-09/C53-03 | MEDIUM | CardDetail performance tier header was fixed in cycle 25 (changed to dark:text-blue-200). Verified in this cycle's review as improved. | When specific contrast testing tools report failure |
