# Review Aggregate — 2026-04-19 (Cycle 11)

**Source reviews (this cycle):**
- `.context/reviews/2026-04-19-cycle11-comprehensive.md` (multi-angle review)

**Prior cycle reviews (still relevant):**
- All cycle 1-10 per-agent and aggregate files

---

## Deduplication with Prior Reviews

All cycle 1-10 findings have been verified as fixed or deferred. Cycle 10 fixes (C10-01 through C10-13) are all correctly implemented. They are not re-listed here.

Deferred items D-01 through D-85 remain unchanged and are not re-listed here.

---

## Verification of Cycle 10 Fixes

All 3 implemented cycle 10 fixes verified as correctly implemented:
- C10-06: `handleUpload` now checks `analysisStore.error` before setting success status
- C10-09: `reoptimize` filters transactions to latest month via `getLatestMonth`
- C10-02: Minimum merchant name length guard added in `matcher.ts` and `taxonomy.ts`

---

## Active Findings (New in Cycle 11, Deduplicated)

| ID | Severity | Confidence | File | Description | Cross-ref |
|---|---|---|---|---|---|
| C11-01 | LOW | High | `greedy.ts:96-97` | Redundant recalculation in `scoreCardsForTransaction` | Extends D-09/D-51 |
| C11-02 | LOW | Low | `reward.ts:193-203` | Bucket object pattern fragile (theoretical) | New |
| C11-03 | LOW | High | `csv.ts:247-901` | Bank adapter code duplication | Extends D-01 |
| C11-04 | LOW | Medium | `OptimalCardMap.svelte:19` | Math.max spread overflow risk | Extends D-73 |
| C11-05 | LOW | High | `pdf.ts:23-58` | Column detection iterates all lines | New |
| C11-06 | LOW | Medium | `store.svelte.ts:163-203` | Shallow validation of nested optimization data | New |
| C11-07 | MEDIUM | Medium | `astro.config.ts` | No Content-Security-Policy headers | New |
| C11-08 | LOW | High | `greedy.ts:211-213` | Redundant Map creation from constraints.cards | New |
| C11-09 | LOW | High | `constraints.ts:17`, `greedy.ts:219` | Redundant array copy in buildConstraints | New |
| C11-10 | LOW | High | `reward.ts:200-203` | Default `rewardType: 'discount'` misleading for no-rule categories | New |
| C11-11 | LOW | High | `detect.ts:127-150` | Confidence 0 when no detection (internal only) | New |
| C11-12 | MEDIUM | High | `store.svelte.ts:334-363` | `monthlyBreakdown` stale after reoptimize with multi-month edits | New |
| C11-13 | MEDIUM | High | `categorizer.test.ts` | Missing tests for merchant name length guard | New |
| C11-14 | MEDIUM | High | `__tests__/` | Missing integration test for reoptimize latest-month filtering | New |
| C11-15 | LOW | High | `CategoryBreakdown.svelte:51` | "Other" group color is hardcoded gray | Extends D-42/D-64/D-78 |
| C11-16 | MEDIUM | High | `SpendingSummary.svelte:104` | "전월실적 0원" displayed for single-month data | New |
| C11-17 | MEDIUM | High | `TransactionReview.svelte:153-161` | Category select doesn't set subcategory correctly | New |
| C11-18 | LOW | Medium | `reward.ts:113-117` | normalizeRate assumption not validated at schema level | New |
| C11-19 | LOW | High | `csv.ts:82` vs `xlsx.ts:241` | parseInt vs raw number inconsistency | Extends D-67 |
| C11-20 | LOW | Medium | `store.svelte.ts:139-149` | isValidTx doesn't check amount for NaN/negative | New |

---

## Cross-Agent Agreement (Cycle 11)

| Finding | Signal |
|---|---|
| C11-12 | NEW — independent discovery. `monthlyBreakdown` is carried over from the original result and never recalculated after reoptimize. If a user edits transactions in a non-latest month, the breakdown for that month is stale. HIGH signal — this is a real consistency bug. |
| C11-17 | NEW — independent discovery. The category select in TransactionReview treats subcategory IDs as standalone categories instead of correctly setting `category` to the parent and `subcategory` to the child. This is a real UX/data-integrity bug. HIGH signal. |
| C11-16 | NEW — independent discovery. Single-month data shows "전월실적 0원 기준" which is misleading. The spending amount was actually computed from the transaction data. HIGH signal. |
| C11-07 | NEW — No CSP headers. Defense-in-depth improvement. MEDIUM signal. |
| C11-13/C11-14 | NEW — Missing test coverage for recent behavioral changes. HIGH signal — test gaps should be filled to prevent regression. |
| C11-01/C11-03/C11-04/C11-15/C11-19 | Same class as existing deferred items (D-09, D-01, D-73, D-42, D-67). No new signal. |

---

## Prioritized Action Items

### CRITICAL (must fix)
- None — all prior criticals are fixed

### HIGH (should fix this cycle)
1. C11-12: Recalculate `monthlyBreakdown` from `editedTransactions` after reoptimize
2. C11-17: Fix category select in TransactionReview to correctly set `category` (parent) and `subcategory` (child) when a subcategory is selected
3. C11-16: Fix SpendingSummary to hide or correctly display previous month spending for single-month data

### MEDIUM (plan for next cycles)
4. C11-07: Add Content-Security-Policy headers
5. C11-13: Add unit tests for merchant name length guard
6. C11-14: Add integration test for reoptimize latest-month filtering
7. C11-10: Change default `rewardType` for no-rule categories from 'discount' to 'none'

### LOW (defer or accept)
- C11-01 (extends D-09), C11-02, C11-03 (extends D-01), C11-04 (extends D-73), C11-05, C11-06, C11-08, C11-09, C11-11, C11-15 (extends D-42), C11-18, C11-19 (extends D-67), C11-20

---

## Agent Failures

No agent failures. Single comprehensive multi-angle review completed successfully.
