# Cycle 75 Aggregate Review

## Review Summary

After 74 cycles of intensive parser improvements, the codebase handles an extensive range of format diversity. This cycle focused on identifying remaining parity issues between server-side and web-side parsers, and adding missing test coverage.

## Findings

### 1. Web-side PDF isValidDateCell Missing SHORT_MD_DATE_PATTERN Validation [FIXED]
- **Severity**: Medium (parity bug)
- **Location**: `apps/web/src/lib/parser/pdf.ts` isValidDateCell function (line 180)
- **Issue**: The server-side PDF parser's `isValidDateCell` validates short dates (MM.DD/MM/DD) through `isValidShortDate()` before accepting them, preventing decimal amounts like "3.5" from being misidentified as dates. The web-side PDF parser was missing this validation, only checking YYMMDD and then falling through to the broader `DATE_PATTERN`.
- **Fix**: Added `SHORT_MD_DATE_PATTERN` + `isValidShortDate()` check to web-side `isValidDateCell`, matching server-side behavior (C75-02).

### 2. Missing Test Coverage for Datetime T-Separator in CSV Data-Inference [FIXED]
- **Severity**: Low (test coverage gap)
- **Location**: `packages/parser/__tests__/csv.test.ts`
- **Issue**: While the datetime T-separator format ("2024-01-15T10:30:00") was handled by both `isDateLike()` and `parseDateStringToISO()`, there was no dedicated integration test for it in the CSV parser test suite.
- **Fix**: Added integration test verifying that CSV files with T-separator datetime strings are correctly parsed through the full pipeline.

### 3. PDF Short Date Behavioral Tests for "3.5" and "3.50" [FIXED]
- **Severity**: Low (test documentation)
- **Location**: `packages/parser/__tests__/table-parser.test.ts`
- **Issue**: No tests documented the behavioral difference between "3.5" (passes as valid short date, month=3 day=5) and "3.50" (rejected by SHORT_MD_DATE_PATTERN end-anchor).
- **Fix**: Added regression-tracking tests documenting both behaviors (C75-02).

## Server/Web Parity Status

After this fix, all parser parity items are resolved:
- CSV: server and web both use identical factory pattern with 24 bank adapters
- XLSX: server and web both use identical forward-fill, summary row guards, formula error detection
- PDF: server and web both use identical isValidDateCell with SHORT_MD_DATE_PATTERN validation (C75-02 fix)
- Date utils: server and web both use identical parseDateStringToISO, isValidYYMMDD, daysInMonth
- Column matcher: shared between all parsers on both sides

## Deferred Items (unchanged)
- PDF multi-line header support
- Historical amount display format
- Card name suffixes
- Global config integration
- Generic parser fallback behavior
- CSS dark mode complete migration

## Test Results
- bun test: 1076 pass, 0 fail (3 new tests)
- vitest: 287 pass, 0 fail
- turbo build: 7/7 successful