# Cycle 67 Implementation Plan

## Actionable Fixes (scheduled for implementation this cycle)

### Task 1: Add month-aware day validation to XLSX serial-date path (C67-04) -- DONE
**Priority:** HIGH (MEDIUM severity, validation consistency gap)
**Files:** `apps/web/src/lib/parser/xlsx.ts`, `packages/parser/src/xlsx/index.ts`, `apps/web/src/lib/parser/date-utils.ts`, `packages/parser/src/date-utils.ts`
**Status:** COMMITTED (`0000000441ce`, `00000002c67e`) -- Exported `daysInMonth`/`isValidDayForMonth` from both date-utils.ts files. Added `isValidDayForMonth()` validation to both web-side and server-side XLSX `parseDateToISO()` serial-date paths. Invalid serial dates now return the raw number as a string instead of producing impossible date strings like "2024-02-31".

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
