# Review Aggregate -- 2026-04-19 (Cycle 4 Re-review)

**Source reviews (this cycle):**
- `.context/reviews/2026-04-19-cycle4-comprehensive.md` (multi-angle comprehensive re-review)

**Prior cycle reviews (still relevant):**
- All cycle 1-50 per-agent and aggregate files
- Cycle 3 aggregate (`.context/reviews/_aggregate.md` prior version)

---

## Verification of Prior Cycle Fixes

All prior cycle 3, 47-50 findings are confirmed fixed:

| Finding | Status | Evidence |
|---|---|---|
| C3-M01 | **FIXED** | CLI `report.ts:139` passes `categoryLabels` to `buildConstraints` |
| C3-L01 | **FIXED** | CLI `report.ts:50-52` validates `Number.isNaN(prevSpending) \|\| prevSpending < 0` |
| C3-M02 | **PARTIALLY FIXED** | Shallow validation of cardResults entries added (`store.svelte.ts:179-188`) |
| C3-L02 | **STILL DEFERRED** | `getCardById` O(n) scan -- low priority |
| C47-L01 | **STILL FIXED** | Terminal `formatWon` has `Number.isFinite` guard + negative-zero normalization |
| C47-L02 | **STILL FIXED** | Terminal `formatRate` has `Number.isFinite` guard |
| C49-M01 | **STILL FIXED** | `llm-fallback.ts:84` has `let parsed: LLMTransaction[] = [];` |
| C50-M01 | **STILL FIXED** | Viz report generator and terminal summary accept `categoryLabels` parameter |
| C50-L01 | **STILL FIXED** | Report generator uses `replaceAll()` for template placeholder substitution |

---

## Verification of Prior C4 Findings (from original cycle 4)

| Finding | Status | Evidence |
|---|---|---|
| C4-01 | **FIXED** | `SavingsComparison.svelte:90` has `Number.isFinite(raw)` guard |
| C4-02 | **FIXED** | `analyzeMultipleFiles` passes prebuilt `categoryLabels` to `optimizeFromTransactions` |
| C4-03 | **FIXED** | Single-pass `monthlyTxCount` map in `analyzer.ts:298-302` |
| C4-04 | **FIXED** | `CategoryBreakdown.svelte:154-155` has `role="button"` and `tabindex="0"`, line 161 has `onkeydown` |
| C4-05 | **FIXED** | `analyzer.ts:225` passes `categoryLabels` directly to `buildConstraints` |
| C4-06 | **STILL OPEN** | Annual savings projection label unchanged (LOW) |
| C4-07 | **STILL OPEN** | localStorage vs sessionStorage inconsistency in SpendingSummary (LOW) |
| C4-08 | **FIXED** | `TransactionReview.svelte:142-150` uses `lastSyncedGeneration` counter |
| C4-09 | **STILL OPEN** | Hardcoded `CATEGORY_COLORS` in CategoryBreakdown (LOW) |
| C4-10 | **STILL OPEN** | E2E test stale dist/ dependency (MEDIUM) |
| C4-11 | **STILL OPEN** | No regression test for findCategory fuzzy match (MEDIUM) |
| C4-12 | **FIXED** | `FileDropzone.svelte:206` uses `Math.round(Number(v))` with `Number.isFinite` guard |
| C4-13 | **STILL OPEN** | Small-percentage bars nearly invisible (LOW) |
| C4-14 | **STILL OPEN** | Stale fallback values in Layout footer (LOW) |
| C4-15 | **FIXED** | `analyzer.ts:47,167-168` caches `cachedCoreRules` |

---

## Verification of Prior Deferred Fixes

| Finding | Status | Evidence |
|---|---|---|
| D-99 | **STILL FIXED** | `store.svelte.ts:147-148` has `Number.isFinite(tx.amount) && tx.amount > 0` |
| D-102 | **STILL FIXED** | `packages/core/src/index.ts:18` exports `buildCategoryKey` |
| D-106 | **STILL DEFERRED** | `apps/web/src/lib/parser/pdf.ts:284` bare `catch {}` |
| D-107 | **PARTIALLY ADDRESSED** | Server-side CSV adapter loop logs warnings, but content-signature adapter failures still not collected into ParseResult (see C4R-L01) |
| D-110 | **STILL DEFERRED** | Non-latest month edits have no visible optimization effect |

---

## Active Findings (New in Cycle 4 Re-review)

| ID | Severity | Confidence | File | Description | Status |
|---|---|---|---|---|---|
| C4R-M01 | MEDIUM | High | `tools/cli/src/commands/report.ts:143` | `printSpendingSummary` is never called from CLI report command -- terminal output missing spending-by-category table | NEW, needs fix |
| C4R-M02 | LOW | High | `packages/parser/src/csv/shinhan.ts:29` | Server-side CSV adapters' `parseAmount` returns NaN instead of 0 (inconsistent with PDF parsers' `return 0` pattern) | NEW, consistency |
| C4R-L01 | LOW | High | `packages/parser/src/csv/index.ts:60-62` | Content-signature adapter failures logged only to console.warn, not collected into ParseResult.errors (extends D-107) | NEW, observability |

---

## Agent Failures

No agent failures. Single comprehensive review completed successfully.
