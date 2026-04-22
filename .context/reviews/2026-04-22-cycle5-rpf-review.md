# Cycle 5 Review-Plan-Fix — 2026-04-22

## Scope
Fresh deep code review of source files in packages/core/src/, packages/parser/src/,
packages/rules/src/, packages/viz/src/, apps/web/src/, tools/cli/src/

## Findings

### C5-01 (MEDIUM): performanceExclusions qualifying sum includes negative/zero amounts

**File:** `apps/web/src/lib/analyzer.ts:226-232`

**Description:** When computing per-card `previousMonthSpending` from `performanceExclusions`,
the `qualifying` reduce sums `tx.amount` for ALL transactions not in the exclusion set,
including refunds (negative amounts) and zero-amount rows (balance inquiries).

This contradicts the convention established by C1-01, which fixed `monthlySpending`
accumulation to only count `tx.amount > 0`. If a statement includes a refund of 50,000 KRW,
the `qualifying` total would be inflated by that negative amount, reducing the computed
전월실적 and potentially placing the user in a lower performance tier with worse rewards.

**Example:** Transactions: +100,000, +50,000, -30,000 (refund). Exclusions: none.
- Current: qualifying = 100,000 + 50,000 + (-30,000) = 120,000
- Correct: qualifying = 100,000 + 50,000 = 150,000 (only positive amounts)

**Fix:** Add `tx.amount > 0` filter before the reduce, matching the C1-01 pattern used
in `analyzeMultipleFiles` and `store.svelte.ts` reoptimize.

**Confidence:** High — the inconsistency with C1-01's convention is clear.

### No other new findings

All previously identified issues from cycles 1-4 remain fixed. The codebase is stable.
The remaining open items from _aggregate.md (C1-N01, C1-N02, C1-N04, C89-03) are
LOW-severity drift/maintenance concerns, not actionable this cycle.
