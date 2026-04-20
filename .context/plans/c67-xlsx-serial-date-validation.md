# Cycle 67 Implementation Plan

## Actionable Fixes (scheduled for implementation this cycle)

### Task 1: Add month-aware day validation to XLSX serial-date path (C67-04)
**Priority:** HIGH (MEDIUM severity, validation consistency gap)
**Files:** `apps/web/src/lib/parser/xlsx.ts:187-204`, `packages/parser/src/xlsx/adapters/index.ts`

The XLSX parser's `parseDateToISO()` returns Excel serial date strings (from `XLSX.SSF.parse_date_code()`) without validating month/day ranges using `isValidDayForMonth()`. All other date parsing paths (CSV, PDF, string-based XLSX) now use `isValidDayForMonth()`. This is the same class of issue as C66-01 (server-side date-utils lacking month-aware validation), which was fixed last cycle.

**Implementation:**
1. In `apps/web/src/lib/parser/xlsx.ts`, import `daysInMonth` and `isValidDayForMonth` from `./date-utils.js` (or define locally if they're not exported).
2. After `XLSX.SSF.parse_date_code(raw)` produces `{y, m, d}`, add a validation check: `if (!isValidDayForMonth(y, m, d)) return String(raw);`
3. Repeat for `packages/parser/src/xlsx/adapters/index.ts` using the server-side `date-utils.ts` helpers.

### Task 2: Greedy optimizer `scoreCardsForTransaction` incremental result caching (C67-01)
**Priority:** LOW-MEDIUM (MEDIUM severity but large code change; deferred by 12+ cycles as D-09/D-51/D-86)
**Files:** `packages/core/src/optimizer/greedy.ts:120-146`

**Decision: DEFER** -- This is a performance optimization that has been consistently deferred since cycle 1 (D-09, D-51, D-86). With 683 cards and typical transaction counts (<1000), the latency is acceptable. The fix requires significant refactoring (per-card result caching with cache invalidation) and introduces complexity that could introduce regressions. Not scheduling for implementation this cycle.

---

## Deferred Items (not scheduled for implementation this cycle)

All new findings from the review are either scheduled above or explicitly deferred here:

| Finding | Reason for deferral |
|---|---|
| C67-01 (greedy optimizer O(m*n*k)) | Same class as D-09/D-51/D-86. 12+ cycles have deferred. With 683 cards and <1000 transactions, latency is acceptable. Exit criterion: when optimization latency exceeds 5s or card count exceeds 5000. |
| C67-02 (inferYear timezone-dependent) | Same class as C8-08/D-49. 59 cycles have deferred. Narrow edge case (minutes around midnight, once per year). Exit criterion: when tests become flaky due to date-dependent parsing. |
| C67-03 (CATEGORY_NAMES_KO hardcoded) | Same class as C64-03. TODO comment already acknowledges. CLI path only; web path uses live taxonomy. Exit criterion: when new categories are added without updating the map. |
| C67-05 (server-side XLSX serial-date validation) | Same class as C67-04 but server-side only (CLI). Will be fixed alongside C67-04 Task 1 if server-side xlsx adapters are modified. |

---

## Archived Plans (fully implemented and done)

All prior cycle plans through cycle 66 are archived (see their respective plan files). This cycle's plan focuses only on the actionable fixes above.
