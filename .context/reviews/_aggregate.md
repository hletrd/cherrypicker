# Review Aggregate -- 2026-04-19 (Cycle 9 Re-Review)

**Source reviews (this cycle):**
- `.context/reviews/2026-04-19-cycle9-re-review.md` (this cycle's review, full re-read of all 40+ source files)

**Prior cycle reviews (still relevant):**
- All cycle 1-51 per-agent and aggregate files
- Original C9 review: `.context/reviews/2026-04-19-cycle9-comprehensive.md`

---

## Verification of Prior Cycle Fixes

All prior cycle 1-6, 47-51 findings are confirmed fixed except as noted below:

| Finding | Status | Evidence |
|---|---|---|
| C7-01 | **FIXED** | `SavingsComparison.svelte:262` uses `formatRate(card.rate)` |
| C7-02 | **FIXED** | `SpendingSummary.svelte:111` uses `formatRatePrecise()` |
| C7-03 | **FIXED** | `SavingsComparison.svelte:179` uses `formatRatePrecise()` |
| C7-08 | **FIXED** | `pdf.ts` now has `inferYear()` and handles short Korean dates + MM/DD |
| C7-13 | **FIXED** | `analyzer.ts:167-168` caches by null check, not reference equality |
| C6R-M01 | **FIXED** | Server-side XLSX uses `Number.isNaN()` |
| C6R-M02 | **FIXED** | Web-side CSV/XLSX use `Number.isNaN()` |
| C47-L01 | **STILL FIXED** | Terminal `formatWon` has `Number.isFinite` guard + negative-zero normalization |
| C47-L02 | **STILL FIXED** | Terminal `formatRate` has `Number.isFinite` guard |

---

## C9 Fixes Verified This Cycle

| Finding | Status | Evidence |
|---|---|---|
| C9-01 | **FIXED** | `analyzer.ts:47,167-168` -- `cachedRulesRef` removed, cache uses null check |
| C9-02 | **DEFERRED** | UX enhancement -- redundant comparison UI when savings=0 |
| C9-03 | **FIXED** | `detect.ts` -- tie-breaking documented |
| C9-04 | **DEFERRED** | Maintainability concern -- regex works correctly |
| C9-05 | **FIXED** | `store.svelte.ts:419` -- error set when result is null |
| C9-06 | **DEFERRED** | Minor rounding threshold shift |
| C9-07 | **DEFERRED** | Theoretical stack overflow for extremely large arrays |
| C9-08 | **DEFERRED** | Comparison bars misleading when both rewards are 0 |
| C9-09 | **DEFERRED** | Same class as D-07/D-54 |
| C9-10 | **DEFERRED** | Minor perf optimization -- double decode in HTML-as-XLS |
| C9-11 | **FIXED** | `store.svelte.ts:143-149` -- non-empty checks for id, date, category |
| C9-12 | **DEFERRED** | Module-level cache persists across resets |
| C9-13 | **FIXED** | `analyzer.ts:357` -- monthlyBreakdown explicitly sorted by month |

---

## Resolution of Prior "Still-Open" Findings

The following findings from prior aggregates are now **resolved**:

| Finding | Resolution | Evidence |
|---|---|---|
| C7R-M01 | **FALSE POSITIVE** | The `byCategory` Map has always been keyed by `categoryKey` (not `tx.category`). Subcategories are correctly separated. |
| C7R-L01 | **RESOLVED** | `apps/web/src/lib/parser/pdf.ts:236` uses `_bank` underscore prefix |
| C7R-L02 | **RESOLVED** | `bun run lint` and `bun run typecheck` pass with 0 errors |
| C7R-L03 | **RESOLVED** | `apps/web/src/lib/formatters.ts:153-156` and `164-168` both have `Number.isNaN` guards |

---

## New Findings (This Cycle)

| ID | Severity | Confidence | File | Description |
|---|---|---|---|---|
| C9R-01 | LOW | HIGH | All 6 `parseDateToISO` implementations | Date validation uses `day <= 31` instead of month-specific day limits |

---

## Still-Open Deferred Findings (carried forward, not new)

| Finding | Severity | Note |
|---|---|---|
| C4-06 | LOW | Annual savings projection label unchanged |
| C4-07 | LOW | localStorage vs sessionStorage inconsistency in SpendingSummary |
| C4-09 | LOW | Hardcoded `CATEGORY_COLORS` in CategoryBreakdown |
| C4-10 | MEDIUM | E2E test stale dist/ dependency |
| C4-11 | MEDIUM | No regression test for findCategory fuzzy match |
| C4-13 | LOW | Small-percentage bars nearly invisible |
| C4-14 | LOW | Stale fallback values in Layout footer |
| C9-02 | LOW | Redundant comparison UI when savings=0 |
| C9-04 | LOW | Complex fallback date regex in PDF parser |
| C9-06 | LOW | Percentage rounding can shift "other" threshold |
| C9-07 | LOW | Math.max spread stack overflow risk (theoretical) |
| C9-08 | LOW | Comparison bars misleading when both rewards are 0 |
| C9-09 | LOW | Categories cache never invalidated (same as D-07/D-54) |
| C9-10 | LOW | HTML-as-XLS double-decode and unnecessary re-encode |
| C9-12 | LOW | Module-level cache persists across store resets |
| D-106 | LOW | `apps/web/src/lib/parser/pdf.ts:284` bare `catch {}` |
| D-107 | LOW | CSV adapter error collection (partially addressed; web-side now collects) |
| D-110 | LOW | Non-latest month edits have no visible optimization effect |

---

## Agent Failures

No agent failures. Single comprehensive review completed successfully.
