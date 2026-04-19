# Review Aggregate — 2026-04-19 (Cycle 3)

**Source reviews (this cycle):**
- `.context/reviews/2026-04-19-cycle3-code-reviewer.md`
- `.context/reviews/2026-04-19-cycle3-debugger.md`
- `.context/reviews/2026-04-19-cycle3-security-reviewer.md`
- `.context/reviews/2026-04-19-cycle3-perf-reviewer.md`
- `.context/reviews/2026-04-19-cycle3-test-engineer.md`
- `.context/reviews/2026-04-19-cycle3-architect.md`
- `.context/reviews/2026-04-19-cycle3-designer.md`

**Prior cycle reviews (still relevant):**
- `.context/reviews/_aggregate.md` (cycle 2)
- All cycle 1 + cycle 2 per-agent files

---

## Deduplication with Prior Reviews

All cycle 1 and cycle 2 findings have been verified as fixed or deferred. They are not re-listed here unless a cycle 3 finding extends or revisits them.

Deferred items D-01 through D-25 remain unchanged and are not re-listed here.

---

## Cross-Agent Agreement (Cycle 3)

| Finding | Flagged by | Consensus |
|---|---|---|
| `CATEGORY_NAMES_KO` hardcoded in optimizer | code-reviewer (C3-03), architect (C3-A01) | **2 reviewers agree** — stronger signal |
| `SpendingSummary.svelte` UTC/local timezone bug | code-reviewer (C3-04), designer (C3-U01) | **2 reviewers agree** — strong signal |
| `loadCategories` separate fetch for data already in cards.json | perf-reviewer (C3-P04), architect (C3-A02) | **2 reviewers agree** |
| `inferYear` / `parseDateToISO` duplicated | architect (C3-A04) | Single reviewer |
| Transaction review renders all DOM at once | perf-reviewer (C3-P02), designer (C3-U04) | **2 reviewers agree** — already deferred as D-25 |
| E2E `waitForTimeout` flakiness | test-engineer (C3-T04) | Single reviewer |
| No unit tests for `calculateRewards` | test-engineer (C3-T01) | Single reviewer — HIGH severity |

---

## Active Findings (New in Cycle 3, Deduplicated)

