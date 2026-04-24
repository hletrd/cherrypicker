# Aggregate Review — Current (Cycle 9, 2026-04-24)

Deduplicated findings across cycles 7-9 reviews. This file supersedes per-cycle aggregates.

## MEDIUM — systemic, awaiting build-time generation fix

| Id | Source cycles | File:line | Description |
|----|---------------|-----------|-------------|
| C7-01 | C7, C8, C9 | `packages/core/src/optimizer/greedy.ts:11-90` | **CATEGORY_NAMES_KO hardcoded map can drift from YAML taxonomy.** 90-line Record duplicates category labels. 4+ agents converge across 3 cycles. |
| C7-02 | C7, C8, C9 | `apps/web/src/lib/category-labels.ts:32-110` | **FALLBACK_CATEGORY_LABELS is a hardcoded duplicate.** 78-entry ReadonlyMap used as fallback. |
| C9-01 | C9 | `apps/web/src/components/dashboard/CategoryBreakdown.svelte:8-87` | **CATEGORY_COLORS is a fourth hardcoded duplicate.** 80-entry Record mapping category IDs to hex colors. |

**Exit criterion for all 3:** Build-time generation from `categories.yaml` that produces all fallback data, label maps, and color maps automatically.

## LOW — deferred

| Id | Source | File:line | Description |
|----|--------|-----------|-------------|
| C7-03 | C7 | `apps/web/src/lib/api.ts:7-18` | Dead UploadResult type exported but never consumed. |
| C7-04 | C7 | `apps/web/src/lib/category-labels.ts:101` | entertainment.subscription key inconsistent with taxonomy. |
| C8-01 | C8 | `apps/web/src/components/dashboard/TransactionReview.svelte:27-42` | FALLBACK_GROUPS third hardcoded duplicate. Same exit criterion as C7-01. |
| C9-02 | C9 | `apps/web/src/components/upload/FileDropzone.svelte:80-105` | ALL_BANKS duplicates parser bank signatures. |
| C9-03 | C9 | `apps/web/src/lib/formatters.ts:52-79` | formatIssuerNameKo duplicates issuer name data. |
| C9-04 | C9 | `apps/web/src/lib/formatters.ts:115-143` | getIssuerColor duplicates issuer color data. |
| C9-05 | C9 | `apps/web/src/lib/formatters.ts:85-110` | getCategoryIconName duplicates taxonomy icon mapping. |
| C9-06 | C9 | `packages/core/src/optimizer/constraints.ts:16` | buildConstraints unnecessary shallow copy — **FIXED** |
| C9-07 | C9 | `apps/web/src/components/dashboard/CategoryBreakdown.svelte:120` | CategoryBreakdown re-sort — **RESOLVED** (comment added, sort kept intentionally) |
| C9-08 | C9 | `apps/web/src/lib/category-labels.ts:7-26` | No test coverage for buildCategoryLabelMap. |
| C9-09 | C9 | `apps/web/src/lib/store.svelte.ts:146-330` | No test coverage for sessionStorage persistence. |
| C9-10 | C9 | `apps/web/src/lib/build-stats.ts:16-18` | Fallback stats values may become stale. |

## Security — no active findings

No HIGH or MEDIUM security findings. Previously deferred items (D-32, D-31) remain valid.

## Gate evidence (Cycle 9)

- `npm run lint` — PASS
- `npm run typecheck` — PASS
- `bun run test` — PASS (FULL TURBO)
- `npm run verify` — PASS (FULL TURBO)

## Commits this cycle

1. `fa17b6c` refactor(core): remove unnecessary shallow copy in buildConstraints
2. `8875c52` docs(web): add comment clarifying CategoryBreakdown sort dependency
3. `a9846b6` docs(reviews): cycle 9 multi-agent reviews, aggregate, plan, and deferred-items refresh
