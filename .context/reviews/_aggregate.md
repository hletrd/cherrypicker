# Cycle 2 — Aggregate Review (2026-04-24)

Deduplicated findings across `code-reviewer`, `perf-reviewer`, `security-reviewer`, `architect`, `test-engineer`, `designer`, `debugger`, `critic`, `verifier`, `tracer`, and `document-specialist`.

Provenance files retained at `.context/reviews/c2-<agent-name>.md`.

## HIGH/MEDIUM — implement in this cycle

| Id | Source agents | File:line | Description |
|----|---------------|-----------|-------------|
| C2-01 | critic C2-CT01, code-reviewer C2-CR01, architect C2-A01, tracer | `packages/core/src/optimizer/greedy.ts:11-89`, `apps/web/src/lib/category-labels.ts:32-111`, `packages/rules/src/category-names.ts` | **Three independent hardcoded category label maps can silently diverge.** Cycle 1 added `buildCategoryNamesKo()` but did not connect consumers to it. `CATEGORY_NAMES_KO` (core) and `FALLBACK_CATEGORY_LABELS` (web) are two independent hardcoded maps that must be manually synced with `categories.yaml`. The `buildCategoryNamesKo()` function in rules is unused dead code. This is worse than the original A1-01 finding. |
| C2-02 | code-reviewer C2-CR02/C2-CR03, critic C2-CT02, debugger C2-D01 | `packages/core/src/optimizer/greedy.ts:18`, `apps/web/src/lib/category-labels.ts:36,39,106` | **Concrete divergences between the two hardcoded maps.** (a) `grocery` label: core says `식료품/마트`, web says `식료품`. (b) `subscription.general` exists in web fallback but not in core. (c) Standalone `cafe` in fallback but `buildCategoryLabelMap()` deliberately excludes standalone subcategory IDs — inconsistent behavior. |

## LOW — plan-only or deferred

| Id | Source agents | File:line | Severity | Description |
|----|---------------|-----------|----------|-------------|
| C2-03 | code-reviewer C2-CR05 | `apps/web/src/components/dashboard/CategoryBreakdown.svelte:6-84` | LOW | `CATEGORY_COLORS` missing standalone `travel_agency` entry (extends D-42/D-64/D-78). |
| C2-04 | designer C2-U01 | `apps/web/src/components/cards/CardDetail.svelte:222-228` | LOW | Rewards table `<th>` lacks `scope="col"` for WCAG 1.3.1. |
| C2-05 | designer C2-U02 | `apps/web/src/components/dashboard/TransactionReview.svelte:241-245` | LOW | Search input has `placeholder` but no `aria-label` — WCAG 1.3.1. |
| C2-06 | verifier C2-V01 | `apps/web/src/components/upload/FileDropzone.svelte:494-503` | LOW | U1-02 CSS fix (hiding stepper arrows) not applied — only `inputmode="numeric"` was added, not the CSS rules. |
| C2-07 | test-engineer C2-T01 | `packages/rules/src/category-names.ts` | LOW | No test for `buildCategoryNamesKo()` function added in cycle 1. |
| C2-08 | test-engineer C2-T02 | `apps/web/src/lib/category-labels.ts:32-111` | LOW | No automated test verifying `FALLBACK_CATEGORY_LABELS` matches taxonomy. |
| C2-09 | document-specialist C2-DS01 | `packages/rules/src/category-names.ts:1-7` | LOW | JSDoc says "authoritative source" but function is unused — doc-code mismatch. |
| C2-10 | debugger C2-D02 | `apps/web/src/lib/store.svelte.ts:461-463,545` | LOW | `previousMonthSpendingOption` conditional assignment is subtle — could use a clarifying comment. |

## Security — no new findings

No new security issues. Previously deferred items (D-32, D7-M13, D-31) remain valid.

## Cross-agent agreement

- **critic + code-reviewer + architect + tracer** converge on C2-01 (three-way label map divergence). Critic flags it as the highest-priority architectural issue; code-reviewer identifies concrete divergences; architect notes the unused `buildCategoryNamesKo()` function; tracer confirms the divergent code paths.
- **code-reviewer + debugger** converge on C2-02 (concrete map divergences: grocery label, subscription.general, standalone cafe).
- **verifier** independently confirms C2-06 (U1-02 CSS fix incomplete) through evidence-based verification.

## Previously Deferred (Acknowledged, Not Re-reported)

All 111 items in `.context/plans/00-deferred-items.md` remain valid. No regression found.

## Gate evidence

- `npm run lint` — PASS (exit 0)
- `npm run typecheck` — PASS (exit 0)
- `bun run test` — PASS (197 tests, 0 fail across 7 packages)
- `npm run verify` — PASS (lint + typecheck + test all green, 10/10 turbo tasks cached)

## Plan hand-off

See `.context/plans/` for implementation plans derived from this aggregate.
