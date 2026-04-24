# Cycle 3 — Aggregate Review (2026-04-24)

Deduplicated findings across `code-reviewer`, `perf-reviewer`, `security-reviewer`, `architect`, `test-engineer`, `designer`, `debugger`, `critic`, `verifier`, `tracer`, and `document-specialist`.

Provenance files retained at `.context/reviews/c3-<agent-name>.md`.

## MEDIUM — implement in this cycle

| Id | Source agents | File:line | Description |
|----|---------------|-----------|-------------|
| C3-01 | architect C3-A01, code-reviewer C3-CR03, test-engineer C3-T02, critic C3-CT01, verifier C3-V01 | `packages/core/src/optimizer/greedy.ts:11-90`, `apps/web/src/lib/category-labels.ts:32-110`, `apps/web/src/components/dashboard/TransactionReview.svelte:27-46`, `packages/rules/src/category-names.ts:12-23` | **Four independent hardcoded category maps can silently diverge.** Extends C2-01 which addressed two of the maps. FALLBACK_GROUPS in TransactionReview is a fourth independent map. Verified concrete divergence: `convenience_store` is a standalone group in FALLBACK_GROUPS but a subcategory of `grocery` in FALLBACK_CATEGORY_LABELS. The `buildCategoryNamesKo()` function in rules remains unused dead code that could replace the hardcoded maps. |

## LOW — plan-only or deferred

| Id | Source agents | File:line | Severity | Description |
|----|---------------|-----------|----------|-------------|
| C3-02 | code-reviewer C3-CR01, tracer C3-TR01, test-engineer C3-T01 | `packages/core/src/categorizer/keywords.ts:9187`, `packages/core/src/categorizer/keywords-english.ts:108` | LOW | Duplicate keyword `SHAKE SHACK KOREA` across MERCHANT_KEYWORDS and ENGLISH_KEYWORDS. Later spread silently overwrites. No test for cross-file duplicate detection. |
| C3-03 | code-reviewer C3-CR02, debugger C3-D01 | `packages/core/src/calculator/reward.ts:232-248` | LOW | `calculateRewards` bucket mutation before Map.set — fragile pattern for future maintenance. |
| C3-04 | code-reviewer C3-CR04, designer C3-U01 | `apps/web/src/components/dashboard/OptimalCardMap.svelte:81-86`, `apps/web/src/components/dashboard/SavingsComparison.svelte:279-283`, `apps/web/src/components/report/ReportContent.svelte:70-76,108-113` | LOW | Missing `scope="col"` on table headers in OptimalCardMap, SavingsComparison, and ReportContent tables. WCAG 1.3.1. |
| C3-05 | code-reviewer C3-CR05, designer C3-U02 | `apps/web/src/components/report/ReportContent.svelte:138`, `apps/web/src/components/dashboard/CategoryBreakdown.svelte:279`, `apps/web/src/components/dashboard/OptimalCardMap.svelte:176` | LOW | Navigation links use raw `import.meta.env.BASE_URL` instead of `buildPageUrl()` — inconsistent with FileDropzone and CardDetail. |
| C3-06 | architect C3-A02 | `packages/rules/src/index.ts` | LOW | `buildCategoryNamesKo` not re-exported from `@cherrypicker/rules`, making the authoritative function inaccessible to consumers. |
| C3-07 | security-reviewer C3-S01 | `packages/parser/src/pdf/llm-fallback.ts:59-63` | LOW | LLM fallback sends raw PDF text to API without input sanitization. Risk mitigated by system prompt scoping and JSON validation. |
| C3-08 | security-reviewer C3-S02 | `packages/parser/src/pdf/llm-fallback.ts:38-39` | LOW | `ANTHROPIC_API_KEY` read from env without `.trim()` — whitespace-only key would pass truthiness check but fail authentication. |
| C3-09 | document-specialist C3-DS01 | `packages/rules/src/category-names.ts:1-8` | LOW | JSDoc says "authoritative source" but function is unused — doc-code mismatch (same as C2-09, re-reported because not fixed). |
| C3-10 | document-specialist C3-DS02 | `packages/parser/src/pdf/llm-fallback.ts:45` | LOW | `ANTHROPIC_MODEL` default is `claude-opus-4-5` — may become outdated. |
| C3-11 | debugger C3-D02 | `packages/parser/src/pdf/llm-fallback.ts:51-52,126-128` | LOW | Timeout controller may abort during response processing. Theoretical — JSON parsing is near-instantaneous. |

## Security — no new HIGH findings

Two LOW security findings (C3-07, C3-08) are documented above. Previously deferred items (D-32, D7-M13) remain valid.

## Cross-agent agreement

- **architect + code-reviewer + test-engineer + critic + verifier** converge on C3-01 (four independent category maps). Verifier confirms the `convenience_store` hierarchy divergence. Critic identifies this as the highest-signal finding. Architect proposes the structural fix.
- **code-reviewer + tracer + test-engineer** converge on C3-02 (duplicate keyword). Tracer traces the data flow through the spread merge and confirms the shadow behavior.
- **code-reviewer + debugger** converge on C3-03 (bucket mutation before set). Both identify the fragile ordering from different angles.
- **code-reviewer + designer** converge on C3-04 (missing scope="col") and C3-05 (raw BASE_URL usage).

## Previously Deferred (Acknowledged, Not Re-reported)

All 111 items in `.context/plans/00-deferred-items.md` remain valid. No regression found.

## Gate evidence

- `npm run lint` — PASS (exit 0)
- `npm run typecheck` — PASS (exit 0)
- `bun run test` — PASS (197 tests, 0 fail, FULL TURBO cache hit)
- `npm run verify` — PASS (10/10 turbo tasks cached)

## Plan hand-off

See `.context/plans/` for implementation plans derived from this aggregate.
