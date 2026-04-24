# Aggregate Review — Cycle 12 (2026-04-24)

Deduplicated findings across cycles 7-12 reviews. This file supersedes per-cycle aggregates.

## Convergence Assessment

**Cycle 12 confirms full convergence.** All 9 review agents agree: zero net-new HIGH findings. All new findings (C12-CR01 through C12-UX04) are LOW-severity instances of known deferred patterns. No immediate implementation work is required beyond documentation updates.

## MEDIUM — systemic, awaiting build-time generation fix

| Id | Source cycles | File:line | Description |
|----|---------------|-----------|-------------|
| C7-01 | C7, C8, C9, C12 | `packages/core/src/optimizer/greedy.ts:11-90` | **CATEGORY_NAMES_KO hardcoded map can drift from YAML taxonomy.** 90-line Record duplicates category labels. 5+ agents converge across 6 cycles. |
| C7-02 | C7, C8, C9, C12 | `apps/web/src/lib/category-labels.ts:32-110` | **FALLBACK_CATEGORY_LABELS is a hardcoded duplicate.** 78-entry ReadonlyMap used as fallback. |
| C9-01 | C9, C12 | `apps/web/src/components/dashboard/CategoryBreakdown.svelte:8-87` | **CATEGORY_COLORS is a fourth hardcoded duplicate.** 80-entry Record mapping category IDs to hex colors. |
| D-01 | C1, C12 | `apps/web/src/lib/parser/*` vs `packages/parser/src/*` | **Duplicate parser implementations (web vs packages).** Full dedup requires shared platform-agnostic module. |
| D-02 | C1, C12 | `README.md:169-171` vs `LICENSE:1-15` | **README says MIT, LICENSE is Apache 2.0.** Legal metadata mismatch. Requires project owner confirmation. |

**Exit criterion for C7-01/C7-02/C9-01:** Build-time generation from `categories.yaml` that produces all fallback data, label maps, and color maps automatically.

**Exit criterion for D-01:** Create a dedicated refactor cycle with a design doc first, then implement incrementally with dual-path testing.

**Exit criterion for D-02:** Confirm intended license with project owner, then update README or LICENSE accordingly.

## LOW — new this cycle (C12)

| Id | Source | File:line | Description | Notes |
|----|--------|-----------|-------------|-------|
| C12-CR01 | code-reviewer | `packages/core/src/calculator/reward.ts:311-331` | `globalMonthUsed` / `ruleMonthUsed` rollback inconsistency after global cap clip. | Latent, low confidence. No visible effect in practice. |
| C12-DB03 | debugger | `apps/web/src/lib/parser/pdf.ts:383` | PDF fallback `dateMatch[1]!` is undefined (no capture groups in regex). | Latent bug but downstream filtering prevents visible effect. |
| C12-UX01 | designer | `CategoryBreakdown.svelte:203-275` | No visual affordance for expandable rows on mobile. | Minor UX polish. |
| C12-UX02 | designer | `SpendingSummary.svelte:158` | Warning banner dismiss button lacks focus ring. | Accessibility polish. |
| C12-UX04 | designer | `TransactionReview.svelte:272` | Horizontal scroll indicator missing for narrow viewports. | Minor UX polish. |
| C12-TE03 | test-engineer | `apps/web/src/lib/parser/xlsx.ts:266-275` | No test coverage for `isHTMLContent`. | Test gap. |
| C12-TE04 | test-engineer | `apps/web/src/lib/store.svelte.ts:383-398` | No test coverage for `getCategoryLabels` caching. | Test gap. |

## LOW — carried forward (unchanged from prior cycles)

| Id | Source | File:line | Description |
|----|--------|-----------|-------------|
| C7-03 | C7 | `apps/web/src/lib/api.ts:7-18` | Dead UploadResult type exported but never consumed. |
| C7-04 | C7, C12 | `apps/web/src/lib/category-labels.ts:101` | entertainment.subscription key inconsistent with taxonomy. |
| C8-01 | C8, C12 | `apps/web/src/components/dashboard/TransactionReview.svelte:27-42` | FALLBACK_GROUPS third hardcoded duplicate. Same exit criterion as C7-01. |
| C9-02 | C9, C12 | `apps/web/src/components/upload/FileDropzone.svelte:80-105` | ALL_BANKS duplicates parser bank signatures. |
| C9-03 | C9, C12 | `apps/web/src/lib/formatters.ts:52-79` | formatIssuerNameKo duplicates issuer name data. |
| C9-04 | C9, C12 | `apps/web/src/lib/formatters.ts:115-143` | getIssuerColor duplicates issuer color data. |
| C9-05 | C9, C12 | `apps/web/src/lib/formatters.ts:85-110` | getCategoryIconName duplicates taxonomy icon mapping. |
| C9-08 | C9, C12 | `apps/web/src/lib/category-labels.ts:7-26` | No test coverage for buildCategoryLabelMap. |
| C9-09 | C9, C12 | `apps/web/src/lib/store.svelte.ts:146-330` | No test coverage for sessionStorage persistence. |
| C9-10 | C9, C12 | `apps/web/src/lib/build-stats.ts:16-18` | Fallback stats values may become stale. |

## Security — no active findings

No HIGH or MEDIUM security findings. Previously deferred items (D-32, D-31) remain valid.

## Gate evidence (Cycle 12)

- `npm run lint` — PASS
- `npm run typecheck` — PASS
- `bun run test` — PASS (FULL TURBO)
- `npm run verify` — PASS

## Cross-agent agreement

- C7-01/C7-02/C9-01 (hardcoded taxonomy duplicates): Confirmed by code-reviewer, architect, critic, document-specialist across 6 cycles. Highest signal finding in the codebase.
- D-01 (duplicate parsers): Confirmed by architect, critic, code-reviewer (C12-CR04). Well-understood architectural debt.
- D-02 (license mismatch): Confirmed by document-specialist. Requires human decision.
- All C12-new findings: Single-agent findings, no cross-agent convergence. Low signal.
