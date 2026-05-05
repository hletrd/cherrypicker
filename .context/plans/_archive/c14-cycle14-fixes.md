# Cycle 14 Implementation Plan

## Source: `.context/reviews/_aggregate.md` (Cycle 14)

## Scheduled for Implementation

### 1. C14-01: Fix `isValidISODate` to validate month/day ranges (HIGH)
- **Files:** `packages/parser/src/date-utils.ts:228`, `apps/web/src/lib/parser/date-utils.ts:242`
- **Description:** The regex `/^\d{4}-\d{2}-\d{2}$/` only validates format. Need to add month (01-12) and day (01-31, with month-aware upper bound) validation.
- **Implementation:** Update `isValidISODate` to parse the year/month/day components and validate ranges using `daysInMonth`. Reuse existing validation logic from `parseDateStringToISO` branches.
- **Tests:** Add tests for boundary values: "2024-00-01", "2024-13-01", "2024-01-99", "0000-00-00", "2024-02-30".

### 2. C14-02: Remove remaining `console.warn` calls (MEDIUM)
- **Files:** `apps/web/src/lib/analyzer.ts:58, 64`
- **Description:** Commit C11 claimed to remove stale console.warn but missed these in `toCoreCardRuleSets`.
- **Implementation:** Remove `console.warn` calls. Keep the fallback behavior (`'web'`, `'discount'`) but silently normalize without logging.
- **Also check:** `apps/web/src/lib/store.svelte.ts` for any remaining console.warn that should be removed.

### 3. C14-04: Combine duplicate imports in adapter-factory.ts (LOW)
- **File:** `packages/parser/src/csv/adapter-factory.ts:8-9`
- **Description:** Two import statements from same module.
- **Implementation:** Combine into single import statement.

### 4. C14-TEST-01: Add tests for `isValidISODate` invalid dates (MEDIUM)
- **Files:** `packages/parser/__tests__/date-utils.test.ts`, `apps/web/__tests__/parser-date.test.ts`
- **Description:** No existing test asserts that invalid ISO-like dates return false.
- **Implementation:** Add test cases for invalid dates in both server-side and web-side test files.

## Deferred

### C14-03: `renderPageText` hardcoded char width (MEDIUM)
- **Reason:** Requires understanding pdfjs-dist font metrics API. Low user impact. Can be addressed in a dedicated PDF quality cycle.
- **Exit criterion:** Research pdfjs-dist item.width availability and implement proper width calculation.

### C14-ARCH01: Parser duplication (web vs server) (MEDIUM)
- **Reason:** Major architectural refactor. Already deferred as D-01.
- **Exit criterion:** See D-01 deferred items.

### C14-05: `parseDateStringToISO` fullMatch end anchor (MEDIUM)
- **Reason:** The lack of end anchor is intentional for trailing delimiters. Changing it risks breaking valid Korean bank exports. Low confidence that this causes real issues.
- **Exit criterion:** Find a real-world statement where trailing non-delimiter text causes incorrect date parsing.

### C14-DB03: Fallback values bypass type safety (MEDIUM)
- **Reason:** Changing from silent normalization to explicit error would be a behavioral change that could break existing card rule ingestion. Needs product decision.
- **Exit criterion:** Decide whether unknown card sources/types should error or silently normalize.

### C14-TEST-02: `parseAmountString` multi-decimal test (LOW)
- **Reason:** Edge case with low probability in real bank data. Can be included in next test-focused cycle.
- **Exit criterion:** Next cycle with test additions.

### C14-DS01: Missing capture group comments (LOW)
- **Reason:** Documentation-only. Can be addressed when next PDF parser change is made.
- **Exit criterion:** Next PDF parser edit.

### C14-SEC02: ReDoS on long inputs (LOW)
- **Reason:** Credit card CSV cells are never >100 chars in practice. Theoretical concern only.
- **Exit criterion:** If real-world large-cell statements are encountered.
