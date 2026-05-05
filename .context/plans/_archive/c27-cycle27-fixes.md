# Cycle 27 Implementation Plan

**Date:** 2026-04-21
**Cycle:** 27/100

## Newly Fixed Findings (confirmed in review, already committed in prior cycles)

| ID | Description | Status |
|---|---|---|
| C26-01 | SpendingSummary dismiss catch block now has explanatory comment | FIXED (cycle 26) |
| C26-02 | parseGenericCSV now skips zero-amount rows | FIXED (cycle 26) |
| C26-03 | analyzer.ts exports invalidateAnalyzerCaches(); store.reset() calls it | FIXED (cycle 26) |

## New Actionable Findings This Cycle

### MEDIUM Priority

| ID | File | Description | Action |
|---|---|---|---|
| C27-01 | `store.svelte.ts:253` | Bare `catch {}` in loadFromStorage inner cleanup inconsistent with C24-02/C26-01 fix patterns | Add explanatory comment inside inner catch, matching C26-01 pattern |

### LOW Priority

| ID | File | Description | Action |
|---|---|---|---|
| C27-02 | `csv.ts:187-193` | Duplicate NaN/zero checks in parseGenericCSV vs isValidAmount() in bank adapters | Replace inline checks with `isValidAmount()` call for consistency |

## Implementation Steps

### Step 1: Fix loadFromStorage inner catch {} (C27-01)

- File: `apps/web/src/lib/store.svelte.ts`
- Change: Replace `catch {}` (line 253) with `catch { /* best-effort cleanup: corrupted data removal, SecurityError in sandboxed iframes is expected */ }`
- Rationale: Consistent with C24-02 (console.warn for clearStorage) and C26-01 (comment for SpendingSummary dismiss catch). The inner catch in loadFromStorage is a best-effort attempt to remove corrupted data from sessionStorage; failure is non-critical but should be documented.

### Step 2: Unify parseGenericCSV amount validation with isValidAmount() (C27-02)

- File: `apps/web/src/lib/parser/csv.ts`
- Change: Replace the inline `Number.isNaN(amount)` check (line 187) and `amount === 0` check (line 193) with `if (!isValidAmount(amount, amountRaw, i, errors)) continue;`
- Rationale: The `isValidAmount()` helper (lines 49-61) already handles both NaN and zero-amount checks. Using it in parseGenericCSV eliminates the maintenance divergence between the generic parser and the bank-specific adapters. The C26-02 fix added zero-amount filtering to isValidAmount, making this consolidation safe.
- Note: The current inline code and `isValidAmount()` produce identical behavior, so this is purely a maintainability improvement with no behavioral change.

### Step 3: Run quality gates

- Lint: `bun run lint` across all workspaces
- Typecheck: `bun run typecheck` across all workspaces
- Tests: `bun test` across all workspaces
- Build: `bun run build` for apps/web

## Deferred Items

The following findings from this cycle are deferred per repo rules:

| ID | Severity | Reason | Exit Criterion |
|---|---|---|---|
| C27-03 | -- | No action needed -- parseInt NaN guard is sufficient via Number.isFinite check | N/A (observation, not an issue) |
