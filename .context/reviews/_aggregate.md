# Review Aggregate -- 2026-04-19 (Cycle 6 Re-review)

**Source reviews (this cycle):**
- `.context/reviews/2026-04-19-cycle6-comprehensive.md` (multi-angle comprehensive re-review)

**Prior cycle reviews (still relevant):**
- All cycle 1-50 per-agent and aggregate files

---

## Verification of Prior Cycle Fixes

All prior cycle 3-5, 47-50 findings are confirmed fixed:

| Finding | Status | Evidence |
|---|---|---|
| C3-M01 | **FIXED** | CLI `report.ts:139` passes `categoryLabels` to `buildConstraints` |
| C3-L01 | **FIXED** | CLI `report.ts:50-52` validates `Number.isNaN(prevSpending)` |
| C3-M02 | **PARTIALLY FIXED** | Shallow validation of cardResults entries added (`store.svelte.ts:179-188`) |
| C3-L02 | **STILL DEFERRED** | `getCardById` O(n) scan -- low priority |
| C4-01 | **FIXED** | `SavingsComparison.svelte` has `Number.isFinite(raw)` guard |
| C4-02 | **FIXED** | `analyzeMultipleFiles` passes prebuilt `categoryLabels` to `optimizeFromTransactions` |
| C4-03 | **FIXED** | Single-pass `monthlyTxCount` map in `analyzer.ts:298-302` |
| C4-04 | **FIXED** | `CategoryBreakdown.svelte:154-155` has `role="button"` and `tabindex="0"`, line 161 has `onkeydown` |
| C4-05 | **FIXED** | `analyzer.ts:225` passes `categoryLabels` directly to `buildConstraints` |
| C4-08 | **FIXED** | `TransactionReview.svelte:142-150` uses `lastSyncedGeneration` counter |
| C4-12 | **FIXED** | `FileDropzone.svelte:206` uses `Math.round(Number(v))` with `Number.isFinite` guard |
| C4-15 | **FIXED** | `analyzer.ts:47,167-168` caches `cachedCoreRules` |
| C4R-M01 | **FIXED** | `report.ts:143` calls `printSpendingSummary(categorized, categoryLabels)` |
| C4R-M02 | **FIXED** | Server-side CSV adapters `parseAmount` returns NaN, callers use `Number.isNaN()` |
| C4R-L01 | **FIXED** | Content-signature adapter failures collected into `ParseResult.errors` |
| C5-M01 | **FIXED** | Server-side CSV `parseAmount` returns NaN, callers use `Number.isNaN()` |
| C5-M02 | **FIXED** | All server-side CSV adapters use `Number.isNaN()` instead of `isNaN()` |
| C5-L02 | **FIXED** | Unused `nextCount` variable removed from `table-parser.ts` |
| C47-L01 | **STILL FIXED** | Terminal `formatWon` has `Number.isFinite` guard + negative-zero normalization |
| C47-L02 | **STILL FIXED** | Terminal `formatRate` has `Number.isFinite` guard |
| C49-M01 | **STILL FIXED** | `llm-fallback.ts:84` has `let parsed: LLMTransaction[] = [];` |
| C50-M01 | **STILL FIXED** | Viz report generator and terminal summary accept `categoryLabels` parameter |
| C50-L01 | **STILL FIXED** | Report generator uses `replaceAll()` for template placeholder substitution |
| C6-01 | **FIXED** | `SavingsComparison.svelte` no longer stores stale `rate`, only computed in `.map()` |
| C6-02 | **FIXED** | `persistWarningKind` implemented in `store.svelte.ts`, UI in `SpendingSummary.svelte` |
| C6-03 | **FIXED** | Count-up animation starts from current displayed value instead of 0 |
| C6-07 | **FIXED** | AI categorizer clears subcategory when changing category |
| C6-11 | **FIXED** | `formatRatePrecise` added to formatters.ts and used in SavingsComparison |

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

## Active Findings (New in Cycle 6)

| ID | Severity | Confidence | File | Description | Status |
|---|---|---|---|---|---|
| C6R-M01 | MEDIUM | High | `packages/parser/src/xlsx/index.ts:137,147` | Server-side XLSX parser uses `isNaN()` instead of `Number.isNaN()` | NEW, needs fix |
| C6R-M02 | LOW | High | `apps/web/src/lib/parser/csv.ts` (11 occurrences), `apps/web/src/lib/parser/xlsx.ts:304` | Web-side CSV/XLSX adapters use `isNaN()` for installment parsing | NEW, consistency fix |

---

## Agent Failures

No agent failures. Single comprehensive review completed successfully.
