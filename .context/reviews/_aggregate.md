# Review Aggregate — 2026-04-19 (Cycle 2)

**Source reviews (this cycle):**
- `.context/reviews/2026-04-19-cycle2-code-reviewer.md`
- `.context/reviews/2026-04-19-cycle2-security-reviewer.md`
- `.context/reviews/2026-04-19-cycle2-perf-reviewer.md`
- `.context/reviews/2026-04-19-cycle2-architect.md`
- `.context/reviews/2026-04-19-cycle2-debugger.md`
- `.context/reviews/2026-04-19-cycle2-test-engineer.md`
- `.context/reviews/2026-04-19-cycle2-designer.md`

**Prior cycle reviews (still relevant):**
- `.context/reviews/2026-04-19-comprehensive-review.md`
- `.context/reviews/_aggregate.md` (cycle 1)

---

## Deduplication with Prior Reviews

All cycle 1 findings (C-01, C-02, H-01..H-06, M-01..M-07) have been verified as **fixed** in the current codebase. They are removed from the active finding list.

Deferred items D-01 through D-10 remain unchanged and are not re-listed here.

---

## Cross-Agent Agreement (Cycle 2)

| Finding | Flagged by | Consensus |
|---|---|---|
| LLM AbortController signal not passed | code-reviewer (C2-01) | Single reviewer — HIGH confidence |
| `loadFromStorage` drops new fields | code-reviewer (C2-08), debugger (C2-D03) | **2 reviewers agree** — stronger signal |
| PDF fallback parseInt without NaN check | debugger (C2-D02) | Single reviewer |
| No unit tests for web parsers | test-engineer (C2-T01) | Single reviewer — HIGH severity |
| CATEGORY_NAMES_KO in core package | architect (C2-A01) | Single reviewer |
| Per-card performanceExclusions | debugger (C2-D06), plan H-02 note | Acknowledged as known approximation |
| Mobile menu focus trap | designer (C2-U05) | Single reviewer |
| Mobile menu inert attribute | designer (C2-U03) | Single reviewer |

---

## Active Findings (New in Cycle 2, Deduplicated)

