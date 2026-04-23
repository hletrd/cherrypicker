# Cycle 98 — code-reviewer pass

**Date:** 2026-04-23

## Scope

Net-new code-quality issues since cycle 97. Focused sweep over:
- `apps/web/src/lib/analyzer.ts` (post-C97-01 filtering)
- `apps/web/src/lib/store.svelte.ts` (reoptimize flow + persistence)
- `apps/web/src/lib/formatters.ts`
- `apps/web/src/lib/cards.ts`
- `apps/web/src/lib/parser/index.ts`
- `packages/core/src/optimizer/greedy.ts`
- `packages/core/src/calculator/reward.ts`
- `packages/core/src/optimizer/constraints.ts`
- `packages/core/src/categorizer/matcher.ts`
- Dashboard components under `apps/web/src/components/dashboard/`

## Findings

None net-new.

## Verified prior fixes still in place

| ID | File/Line | Verification |
|---|---|---|
| C97-01 | `analyzer.ts:376-390` | Filter `length >= 10` on `allDates` and `optimizedDates` confirmed. |
| C96-01 | `analyzer.ts:344-346` | Empty-months `throw` confirmed. |
| C1-01 | `analyzer.ts:329`, `store.svelte.ts:531` | `tx.amount > 0` filter on monthlySpending accumulation confirmed. |
| C1-12 | `reward.ts:90-94` | Secondary index-based sort in findRule confirmed. |
| C5-01 | `analyzer.ts:231` | `tx.amount > 0` in qualifying sum confirmed. |
| C7-01 | `store.svelte.ts:361` | Generation=1 on restore confirmed. |
| C44-01 | `store.svelte.ts:551-556` | `previousMonthSpendingOption` preservation confirmed. |
| C81-01 | `store.svelte.ts:506` | Snapshot pattern confirmed. |
| C82-01/C92-01/C94-01 | `formatters.ts:224-227` | `formatSavingsValue` centralization confirmed. |

## Commonly-missed-issues sweep (deep)

- **Bare `.sort()` usage** — remaining occurrences (`analyzer.ts:264`, `343`, `315` via localeCompare; `store.svelte.ts:559`) operate on `YYYY-MM` (7-char) strings derived from `.slice(0, 7)` of length-guarded inputs. Lexicographic == chronological for exact-width ISO year-month strings. Safe.
- **Non-null assertions** — `months[months.length - 1]!` at `analyzer.ts:347` is gated by `months.length === 0` early throw. `monthlySpending.get(previousMonth)!` at line 354 is gated by `months.length >= 2`. Both safe.
- **Race conditions in reoptimize** — snapshot pattern (C81-01) still protects against concurrent analyze/reoptimize. The check is `if (!result)` at line 494, followed by `const snapshot = result;` at 506 — there's one micro-gap between the guard and snapshot where a concurrent reset could set result=null, but since both lines are synchronous with no await between them, JS event-loop semantics guarantee atomicity. Safe.
- **Map.get with default-chain** — `categoryLabels?.get(categoryKey) ?? categoryLabels?.get(assignment.tx.category) ?? CATEGORY_NAMES_KO[categoryKey] ?? CATEGORY_NAMES_KO[assignment.tx.category] ?? categoryKey` at `greedy.ts:176` is a well-defined fallback cascade. Safe.
- **Array mutation during iteration** — `scoreCardsForTransaction` at `greedy.ts:137-139` pushes+pops in-place (C68-02 fix). The pattern is safe because `calculateCardOutput` only reads the array, no iterators held across the mutation.
- **Refund/zero guards** — all spending/reward accumulation gates on `tx.amount > 0`. Consistent.
- **Migration machinery** — `MIGRATIONS` dict at `store.svelte.ts:110` is empty — comment explicitly says v1 is the first versioned schema. Correct.

## Summary

0 net-new code-reviewer findings. Cycle 98 represents convergence state — no actionable items beyond the already-tracked deferred list.
