# Review Aggregate -- 2026-04-19 (Cycle 45)

**Source reviews (this cycle):**
- `.context/reviews/2026-04-19-cycle45-comprehensive.md` (multi-angle comprehensive review)

**Prior cycle reviews (still relevant):**
- All cycle 1-44 per-agent and aggregate files

---

## Deduplication with Prior Reviews

C45-L01 is a new finding about `formatWon(-0)` producing "-0원". Not previously reported.
C45-L02 is a new observation about SpendingSummary showing non-consecutive month spending as "전월실적". Not previously reported.
C45-L03 is a carry-over from D-42/D-46/D-64/D-78. Same finding, re-confirmed.
C45-L04 is a new finding about OptimalCardMap maxRate minimum being too large for very low rates. Not previously reported.

---

## Verification of Cycle 44 Fixes

| Finding | Status | Evidence |
|---|---|---|
| C44-L01 | **FIXED** | `SavingsComparison.svelte:55` now uses `if (target === 0 && displayedSavings === 0) return;` |
| C44-L02 | **STILL DEFERRED** | `packages/parser/src/csv/index.ts:56-65` still uses `catch { continue; }` for encoding detection |
| C44-L03 | **STILL DEFERRED** | `apps/web/src/lib/parser/pdf.ts:284` still uses bare `catch {}` |
| C44-L04 | **STILL DEFERRED** | Non-latest month edits have no visible optimization effect (D-110) |

---

## Verification of Prior Deferred Fixes

| Finding | Status | Evidence |
|---|---|---|
| D-99 | **STILL FIXED** | `apps/web/src/lib/store.svelte.ts:147-148` has `Number.isFinite(tx.amount) && tx.amount > 0` |
| D-28 | **STILL FIXED** | `apps/web/src/components/upload/FileDropzone.svelte:206` uses `Math.round(Number(v))` with `Number.isFinite(n) && n >= 0` guard |
| D-102 | **RESOLVED** | `packages/core/src/index.ts:18` now exports `buildCategoryKey` |

---

## Active Findings (New in Cycle 45)

| ID | Severity | Confidence | File | Description | Status |
|---|---|---|---|---|---|
| C45-L01 | LOW | Medium | `apps/web/src/lib/formatters.ts:5-8` | `formatWon(-0)` produces "-0원" instead of "0원" for negative zero | NEW -- cosmetic edge case |
| C45-L02 | LOW | Medium | `apps/web/src/components/dashboard/SpendingSummary.svelte:118` | "전월실적" label may show non-consecutive month's spending | NEW -- UX clarity |
| C45-L03 | LOW | High | `apps/web/src/components/dashboard/CategoryBreakdown.svelte:56-60` | getCategoryColor falls through to gray for missing categories (same as D-42/D-64/D-78) | CARRY-OVER from D-42 |
| C45-L04 | LOW | Medium | `apps/web/src/components/dashboard/OptimalCardMap.svelte:19` | `maxRate` uses `0.001` minimum which inflates bars when all rates are < 0.1% | NEW -- edge case |

---

## Agent Failures

No agent failures. Single comprehensive review completed successfully.
