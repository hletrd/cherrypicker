# Cycle 3 Review (2026-04-22)

## Scope
Deep code review of all source files in packages/core, packages/parser, packages/rules, packages/viz, apps/web/src, tools/cli/src, tools/scraper/src.

## Method
- Read core logic files (optimizer, calculator, categorizer, matcher)
- Read web app components and stores
- Grep for anti-patterns: `as any`, `eslint-disable`, empty catches, TODO/FIXME
- Read parser code, report generator, formatters, utility modules
- Cross-reference with `.context/reviews/_aggregate.md` for known findings

## New Findings

| ID | Severity | File | Finding | Confidence |
|---|---|---|---|---|
| C3-01 | LOW | `packages/viz/src/report/generator.ts:119` | Summary row in buildCategoryTable uses `transactions.length` for count, but the loop above skips `tx.amount <= 0` transactions. The displayed count includes skipped transactions (refunds, balance inquiries), making it inconsistent with the `grandTotal` which only sums positive amounts. | High |

## Verification of Prior Fixes

All prior cycle 1-94 and cycle 1-2 findings confirmed fixed as noted in `_aggregate.md`.

## Items Reviewed (No New Issues Found)

- `packages/core/src/optimizer/greedy.ts` — deterministic sort, NaN guard, in-place push optimization: correct
- `packages/core/src/calculator/reward.ts` — monthly cap rollback, dominant rewardType, specificity tiebreak: correct
- `packages/core/src/categorizer/matcher.ts` — precomputed entries, empty merchant guard, rawCategory validation: correct
- `apps/web/src/lib/store.svelte.ts` — sessionStorage versioning, AbortError handling, snapshot-based reoptimize: correct
- `apps/web/src/lib/analyzer.ts` — shared matcher, category label caching, multi-file merge: correct
- `apps/web/src/lib/formatters.ts` — formatSavingsValue helper, WCAG contrast, negative-zero normalization: correct
- `apps/web/src/lib/cards.ts` — AbortSignal chaining, card index cache, retry on abort: correct
- All Svelte dashboard components — proper null guards, count-up animation, accessibility: correct
- Parser modules — BOM stripping, shared helpers, bank detection: correct