| ID | Severity | Confidence | File | Description | Origin |
|---|---|---|---|---|---|
| C2-01 | HIGH | High | `llm-fallback.ts:47-50` | AbortController signal not passed to API call | code-reviewer |
| C2-02 | MEDIUM | High | `taxonomy.ts:68-74` | O(n) substring scan in `findCategory` | code-reviewer |
| C2-03 | MEDIUM | Medium | `cards.ts:144-173` | No runtime validation of fetched JSON shape | code-reviewer |
| C2-04 | MEDIUM | High | `formatters.ts:137-151` | `new Date("YYYY-MM-DD")` UTC vs local timezone issue | code-reviewer |
| C2-05 | LOW | Medium | `analyzer.ts:25` | `labelEn: ''` is semantically misleading | code-reviewer |
| C2-06 | LOW | High | `e2e/ui-ux-review.spec.js` | E2E tests use CJS require style | code-reviewer |
| C2-07 | LOW | High | `xlsx.ts:18-170` | XLSX has 24 bank configs, CSV only 10 adapters | code-reviewer |
| C2-08 | MEDIUM | High | `store.svelte.ts:130-139` | `loadFromStorage` drops `fullStatementPeriod`/`totalTransactionCount` | code-reviewer, debugger |
| C2-S01 | HIGH | High | `llm-fallback.ts:34-36` | No browser runtime guard for API key usage | security-reviewer |
| C2-S02 | MEDIUM | High | `Layout.astro:49` | CSP `'unsafe-inline'` — already known (M-01) | security-reviewer |
| C2-S03 | MEDIUM | Medium | `Layout.astro:53` | `is:inline` script will break when CSP is tightened | security-reviewer |
| C2-P01 | MEDIUM | High | `greedy.ts:84-110` | O(N^2*M*K) optimizer (deferred as D-09) | perf-reviewer |
| C2-P02 | LOW | Medium | `pdf.ts:236-244` | String concatenation in PDF text extraction | perf-reviewer |
| C2-P05 | LOW | High | `cards.ts:144-157` | No HTTP cache control for cards.json | perf-reviewer |
| C2-A01 | MEDIUM | High | `greedy.ts:7-50` | Korean strings in core optimization package | architect |
| C2-A02 | MEDIUM | High | `detect.ts` (3 files) | Duplicate bank detection logic | architect |
| C2-A03 | LOW | High | `ilp.ts` | ILP optimizer stub adds noise | architect |
| C2-A04 | LOW | Medium | `card.ts` | Overlapping CardRuleSet types in core/rules | architect |
| C2-D02 | MEDIUM | High | `pdf.ts:287` | Fallback parser uses `parseInt` without NaN check | debugger |
| C2-D03 | MEDIUM | High | `store.svelte.ts:130-139` | `loadFromStorage` drops new fields (same as C2-08) | debugger |
| C2-D06 | MEDIUM | Medium | `analyzer.ts:159-161` | Same `previousMonthSpending` for all cards | debugger |
| C2-T01 | HIGH | High | `apps/web/src/lib/parser/*` | No unit tests for web-side parsers | test-engineer |
| C2-T02 | HIGH | High | `apps/web/src/lib/analyzer.ts` | No integration tests for analyzer pipeline | test-engineer |
| C2-T03 | MEDIUM | High | `e2e/ui-ux-review.spec.js` | E2E data integrity tests lack correctness assertions | test-engineer |
| C2-T04 | MEDIUM | High | `categorizer.test.ts` | No tests for subcategory blocking in `findRule` | test-engineer |
| C2-T05 | MEDIUM | High | `analyzer.ts:21-63` | No tests for type adapter functions | test-engineer |
| C2-T06 | LOW | High | `e2e/ui-ux-review.spec.js:194-197` | Temp file not cleaned up in E2E test | test-engineer |
| C2-U01 | MEDIUM | High | `TransactionReview.svelte:236` | No virtualization for large transaction lists | designer |
| C2-U02 | LOW | Medium | `TransactionReview.svelte:267` | Subcategories use spaces instead of optgroup | designer |
| C2-U03 | MEDIUM | High | `Layout.astro:133` | Mobile menu `inert` attribute not dynamically toggled | designer |
| C2-U04 | LOW | Medium | `Layout.astro` | Dark mode doesn't respect `prefers-color-scheme` on first visit | designer |
| C2-U05 | MEDIUM | High | `Layout.astro:129-156` | No focus trap for mobile menu | designer |
| C2-U06 | LOW | Medium | `TransactionReview.svelte:260-270` | Select dropdowns lack `aria-live` for changes | designer |

---

## Prioritized Action Items

### CRITICAL (must fix)
- None — all prior criticals are fixed

### HIGH (should fix this cycle)
1. C2-01 + C2-S01: Fix LLM fallback — add `signal` to API call + browser guard
2. C2-D02: Fix PDF fallback `parseInt` → use `parseAmount` + NaN check
3. C2-08/C2-D03: Fix `loadFromStorage` to pass through new fields
4. C2-T01: Add unit tests for web-side CSV parser (minimum: bank adapters + `inferYear`)
5. C2-T02: Add integration test for analyzer pipeline

### MEDIUM (plan for next cycles or fix if time allows)
6. C2-04: Fix timezone issue in `formatDateKo`/`formatDateShort`
7. C2-A01: Move `CATEGORY_NAMES_KO` out of core package
8. C2-D06: Compute per-card `previousMonthSpending`
9. C2-U05: Add focus trap for mobile menu
10. C2-U03: Fix mobile menu `inert` handling
11. C2-U01: Add virtual scrolling for transaction list
12. C2-S03: Plan for `is:inline` script migration
13. C2-T04: Add subcategory blocking tests
14. C2-T05: Add type adapter tests

### LOW (defer or accept)
- C2-02, C2-05, C2-06, C2-07, C2-P02, C2-P05, C2-A02, C2-A03, C2-A04, C2-U02, C2-U04, C2-U06, C2-T06

---

## Agent Failures

No agent failures. All 7 review angles completed successfully.
