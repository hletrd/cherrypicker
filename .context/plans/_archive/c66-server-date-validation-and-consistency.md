# Cycle 66 Implementation Plan

## Actionable Fixes (scheduled for implementation this cycle)

### Task 1: Port month-aware day validation to server-side date-utils.ts (C66-01) -- DONE
**Priority:** HIGH (MEDIUM severity, consistency gap)
**Files:** `packages/parser/src/date-utils.ts`
**Status:** COMMITTED (`0000000dd6d9`) -- Added `daysInMonth()`, `isValidDayForMonth()`, replaced all 6 `day <= 31` checks with `isValidDayForMonth(year, month, day)`. Also removed redundant `day >= 1` pre-checks in MM/DD and Korean short-date branches.

### Task 2: Update server-side parser encoding from EUC-KR to CP949 (C66-06) -- DONE
**Priority:** MEDIUM (LOW severity, consistency gap)
**Files:** `packages/parser/src/index.ts`
**Status:** COMMITTED (`00000006ae3`) -- Replaced both `new TextDecoder('euc-kr')` calls with `new TextDecoder('cp949')`.

### Task 3: Remove redundant `day >= 1` pre-checks in web-side date-utils.ts (C66-09 / C65-02) -- DONE
**Priority:** LOW (LOW severity, style consistency)
**Files:** `apps/web/src/lib/parser/date-utils.ts`
**Status:** COMMITTED (`0000000a396`) -- Removed redundant `day >= 1` on lines 100 and 124 (MM/DD and Korean short-date branches).

### Task 4: Update build-stats.ts fallback values (C66-07 / C8-07) -- NO-OP
**Priority:** LOW (LOW severity, data freshness)
**Files:** `apps/web/src/lib/build-stats.ts`
**Status:** No change needed -- current cards.json meta values (683/24/45) already match the hardcoded fallbacks.

---

## Deferred Items (not scheduled for implementation this cycle)

All new findings from the review are either scheduled above or explicitly deferred here:

| Finding | Reason for deferral |
|---|---|
| C66-02 (cachedCategoryLabels stale) | Architectural change requiring cache-busting strategy. 10 cycles agree it's real but impact is limited (page refresh resolves). Exit criterion: add ETag/Last-Modified validation on fetch. |
| C66-03 (MerchantMatcher O(n) scan) | Algorithmic optimization requiring trie/Aho-Corasick implementation. 8 cycles agree. Exit criterion: when keyword count exceeds 10,000 or categorization latency becomes noticeable. |
| C66-04 (persistToStorage 'corrupted' for all non-quota) | Requires distinguishing error types in the UI with different user-facing messages. 5 cycles agree. Exit criterion: when users report misleading "corrupted" messages after non-quota errors. |
| C66-05 (FALLBACK_CATEGORIES hardcoded) | Same class as D-42/D-64/C64-03. Requires dynamic category loading or a generated fallback. Exit criterion: when new categories are added that aren't in the fallback list. |
| C66-08 (formatIssuerNameKo hardcoded map) | Same class as D-42. Requires extracting issuer names from cards.json at build time. Exit criterion: when new issuers are added without updating the map. |
| C66-10 (BANK_SIGNATURES duplication) | Same class as D-01/D-57. Requires the broader architectural refactor of unifying web and packages parser code. Exit criterion: when D-01 is resolved. |

---

## Archived Plans (fully implemented and done)

All prior cycle plans through cycle 65 are archived (see their respective plan files). This cycle's plan focuses only on the actionable fixes above.
