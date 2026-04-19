# Review Aggregate — 2026-04-19 (Cycle 12)

**Source reviews (this cycle):**
- `.context/reviews/2026-04-19-cycle12-comprehensive.md` (multi-angle review)

**Prior cycle reviews (still relevant):**
- All cycle 1-11 per-agent and aggregate files

---

## Deduplication with Prior Reviews

All cycle 1-11 findings have been verified as fixed or deferred. Cycle 11 HIGH-priority findings (C11-12, C11-13, C11-16, C11-17) are all confirmed fixed in this cycle.

Deferred items D-01 through D-85 remain unchanged and are not re-listed here.

---

## Verification of Cycle 11 Fixes

All 4 implemented cycle 11 HIGH-priority fixes verified as correctly implemented:
- C11-12: `monthlyBreakdown` is now recalculated from `editedTransactions` after reoptimize (store.svelte.ts:352-365)
- C11-13: Merchant name length guard now has 6 dedicated test cases (categorizer.test.ts:249-306)
- C11-16: SpendingSummary checks `monthlyBreakdown.length > 1` before showing previous-month spending (SpendingSummary.svelte:101)
- C11-17: TransactionReview correctly uses `subcategoryToParent` map to set both `category` and `subcategory` (TransactionReview.svelte:160-175)

---

## Active Findings (New in Cycle 12, Deduplicated)

| ID | Severity | Confidence | File | Description | Cross-ref |
|---|---|---|---|---|---|
| C12-01 | LOW | High | `cards.ts:144-157` | Promise caching never invalidates for stale data | New |
| C12-02 | LOW | Medium | `analyzer.ts:47-48` | `cachedCoreRules` never invalidated | New |
| C12-03 | LOW | High | `csv.ts:29`, `xlsx.ts:183`, `pdf.ts:132` | `inferYear` duplicated 3 times | Extends D-01 |
| C12-04 | LOW | High | `csv.ts:39`, `xlsx.ts:192`, `pdf.ts:141` | `parseDateToISO` duplicated 3 times | Extends D-01 |
| C12-05 | LOW | Medium | `parser/index.ts:19,43,48` | No size validation in `parseFile` before buffer read | New |
| C12-06 | MEDIUM | Medium | `astro.config.ts` | No CSP headers | Same as C11-07 |
| C12-07 | LOW | High | `cards.ts`, `rules/types.ts` | `CardRuleSet` type drift across packages | New |
| C12-08 | LOW | Medium | `store.svelte.ts:146` | `isValidTx` allows `amount: 0` | Extends C11-20 |
| C12-09 | LOW | High | `reward.ts:193-289` | Bucket get-mutate-set pattern confusing | New |
| C12-10 | MEDIUM | High | `apps/web/__tests__/` | Missing integration test for multi-file upload | Extends C11-14 |
| C12-11 | MEDIUM | High | `apps/web/__tests__/` | Missing test for reoptimize with subcategory changes | New |
| C12-12 | LOW | High | `FileDropzone.svelte:211` | Full page reload after success | Extends D-47/C5-04 |
| C12-13 | LOW | Medium | `TransactionReview.svelte:150` | Korean search is case-exact (correct behavior) | New |
| C12-14 | MEDIUM | High | `xlsx.ts:241-243` | XLSX parseAmount returns raw float — no rounding | Extends C11-19/D-67 |
| C12-16 | LOW | Medium | `store.svelte.ts:146` | `isValidTx` doesn't check `Number.isFinite` | Same as C11-20 |

---

## Cross-Agent Agreement (Cycle 12)

| Finding | Signal |
|---|---|
| C12-14 | NEW — XLSX parseAmount returns raw float. This is a concrete correctness issue: non-integer Won amounts will produce incorrect reward calculations. HIGH signal — should be fixed this cycle. |
| C12-10/C12-11 | NEW — Missing test coverage for multi-file and subcategory reoptimize. HIGH signal — test gaps should be filled to prevent regression. |
| C12-06 | CARRIED from C11-07 — No CSP headers. MEDIUM signal. Defense-in-depth improvement. |
| C12-03/C12-04 | Same class as D-01 (parser code duplication). Specific callout for `inferYear` and `parseDateToISO` as particularly sensitive duplications. No new signal beyond D-01. |

---

## Prioritized Action Items

### CRITICAL (must fix)
- None — all prior criticals are fixed

### HIGH (should fix this cycle)
1. C12-14: Add `Math.round()` in XLSX `parseAmount` numeric path to ensure Won amounts are always integers
2. C12-10: Add integration test for multi-file upload with different months
3. C12-11: Add test for reoptimize with subcategory changes

### MEDIUM (plan for next cycles)
4. C12-06: Add Content-Security-Policy headers (same as C11-07)
5. C12-16/C12-08: Strengthen `isValidTx` to check `Number.isFinite` and positive amount

### LOW (defer or accept)
- C12-01 (acceptable for static site), C12-02 (acceptable — rules are static), C12-03/C12-04 (extends D-01), C12-05 (defense-in-depth), C12-07 (type drift is bridged by adapter), C12-09 (code clarity), C12-12 (extends D-47), C12-13 (correct behavior)

---

## Agent Failures

No agent failures. Single comprehensive multi-angle review completed successfully.