| ID | Severity | Confidence | File | Description | Origin |
|---|---|---|---|---|---|
| C3-01 | MEDIUM | High | `taxonomy.ts:85-89` | `findCategory` fuzzy match returns first instead of longest match | code-reviewer |
| C3-02 | MEDIUM | High | `reward.ts:113-117` | `normalizeRate` silently returns null; misconfigured YAML produces 0 reward with no warning | code-reviewer |
| C3-03 | MEDIUM | High | `greedy.ts:7-50` | `CATEGORY_NAMES_KO` incomplete and not sourced from taxonomy (also C3-A01) | code-reviewer, architect |
| C3-04 | MEDIUM | High | `SpendingSummary.svelte:15-21` | `formatPeriod` uses `new Date()` with UTC/local mismatch (also C3-U01) | code-reviewer, designer |
| C3-05 | LOW | Medium | `llm-fallback.ts:75` | JSON regex can match nested arrays incorrectly | code-reviewer |
| C3-06 | LOW | High | `analyzer.ts:98` | Transaction IDs use array index — duplicates across multi-file uploads | code-reviewer |
| C3-07 | MEDIUM | High | `TransactionReview.svelte:124-129` | `editedTxs` sync only runs once — stale data after re-upload | code-reviewer |
| C3-08 | LOW | High | `FileDropzone.svelte:176-177` | `parseInt` for previousMonthSpending without NaN validation | code-reviewer |
| C3-D01 | MEDIUM | High | `store.svelte.ts:140` | `loadFromStorage` does not validate `monthlyBreakdown` shape | debugger |
| C3-D02 | MEDIUM | Medium | `greedy.ts:84-110` | Marginal reward is 0 when cap hit — misleading assignment | debugger |
| C3-D03 | MEDIUM | High | `analyzer.ts:214-218` | Single-file previousMonthSpending bypasses exclusion filtering | debugger |
| C3-D06 | MEDIUM | Medium | `store.svelte.ts:229-243` | `reoptimize` can set result to stale state after page navigation | debugger |
| C3-S01 | MEDIUM | High | `llm-fallback.ts:39-41` | Error message reveals `ANTHROPIC_API_KEY` env var name | security-reviewer |
| C3-S02 | MEDIUM | High | `FileDropzone.svelte:110-132` | No file size limit on uploads — OOM risk | security-reviewer |
| C3-S03 | LOW | Medium | `store.svelte.ts:119-120` | sessionStorage parse errors silently swallowed | security-reviewer |
| C3-S04 | LOW | Medium | `Layout.astro:53` | No Subresource Integrity on external script | security-reviewer |
| C3-P01 | MEDIUM | High | `greedy.ts:84-110` | O(N^2*M) optimizer (already deferred as D-09) | perf-reviewer |
| C3-P02 | MEDIUM | High | `TransactionReview.svelte:236-295` | All transactions in DOM simultaneously (already deferred as D-25) | perf-reviewer |
| C3-P03 | LOW | High | `pdf.ts:236-244` | String concatenation in PDF extraction (already deferred as D-16) | perf-reviewer |
| C3-P04 | LOW | Medium | `cards.ts:159-173` | Separate fetch for categories.json when data is in cards.json | perf-reviewer, architect |
| C3-T01 | HIGH | High | `calculator/reward.ts` | No unit tests for `calculateRewards` | test-engineer |
| C3-T02 | HIGH | High | `optimizer/greedy.ts` | No unit tests for `greedyOptimize` | test-engineer |
| C3-T03 | MEDIUM | High | `parser/xlsx.ts` | No unit tests for web-side XLSX parser | test-engineer |
| C3-T04 | MEDIUM | High | `ui-ux-review.spec.js` | E2E tests use `waitForTimeout` instead of condition-based waits | test-engineer |
| C3-T05 | MEDIUM | High | `analyzer.ts:42-63` | No test for `toCoreCardRuleSets` type adapter | test-engineer |
| C3-A01 | MEDIUM | High | `greedy.ts:7-50` | Korean strings in core package (same as C3-03, C2-A01) | architect |
| C3-A02 | LOW | High | `cards.ts:159-173` | Redundant categories.json fetch (same as C3-P04) | architect |
| C3-A03 | LOW | Medium | `analyzer.ts` | Mixing parsing, categorization, and optimization orchestration | architect |
| C3-A04 | LOW | High | `csv.ts`, `xlsx.ts` | `inferYear` and `parseDateToISO` duplicated | architect |
| C3-U01 | MEDIUM | High | `SpendingSummary.svelte:15-21` | UTC/local timezone bug (same as C3-04) | designer |
| C3-U02 | MEDIUM | High | `FileDropzone.svelte:324-346` | 25 bank buttons on mobile — overwhelming | designer |
| C3-U05 | LOW | Medium | `cards/index.astro` | No loading skeleton for card list page | designer |

---

## Prioritized Action Items

### CRITICAL (must fix)
- None — all prior criticals are fixed

### HIGH (should fix this cycle)
1. C3-T01: Add unit tests for `calculateRewards` (monthly caps, tiers, fixed rewards, global caps)
2. C3-T02: Add unit tests for `greedyOptimize` (basic flow, edge cases)
3. C3-04/C3-U01: Fix `formatPeriod` timezone bug in `SpendingSummary.svelte`
4. C3-D03: Fix single-file previousMonthSpending bypassing exclusion filtering
5. C3-S02: Add file size limit on uploads

### MEDIUM (plan for next cycles or fix if time allows)
6. C3-07: Fix `editedTxs` sync to re-run on store result change
7. C3-01: Fix `findCategory` fuzzy match to select longest/best match
8. C3-02: Add warning for rules with null rate and null fixedAmount
9. C3-03/C3-A01: Pass category labels from taxonomy to optimizer
10. C3-D01: Validate `monthlyBreakdown` shape in `loadFromStorage`
11. C3-D06: Add version tracking to prevent stale `reoptimize` updates
12. C3-S01: Remove env var name from error message in LLM fallback
13. C3-T03: Add unit tests for web-side XLSX parser
14. C3-T04: Replace `waitForTimeout` with condition-based waits in E2E tests
15. C3-T05: Add tests for `toCoreCardRuleSets` type adapter
16. C3-U02: Improve bank selector UX for mobile

### LOW (defer or accept)
- C3-05, C3-06, C3-08, C3-D02, C3-D04, C3-S03, C3-S04, C3-P01 (D-09), C3-P02 (D-25), C3-P03 (D-16), C3-P04, C3-A02, C3-A03, C3-A04, C3-U03 (D-21), C3-U04, C3-U05

---

## Agent Failures

No agent failures. All 7 review angles completed successfully.
