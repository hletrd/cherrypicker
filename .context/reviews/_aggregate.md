# Review Aggregate — 2026-04-19 (Cycle 8)

**Source reviews (this cycle):**
- `.context/reviews/2026-04-19-cycle8-comprehensive.md` (multi-angle review)

**Prior cycle reviews (still relevant):**
- All cycle 1-7 per-agent and aggregate files

---

## Deduplication with Prior Reviews

All cycle 1-7 findings have been verified as fixed or deferred. Cycle 7 fixes (C7-01 through C7-11) are all correctly implemented. They are not re-listed here.

Deferred items D-01 through D-61 and LOW items from cycle 7 remain unchanged and are not re-listed here.

---

## Verification of Cycle 7 Fixes

All 7 implemented cycle 7 fixes verified as correctly implemented:
- C7-08: Korean short-date and MM/DD parsing in PDF parser
- C7-01: formatRate in SavingsComparison breakdown
- C7-02: formatRatePrecise in SpendingSummary effective rate
- C7-03: formatRatePrecise in SavingsComparison best single card
- C7-11: persistWarningKind differentiation (truncated vs corrupted)
- C7-04: TransactionReview effect guard with lastSyncedGeneration
- C7-06: Documentation comment for all-month transactions behavior

---

## Active Findings (New in Cycle 8, Deduplicated)

| ID | Severity | Confidence | File | Description | Cross-ref |
|---|---|---|---|---|---|
| C8-01 | MEDIUM | High | `SpendingSummary.svelte:17-23` | `formatPeriod` uses `parseInt` without NaN guard on date parts | Extends D-58 |
| C8-02 | MEDIUM | High | `pdf.ts:303` | PDF fallback `fallbackDatePattern` doesn't match Korean/short dates — loses transactions | New |
| C8-03 | MEDIUM | High | `pdf.ts:182-188` | PDF structured `findDateCell` doesn't search Korean/short date formats — skips rows | New |
| C8-04 | LOW | Medium | `CardDetail.svelte:57-72` | Fetch race condition — no cleanup on component destroy | New |
| C8-05 | LOW | High | `SavingsComparison.svelte:71-75` | `savingsPct` divides by zero (NaN path) when bestSingleCard has 0 reward | New |
| C8-06 | LOW | High | `CategoryBreakdown.svelte:7-49` | CATEGORY_COLORS missing many categories from taxonomy | Extends D-42/D-46 |
| C8-07 | LOW | Medium | `detect.ts:114-137` | `detectBank` confidence score misleading with single-pattern banks | New |
| C8-08 | LOW | High | `CardGrid.svelte:22` | Issuer filter shows issuers with 0 cards after type filter | New |
| C8-09 | LOW | High | `analyzer.ts:172-184` | `optimizeFromTransactions` rebuilds category labels map on every reoptimize | New |
| C8-10 | LOW | Medium | `pdf.ts:177-180` | `parseAmount` uses `parseInt` which truncates instead of rounding | New |
| C8-11 | MEDIUM | High | `store.svelte.ts:154` | `_loadPersistWarningKind` not reset after consumption or in `reset()` | New |
| C8-12 | LOW | High | `TransactionReview.svelte:6` | AI categorizer import is dead code | Extends D-10 |
| C8-13 | LOW | High | `constraints.ts:17` | `buildConstraints` shallow-copies transactions — latent mutation risk | New |

---

## Cross-Agent Agreement (Cycle 8)

| Finding | Signal |
|---|---|
| C8-02 + C8-03 | Two related findings on the same root cause (PDF parser misses Korean/short dates in two different code paths). Combined signal is HIGH — these are real bugs that lose transactions. |
| C8-01 / D-58 | SpendingSummary.formatPeriod NaN guard is same class as formatDateKo/formatDateShort NaN guard (D-58). Combined signal is MEDIUM. |

---

## Prioritized Action Items

### CRITICAL (must fix)
- None — all prior criticals are fixed

### HIGH (should fix this cycle)
1. C8-02 + C8-03: Extend PDF fallback and structured parsers to match Korean date formats and short dates
2. C8-11: Reset `_loadPersistWarningKind` after consumption and in `reset()` method

### MEDIUM (plan for next cycles)
3. C8-01: Add NaN guard to `SpendingSummary.formatPeriod`
4. C8-09: Pass prebuilt category labels through reoptimize

### LOW (defer or accept)
- C8-04, C8-05, C8-06, C8-07, C8-08, C8-10, C8-12, C8-13

---

## Agent Failures

No agent failures. Single comprehensive review completed successfully.
