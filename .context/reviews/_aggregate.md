# Review Aggregate -- 2026-04-19 (Cycle 51 Deep Re-review)

**Source reviews (this cycle):**
- `.context/reviews/2026-04-19-cycle51-comprehensive.md` (this cycle's review, full re-read of all 40+ source files)

**Prior cycle reviews (still relevant):**
- All cycle 1-50 per-agent and aggregate files

---

## Verification of Prior Cycle Fixes

All prior cycle 1-6, 47-50 findings are confirmed fixed except as noted below:

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

## Resolution of Prior "Still-Open" Findings

The following findings from cycle 7's aggregate are now **resolved**:

| Finding | Resolution | Evidence |
|---|---|---|
| C7R-M01 | **FALSE POSITIVE** | The `byCategory` Map has always been keyed by `categoryKey` (not `tx.category`). Subcategories are correctly separated into their own rows. Label resolution is correct. See `summary.ts:31-32` and `generator.ts:70`. |
| C7R-L01 | **RESOLVED** | `apps/web/src/lib/parser/pdf.ts:236` already uses `_bank` underscore prefix for intentionally unused parameter. |
| C7R-L02 | **RESOLVED** | `bun run lint` and `bun run typecheck` pass with 0 errors across all workspaces including `@cherrypicker/web`. |
| C7R-L03 | **RESOLVED** | `apps/web/src/lib/formatters.ts:153-156` and `164-168` both have `Number.isNaN` guards: `if (Number.isNaN(mNum) || Number.isNaN(dNum)) return '-';` |

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
| D-106 | LOW | `apps/web/src/lib/parser/pdf.ts:284` bare `catch {}` |
| D-107 | LOW | CSV adapter error collection (partially addressed; web-side missing error collection that server-side has) |
| D-110 | LOW | Non-latest month edits have no visible optimization effect |

---

## Agent Failures

No agent failures. Single comprehensive review completed successfully.
