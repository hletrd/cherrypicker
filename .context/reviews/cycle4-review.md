# Cycle 4 Review (2026-04-22)

## Scope
Deep code review of all source files in packages/core, packages/parser, packages/rules, packages/viz, apps/web/src, tools/cli/src, tools/scraper/src.

## Method
- Grep for anti-patterns: `as any`, `eslint-disable`, empty catches, TODO/FIXME
- Read core logic files (optimizer, calculator, categorizer, matcher, ILP stub)
- Read web app stores, analyzer, formatters, cards
- Read report generator (HTML and terminal), parser date-utils, detect
- Cross-reference with `.context/reviews/_aggregate.md` for known findings

## New Findings

| ID | Severity | File | Finding | Confidence |
|---|---|---|---|---|
| C4-01 | LOW | `packages/viz/src/terminal/summary.ts:65` | Summary row in printSpendingSummary uses `transactions.length` for count, but the loop above skips `tx.amount <= 0` transactions. The displayed count includes skipped transactions (refunds, balance inquiries), making it inconsistent with `grandTotal` which only sums positive amounts. Same bug as C3-01 in the HTML report generator, which was fixed there but missed in the terminal summary. | High |

## Verification of Prior Fixes

All prior cycle 1-94 and cycle 1-3 findings confirmed fixed as noted in `_aggregate.md`.

## Items Reviewed (No New Issues Found)

- `packages/core/src/optimizer/greedy.ts` — deterministic sort, NaN guard, in-place push optimization, category label fallback chain: correct
- `packages/core/src/calculator/reward.ts` — monthly cap rollback, dominant rewardType, specificity tiebreak, fixed reward units: correct
- `packages/core/src/categorizer/matcher.ts` — precomputed entries, empty merchant guard, rawCategory validation: correct
- `packages/core/src/optimizer/ilp.ts` — stub delegates to greedy, TODO for glpk.js integration: correct (known stub)
- `apps/web/src/lib/store.svelte.ts` — sessionStorage versioning, AbortError handling, snapshot-based reoptimize: correct
- `apps/web/src/lib/analyzer.ts` — shared matcher, category label caching, multi-file merge, performance exclusion matching: correct
- `apps/web/src/lib/formatters.ts` — formatSavingsValue helper, WCAG contrast, negative-zero normalization: correct
- `apps/web/src/lib/cards.ts` — AbortSignal chaining, card index cache, retry on abort: correct
- `packages/viz/src/report/generator.ts` — includedCount fix (C3-01) confirmed: correct
- `packages/parser/src/date-utils.ts` — BOM stripping, shared helpers, date validation: correct
- `packages/parser/src/detect.ts` — bank signatures, CSV delimiter detection, file format sniffing: correct
