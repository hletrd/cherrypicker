# Cycle 66 Implementation Plan

## Actionable Fixes (scheduled for implementation this cycle)

### Task 1: Port month-aware day validation to server-side date-utils.ts (C66-01)
**Priority:** HIGH (MEDIUM severity, consistency gap)
**Files:** `packages/parser/src/date-utils.ts`
**Description:** The web-side `parseDateStringToISO` uses `isValidDayForMonth(year, month, day)` (fixed in C63-04) while the server-side version still uses `day >= 1 && day <= 31`. Port `daysInMonth()`, `isValidDayForMonth()`, and the updated branch validation from `apps/web/src/lib/parser/date-utils.ts` to `packages/parser/src/date-utils.ts`.
**Steps:**
1. Add `daysInMonth()` and `isValidDayForMonth()` functions to server-side date-utils.ts
2. Replace all `day >= 1 && day <= 31` checks with `isValidDayForMonth(year, month, day)` in all 6 branches
3. Verify server-side parser tests still pass

### Task 2: Update server-side parser encoding from EUC-KR to CP949 (C66-06)
**Priority:** MEDIUM (LOW severity, consistency gap)
**Files:** `packages/parser/src/index.ts`
**Description:** The server-side parser falls back to `euc-kr` while the web-side uses `cp949` (fixed in C64-02). CP949 is a strict superset of EUC-KR. Update the server-side to use `cp949`.
**Steps:**
1. Replace `new TextDecoder('euc-kr')` with `new TextDecoder('cp949')` in `packages/parser/src/index.ts`
2. Verify the server-side parser still works with Korean-encoded files

### Task 3: Remove redundant `day >= 1` pre-checks in web-side date-utils.ts (C66-09 / C65-02)
**Priority:** LOW (LOW severity, style consistency)
**Files:** `apps/web/src/lib/parser/date-utils.ts`
**Description:** Lines 100 and 124 check `day >= 1` before calling `isValidDayForMonth(year, month, day)`, which itself checks `day >= 1`. Other branches don't have this redundant pre-check. Remove the redundant checks for consistency.
**Steps:**
1. In the MM/DD branch (line 100), replace `month >= 1 && month <= 12 && day >= 1` with `month >= 1 && month <= 12`
2. In the Korean short date branch (line 124), replace `month >= 1 && month <= 12 && day >= 1` with `month >= 1 && month <= 12`
3. Verify parser-date tests still pass

### Task 4: Update build-stats.ts fallback values (C66-07 / C8-07)
**Priority:** LOW (LOW severity, data freshness)
**Files:** `apps/web/src/lib/build-stats.ts`
**Description:** Hardcoded fallback values (totalCards: 683, totalIssuers: 24, totalCategories: 45) may be stale. Update to match current cards.json meta values.
**Steps:**
1. Read current `apps/web/public/data/cards.json` meta section to get actual values
2. Update fallback values in `build-stats.ts`

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
