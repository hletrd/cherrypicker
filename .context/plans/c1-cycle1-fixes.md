# Cycle 1 Implementation Plan

**Date**: 2026-04-22
**Source**: `.context/reviews/_aggregate.md` (CF-01 through CF-33, C1-01 through C1-50)

## Scheduled Fixes (this cycle)

### Tier 1: Security / Correctness / Data-loss (not deferrable)

| # | ID | Finding | Fix | Effort |
|---|---|---|---|---|
| 1 | C1-01 | monthlySpending includes refunds, distorting performance tier | Filter `tx.amount > 0` in monthlySpending accumulation (analyzer.ts:321, store.svelte.ts:524) | Small |
| 2 | C1-12 | findRule sort instability for equal specificity | Add secondary sort key (rule index) for deterministic ordering (reward.ts:87) | Small |
| 3 | C1-14 | CardDetail URL not validated (javascript: URL possible) | Add URL validation in cardMetaSchema (schema.ts:55) and runtime guard in CardDetail.svelte | Small |
| 4 | C1-21 | Truncation + reoptimize uses empty transactions | Guard reoptimize against empty editedTransactions; surface truncation warning | Small |
| 5 | CF-08 | Server-side CSV parser missing BOM stripping | Add BOM strip at parseCSV entry point (parser/csv/index.ts:29) | Small |
| 6 | CF-06 | loadAllCardRules silently swallows failed YAML loads | Return result object with loaded count + failures list | Medium |
| 7 | CF-22 | Push/pop mutation without try/finally guard | Wrap push/pop in try/finally (greedy.ts:137-139) | Small |
| 8 | CF-11 | CSP allows unsafe-inline | Add strict CSP via Astro middleware | Medium |

### Tier 2: Accessibility / UX

| # | ID | Finding | Fix | Effort |
|---|---|---|---|---|
| 9 | C1-03 | KakaoBank badge WCAG AA contrast (#fee500 yellow, white text) | Use dark text (#1a1a1a) on kakao yellow background | Small |
| 10 | C1-28 | TransactionReview table overflows on mobile | Add overflow-x-auto to table container | Small |

### Tier 3: Regression Prevention (tests)

| # | ID | Finding | Fix | Effort |
|---|---|---|---|---|
| 11 | C1-18 | No test for formatSavingsValue sign-prefix behavior | Add unit tests for formatSavingsValue | Small |
| 12 | C1-42 | No test for findRule specificity ordering | Add test for equal-specificity tiebreaking | Small |

### Tier 4: Doc/API honesty

| # | ID | Finding | Fix | Effort |
|---|---|---|---|---|
| 13 | CF-19/CR-05 | ILP optimizer stub uses console.debug (invisible) | Change to console.warn; update JSDoc | Small |

## Deferred Items

| ID | Reason | Exit Criterion |
|---|---|---|
| CF-01 | Full parser dedup is architectural refactor requiring shared package; too large for single cycle | D-01 shared package created |
| CF-02 | Bank card issuer names in keyword map; needs domain expert validation that these actually cause mis-categorization in real data | Confirm with real transaction data or add low-confidence tier |
| CF-03 | Overly broad bank detection patterns; needs careful testing with all bank formats | Integration test suite for detect.ts |
| CF-04 | Greedy optimizer O(N^2) incremental reward; requires algorithmic redesign | Profile with realistic datasets; implement incremental state tracking |
| CF-05 | findRule linear scan; performance optimization | Profile to confirm hotspot; then add index |
| CF-07 | Duplicate applyMonthlyCap; needs careful refactoring of reward calculation | Unify in dedicated cap module |
| CF-09 | Rate normalization schema enforcement; requires schema migration + YAML audit | Audit all YAML files for pre-normalized rates |
| CF-10 | SSRF in scraper; scraper is offline tool, not production | Add URL allowlist when scraper runs in CI |
| CF-12 | Dependency CVEs; needs careful upgrade testing | Schedule dedicated dependency upgrade cycle |
| CF-13 | CATEGORY_NAMES_KO drift; requires build-time codegen from YAML | Implement codegen step |
| C1-02 | LLM fallback PII; requires consent flow + data sanitization design | Design privacy UX and implement sanitization |
| C1-04 | Greedy optimizer O(N*M*K^2); same as CF-04 | See CF-04 |
| C1-05 | MerchantMatcher substring scan; same as CF-05 | See CF-05 |
| C1-06 | CATEGORY_NAMES_KO drift; same as CF-13 | See CF-13 |
| C1-07 | parseCSV duplication; same as CF-01 | See CF-01 |
| C1-08 | Dual runtime; same as CF-01 | See CF-01 |
| C1-09 | Core console.warn side effects | Return warnings in CalculationOutput |
| C1-10 | Web CardRuleSet string types vs union | Import from rules package |
| C1-11 | Three parallel maps; same as CF-13 | See CF-13 |
| C1-13 | sessionStorage cleartext financial data | Encrypt or store only summary |
| C1-15 | loadAllCardRules swallows errors; same as CF-06 | See CF-06 |
| C1-16 | ILP stub; same as CF-19 | See CF-19 |
| C1-17 | No integration test for multi-file upload | Add in next cycle |
| C1-19 | No test for global cap + rule cap; already exists (reward-cap-rollback.test.ts) | Verify coverage |
| C1-20 | No test for sessionStorage persistence | Add in next cycle |
| C1-22 | Web store coupling; separation of concerns | Extract persistence module |
| C1-23 | cachedCategoryLabels stale; same as prior cycles | Add version/ETag check |
| C1-24 | loadCategories returns [] on AbortError | Add AbortError check |
| C1-25 | Multi-file upload optimizes only latest month | By design; document |
| C1-26 | Actionable warnings not surfaced | Same as C1-09 |
| C1-27 | CategoryBreakdown dark mode contrast | Separate design cycle |
| C1-29 | Bank adapter boilerplate | Data-driven adapter factory |
| C1-30 through C1-50 | LOW severity | Address in subsequent cycles |
| CF-14 through CF-33 | MEDIUM/LOW | Address in subsequent cycles |
