# Cycle 1 — aggregate review (Fresh Review 2026-04-24)

Deduplicated findings across `code-reviewer`, `perf-reviewer`, `security-reviewer`, `architect`, `test-engineer`, and `designer`.

Provenance files retained at `.context/reviews/<agent-name>.md`.

Prior convergence history: Cycles 2-10 (legacy numbering) reported progressively fewer new findings; 111 deferred items tracked in `.context/plans/00-deferred-items.md`. Cycle 1 (fresh review) re-examines the codebase with fresh eyes after a 10-cycle gap.

## MEDIUM — implement in this cycle

| Id | Source agents | File:line | Description |
|----|---------------|-----------|-------------|
| C1-01 | code-reviewer C1-01, designer U1-01, test-engineer T1-01 | `apps/web/src/components/cards/CardDetail.svelte:28-38` | **CardDetail shows raw category IDs when `loadCategories` is aborted.** When `loadCategories` returns `[]` (AbortError during View Transition), `categoryLabels` is empty but `categoryLabelsReady = true`, so the rewards table renders raw IDs like "dining.cafe" instead of Korean labels. TransactionReview has a hardcoded fallback; CardDetail should too. |
| A1-01 | architect A1-01 | `packages/core/src/optimizer/greedy.ts:11-86` | **`CATEGORY_NAMES_KO` is a hardcoded duplicate of taxonomy data.** Duplicates category labels from `packages/rules/data/categories.yaml`. The existing TODO at line 8-10 acknowledges this. Missing newer entries (`travel_agency`, `apartment_mgmt`). Can silently drift from YAML source. `greedyOptimize` already accepts `categoryLabels?: Map<string, string>` in its constraints, making this redundant when labels are provided. |

## LOW — plan-only or deferred

| Id | Source agents | File:line | Severity | Description |
|----|---------------|-----------|----------|-------------|
| C1-02 | code-reviewer C1-02, architect A1-02, perf-reviewer P1-02 | `packages/parser/src/detect.ts:148-165` | LOW | **Server-side `detectCSVDelimiter` scans all lines.** Web version limits to 30 lines (C83-05); server version does not. Add `.slice(0, 30)`. |
| C1-03 | code-reviewer C1-03 | `apps/web/src/lib/analyzer.ts:55-58` | LOW | **`toCoreCardRuleSets` silently falls back unknown sources to 'web'.** Misleading for scraped cards. Should log `console.warn` on fallback. |
| P1-01 | perf-reviewer P1-01 | `apps/web/src/lib/store.svelte.ts:576` | LOW | **`persistToStorage` serializes entire result on every reoptimize.** Previously P8-02 (deferred). No change in status. Debounce recommended. |
| U1-02 | designer U1-02 | `apps/web/src/components/upload/FileDropzone.svelte:494-503` | LOW | **FileDropzone `<input type="number">` shows stepper arrows on mobile.** Useless for Korean Won amounts. Add `appearance: textfield` CSS or switch to `inputmode="numeric"` with `type="text"`. |
| T1-01 | test-engineer T1-01 | (superseded by C1-01) | LOW | No unit test for CardDetail abort-then-labels scenario. Subsumed by C1-01 fix — add test alongside the fix. |
| T1-02 | test-engineer T1-02 | `packages/parser/__tests__/detect.test.ts` | LOW | No test for `detectCSVDelimiter` 30-line limit. Subsumed by C1-02 fix — add test alongside the fix. |

## Security — no new findings

The security reviewer found no new issues. The codebase is a client-side-only static Astro site with minimal attack surface. Previously deferred items (D7-M13, D-32, D7-M8) remain valid.

## Previously Deferred (Acknowledged, Not Re-reported)

All 111 items in `.context/plans/00-deferred-items.md` (D-01 through D-111) remain valid. No regression or new evidence found for any deferred item.

## Cross-agent agreement

- **code-reviewer + designer + test-engineer** converge on C1-01 (CardDetail abort/labels). Designer flags UX impact for Korean users; test-engineer flags missing test coverage.
- **code-reviewer + architect + perf-reviewer** converge on C1-02 (server detectCSVDelimiter unbounded scan). Architect flags the concrete divergence in the D-01 duplicate parser class; perf-reviewer flags the O(n) cost.

## Plan hand-off

See `.context/plans/` for implementation plans derived from this aggregate.
