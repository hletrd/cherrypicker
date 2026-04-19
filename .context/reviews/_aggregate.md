# Review Aggregate -- 2026-04-19 (Cycle 5 Re-review)

**Source reviews (this cycle):**
- `.context/reviews/2026-04-19-cycle5-comprehensive.md` (multi-angle comprehensive re-review)

**Prior cycle reviews (still relevant):**
- All cycle 1-50 per-agent and aggregate files

---

## Verification of Prior Cycle Fixes

All prior cycle 3, 4, 47-50 findings are confirmed fixed:

| Finding | Status | Evidence |
|---|---|---|
| C3-M01 | **FIXED** | CLI `report.ts:139` passes `categoryLabels` to `buildConstraints` |
| C3-L01 | **FIXED** | CLI `report.ts:50-52` validates `Number.isNaN(prevSpending) \|\| prevSpending < 0` |
| C3-M02 | **PARTIALLY FIXED** | Shallow validation of cardResults entries added (`store.svelte.ts:179-188`) |
| C3-L02 | **STILL DEFERRED** | `getCardById` O(n) scan -- low priority |
| C4-01 | **FIXED** | `SavingsComparison.svelte:90` has `Number.isFinite(raw)` guard |
| C4-02 | **FIXED** | `analyzeMultipleFiles` passes prebuilt `categoryLabels` to `optimizeFromTransactions` |
| C4-03 | **FIXED** | Single-pass `monthlyTxCount` map in `analyzer.ts:298-302` |
| C4-04 | **FIXED** | `CategoryBreakdown.svelte:154-155` has `role="button"` and `tabindex="0"`, line 161 has `onkeydown` |
| C4-05 | **FIXED** | `analyzer.ts:225` passes `categoryLabels` directly to `buildConstraints` |
| C4-08 | **FIXED** | `TransactionReview.svelte:142-150` uses `lastSyncedGeneration` counter |
| C4-12 | **FIXED** | `FileDropzone.svelte:206` uses `Math.round(Number(v))` with `Number.isFinite` guard |
| C4-15 | **FIXED** | `analyzer.ts:47,167-168` caches `cachedCoreRules` |
| C4R-M01 | **FIXED** | `report.ts:143` calls `printSpendingSummary(categorized, categoryLabels)` |
| C4R-M02 | **FIXED** | Server-side CSV adapter `parseAmount` returns 0 instead of NaN |
| C4R-L01 | **FIXED** | Content-signature adapter failures collected into `ParseResult.errors` |
| C47-L01 | **STILL FIXED** | Terminal `formatWon` has `Number.isFinite` guard + negative-zero normalization |
| C47-L02 | **STILL FIXED** | Terminal `formatRate` has `Number.isFinite` guard |
| C49-M01 | **STILL FIXED** | `llm-fallback.ts:84` has `let parsed: LLMTransaction[] = [];` |
| C50-M01 | **STILL FIXED** | Viz report generator and terminal summary accept `categoryLabels` parameter |
| C50-L01 | **STILL FIXED** | Report generator uses `replaceAll()` for template placeholder substitution |
| C5-01 (old) | **FIXED** | `reoptimize()` now increments `generation` |
| C5-03 (old) | **FIXED** | OptimalCardMap rows have `role="button"` and `tabindex="0"` |

---

## Still-Open Prior Findings (carried forward, not new)

| Finding | Severity | Note |
|---|---|---|
| C4-06 | LOW | Annual savings projection label unchanged |
| C4-07 | LOW | localStorage vs sessionStorage inconsistency in SpendingSummary |
| C4-09 | LOW | Hardcoded `CATEGORY_COLORS` in CategoryBreakdown |
| C4-10 | MEDIUM | E2E test stale dist/ dependency |
| C4-11 | MEDIUM | No regression test for findCategory fuzzy match |
| C4-13 | LOW | Small-percentage bars nearly invisible |
| C4-14 | LOW | Stale fallback values in Layout footer |

---

## Verification of Prior Deferred Fixes

| Finding | Status | Evidence |
|---|---|---|
| D-99 | **STILL FIXED** | `store.svelte.ts:147-148` has `Number.isFinite(tx.amount) && tx.amount > 0` |
| D-102 | **STILL FIXED** | `packages/core/src/index.ts:18` exports `buildCategoryKey` |
| D-106 | **STILL DEFERRED** | `apps/web/src/lib/parser/pdf.ts:284` bare `catch {}` |
| D-107 | **PARTIALLY ADDRESSED** | Server-side CSV adapter loop logs warnings and collects failures, but web-side CSV adapter failures still not collected into ParseResult |
| D-110 | **STILL DEFERRED** | Non-latest month edits have no visible optimization effect |

---

## Active Findings (New in Cycle 5)

| ID | Severity | Confidence | File | Description | Status |
|---|---|---|---|---|---|
| C5-M01 | MEDIUM | High | `packages/parser/src/csv/*.ts` (all 10 adapters) | Server-side CSV `parseAmount` returns 0 on NaN but callers still check `isNaN()` -- dead code, invalid amounts silently become 0-amount transactions | NEW, needs fix |
| C5-M02 | MEDIUM | High | `packages/parser/src/csv/*.ts` (all 10 adapters) | `isNaN()` used instead of `Number.isNaN()` -- inconsistent with PDF parser and web-side | NEW, consistency fix |
| C5-L01 | LOW | High | `packages/parser/src/csv/*.ts` vs `apps/web/src/lib/parser/csv.ts` | Duplicate parser logic with inconsistent date coverage (already D-01) | Already deferred |
| C5-L02 | LOW | High | `packages/parser/src/pdf/table-parser.ts:37` | Unused `nextCount` variable (dead code) | NEW, low priority |

---

## Agent Failures

No agent failures. Single comprehensive review completed successfully.
