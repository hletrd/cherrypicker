# Cycle 3 Plan: Parser Format Diversity — Web Adapter ColumnMatcher, XLSX Tests, Consistency

## Status: DONE (Tasks 1-8 complete)

## Goal
Fix the highest-impact remaining gap (web-side bank adapters using exact indexOf), add XLSX/PDF test coverage, fix server/web consistency issues, and hoist keyword sets.

---

## Task 1: Web-side bank adapters — replace indexOf with ColumnMatcher findColumn
**Findings**: F-CR-01, F-CR-02 | **Severity**: High
**File**: `apps/web/src/lib/parser/csv.ts`

Replace all 10 bank adapters' `headers.indexOf('exact')` calls with `findColumn(headers, exactName, PATTERN)` from the existing `./column-matcher.js`. Also standardize header detection to use keyword arrays + category check (matching server-side adapter-factory behavior).

**Status**: DONE

---

## Task 2: Server-side XLSX — select best sheet (most transactions)
**Findings**: F-CR-03, F-ARCH-04 | **Severity**: Medium
**File**: `packages/parser/src/xlsx/index.ts` lines 117-124

Change from returning first sheet with transactions to selecting the sheet with the most transactions. Match web-side xlsx.ts behavior.

**Status**: DONE

---

## Task 3: Hoist category keyword Sets to module scope
**Findings**: F-PERF-04 | **Severity**: Low
**Files**: generic.ts, adapter-factory.ts, xlsx/index.ts, web/csv.ts

Move DATE_KEYWORDS, MERCHANT_KEYWORDS, AMOUNT_KEYWORDS from function scope to module scope in all 4 files.

**Status**: DONE

---

## Task 4: Fix server-side parseCSVAmount whitespace handling
**Findings**: F-DBG-06 | **Severity**: Low
**File**: `packages/parser/src/csv/shared.ts`

Add `.replace(/\s/g, '')` to match web-side behavior.

**Status**: DONE

---

## Task 5: Remove noisy console.warn from web date-utils
**Findings**: F-DBG-03 | **Severity**: Medium
**File**: `apps/web/src/lib/parser/date-utils.ts` line 140

Remove console.warn — parsers already report unparseable dates as ParseError.

**Status**: DONE

---

## Task 6: Add table-parser unit tests (parseTable, filterTransactionRows)
**Findings**: F-TEST-02 | **Severity**: High
**File**: `packages/parser/__tests__/table-parser.test.ts` (new)

Test column boundary detection, table parsing, transaction row filtering with synthetic text.

**Status**: DONE

---

## Task 7: Add XLSX parser unit tests with programmatic fixtures
**Findings**: F-TEST-01 | **Severity**: High
**File**: `packages/parser/__tests__/xlsx.test.ts` (new)

Generate XLSX fixtures using the xlsx library. Test HTML-as-XLS, serial dates, multi-sheet, column matching.

**Status**: DONE

---

## Task 8: Add tests for remaining 8 bank CSV adapters
**Findings**: F-TEST-04 | **Severity**: Medium
**File**: `packages/parser/__tests__/csv.test.ts`

Add parsing tests for hyundai, ibk, woori, shinhan, lotte, hana, nh, bc fixtures that already exist.

**Status**: DONE

---

## DEFERRED ITEMS (from this cycle)

### D-01: Refactor web-side CSV to adapter-factory pattern
**Findings**: F-ARCH-01, F-CR-05 | **Severity**: Medium
**Reason**: Task 1 fixes the immediate indexOf gap. Full factory refactor is a larger change.
**Exit criterion**: Web-side has unit tests AND adapter-factory ported to browser-compatible code.

### D-02: Centralize HEADER_KEYWORDS vocabulary
**Findings**: F-CR-06 | **Severity**: Medium
**Reason**: Web-side can't import from packages/parser without shared package.
**Exit criterion**: Shared module replaces 4 independent copies.

### D-03: Centralize BANK_COLUMN_CONFIGS
**Findings**: F-CR-07 | **Severity**: Medium
**Reason**: Same as D-02.
**Exit criterion**: Single source of truth.

### D-04: Add encoding detection tests
**Findings**: F-TEST-03 | **Severity**: Medium
**Reason**: Requires EUC-KR binary fixtures.
**Exit criterion**: EUC-KR fixture exists and produces correct Korean text.

### D-05: PDF text extraction size limit
**Findings**: F-SEC-01 | **Severity**: Low
**Exit criterion**: extractText caps at reasonable size.

### D-06: Improve generic CSV merchant inference
**Findings**: F-DBG-01 | **Severity**: Medium
**Exit criterion**: Prefers Korean text-heavy columns over arbitrary first column.

### D-07: Server-side date error reporting
**Findings**: F-DBG-02, F-CR-09 | **Severity**: Medium
**Exit criterion**: Server-side parsers report unparseable dates as ParseError.

### D-08: Inconsistent error message language
**Findings**: F-DOC-01, F-DES-01 | **Severity**: Low
**Exit criterion**: All error messages in Korean.
