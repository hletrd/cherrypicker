# Cycle 2 Plan: Parser Format Diversity — Propagate ColumnMatcher, Fix XLSX Header Detection

## Status: IN PROGRESS

## Goal
Propagate the cycle 1 ColumnMatcher improvements to all parsers (XLSX, generic CSV), fix the critical XLSX header detection gap, and add key test coverage.

---

## Task 1: Fix server-side XLSX header detection — add category requirement
**Findings**: F-DBG-01, F-TRC-03 | **Severity**: High
**File**: `packages/parser/src/xlsx/index.ts` lines 161-169

Server-side XLSX only checks `matchCount >= 2`. Must add category-based check (date+merchant+amount keyword sets, require 2+ categories). Port from web-side xlsx.ts lines 378-387.

**Status**: TODO

---

## Task 2: Use ColumnMatcher patterns in server-side XLSX parser
**Findings**: F-CR-01, F-TRC-01 | **Severity**: Medium
**File**: `packages/parser/src/xlsx/index.ts` lines 193-198

Replace inline regexes with shared `DATE_COLUMN_PATTERN`, `MERCHANT_COLUMN_PATTERN`, etc. from `../csv/column-matcher.js`. Use `normalizeHeader()` for matching.

**Status**: TODO

---

## Task 3: Use ColumnMatcher patterns in server-side generic CSV parser
**Findings**: F-TRC-01 | **Severity**: Medium
**File**: `packages/parser/src/csv/generic.ts` lines 103-108

Replace inline regexes with shared column-matcher pattern constants.

**Status**: TODO

---

## Task 4: Add category-based header detection to adapter-factory
**Findings**: F-CR-02 | **Severity**: Medium
**File**: `packages/parser/src/csv/adapter-factory.ts` line 79

After finding a row with headerKeywords match, additionally verify keywords from 2+ categories. Matches generic parser behavior.

**Status**: TODO

---

## Task 5: Use ColumnMatcher patterns in web-side XLSX parser
**Findings**: F-TRC-01, F-ARCH-01 | **Severity**: Medium
**File**: `apps/web/src/lib/parser/xlsx.ts` lines 411-416

Create `apps/web/src/lib/parser/column-matcher.ts` mirroring the server-side version. Replace inline regexes in xlsx.ts.

**Status**: TODO

---

## Task 6: Standardize BOM stripping to unicode escape
**Findings**: F-VER-04, F-DOC-01 | **Severity**: Low
**File**: `packages/parser/src/csv/index.ts` line 35

Replace literal BOM character with explicit unicode escape for robustness.

**Status**: TODO

---

## Task 7: Use ColumnMatcher patterns in web-side generic CSV parser
**Findings**: F-TRC-01, F-ARCH-01 | **Severity**: Medium
**File**: `apps/web/src/lib/parser/csv.ts` lines 206-216

Replace inline regexes with shared column-matcher patterns.

**Status**: TODO

---

## Task 8: Add date-utils unit tests
**Findings**: F-TEST-04 | **Severity**: Medium
**File**: `packages/parser/__tests__/date-utils.test.ts` (new)

Test all date format branches, invalid dates, year inference, leap year handling.

**Status**: TODO

---

## Task 9: Add XLSX parser basic tests
**Findings**: F-TEST-01 | **Severity**: High (deferred — requires XLSX fixture creation)
**Reason**: Creating XLSX binary fixtures requires programmatic generation using the xlsx library.
**Exit criterion**: At least one XLSX fixture with parsing tests.

**Status**: DEFERRED

---

## Task 10: Add PDF parser basic tests
**Findings**: F-TEST-02 | **Severity**: High (deferred — requires PDF fixture or mocking)
**Reason**: Creating PDF test fixtures is non-trivial.
**Exit criterion**: table-parser.ts unit tests for parseTable() and filterTransactionRows().

**Status**: DEFERRED

---

## DEFERRED ITEMS (non-actionable this cycle)

### D-01: Refactor web-side CSV adapters to use adapter-factory
**Findings**: F-ARCH-01, F-CR-05, F-CR-09 | **Severity**: Medium
**File**: `apps/web/src/lib/parser/csv.ts`
**Reason**: Requires restructuring 1030-line file; should be done after web-side has unit tests.
**Exit criterion**: Web-side has unit tests AND adapter-factory ported to browser-compatible code.

### D-04: Add encoding detection tests
**Findings**: F-TEST-03 | **Severity**: Medium
**Reason**: Requires EUC-KR/CP949 binary test fixtures.
**Exit criterion**: EUC-KR fixture exists and produces correct Korean text.

### D-05: Centralize HEADER_KEYWORDS vocabulary
**Findings**: F-TRC-02 | **Severity**: Medium
**Reason**: Web-side can't import from packages/parser.
**Exit criterion**: Shared module replaces 4 independent copies.

### D-06: Server-side XLSX returns first sheet, not best
**Findings**: F-CR-03 | **Severity**: Low
**Exit criterion**: Server selects sheet with most transactions.

### D-07: Use isValidCSVAmount in adapter-factory
**Findings**: F-CR-04 | **Severity**: Low
**Exit criterion**: Adapter-factory uses shared helper.

### D-08: Improve generic CSV merchant inference
**Findings**: F-DBG-04 | **Severity**: Medium
**Exit criterion**: Prefers Korean text-heavy columns.

### D-09: PDF error messages for encrypted PDFs
**Findings**: F-DBG-06 | **Severity**: Low
**Exit criterion**: Encryption-specific error message.

### D-10: Web-side parseAmount whitespace handling
**Findings**: F-CR-06 | **Severity**: Low
**Exit criterion**: Matches server-side behavior.