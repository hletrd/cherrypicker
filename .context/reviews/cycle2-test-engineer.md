# Cycle 2 Test Engineering Review

## Review Scope
All test files across the repository.

---

## F-TEST-01: No XLSX parser tests for actual parsing behavior
**Severity: High | Confidence: High**
**File**: `packages/parser/__tests__/xlsx-parity.test.ts`

The only XLSX test (`xlsx-parity.test.ts`) checks that the server-side and web-side `BANK_COLUMN_CONFIGS` objects are equal. There are zero tests that actually parse XLSX data and verify transaction extraction. The XLSX parser handles HTML-as-XLS, serial date numbers, multi-sheet workbooks, header detection, column matching, and amount parsing — none of which are tested.

**Impact**: Regressions in XLSX parsing would go undetected. The entire XLSX parsing pipeline is untested.

---

## F-TEST-02: No PDF parser tests
**Severity: High | Confidence: High**
**File**: `packages/parser/__tests__/`

The PDF parser has a 3-tier approach (structured table parsing, fallback line scanning, LLM fallback) — none of which have any tests. The `table-parser.ts` with its column boundary detection, `extractor.ts` with page-level text extraction, and `llm-fallback.ts` with JSON extraction from LLM responses are all untested.

---

## F-TEST-03: No test for encoding detection (EUC-KR / CP949 / UTF-8)
**Severity: Medium | Confidence: High**
**File**: `packages/parser/__tests__/`, `apps/web/`

Neither the server-side nor web-side parser has tests for encoding detection. The server-side uses a replacement character ratio heuristic; the web-side tries multiple encodings and picks the one with fewest replacements. Both paths are untested with actual EUC-KR or CP949 encoded files.

---

## F-TEST-04: No test for `parseDateStringToISO` edge cases
**Severity: Medium | Confidence: High**
**File**: `packages/parser/__tests__/`

The `date-utils.ts` has 6 date format branches, year inference logic, and month-aware day validation. There are no dedicated unit tests for this function. Edge cases like Feb 29 (leap year), invalid dates like "2024-13-01" or "2024-02-30", and the year inference heuristic are untested.

---

## F-TEST-05: CSV adapter tests don't test edge cases per bank
**Severity: Medium | Confidence: High**
**File**: `packages/parser/__tests__/csv-adapters.test.ts`

The adapter tests only verify happy-path parsing of fixture files. They don't test:
- Column name variations (trailing spaces, parenthetical suffixes, alternative names)
- Metadata-heavy preambles per bank
- Missing optional columns (installments, category, memo)
- Mixed encoding within a single file
- Empty transaction sets

---

## F-TEST-06: No test for server-side `parseStatement` entry point
**Severity: Medium | Confidence: High**
**File**: `packages/parser/src/index.ts`

The top-level `parseStatement` function dispatches to CSV, XLSX, or PDF based on format detection. There are no integration tests for this function, including the encoding detection heuristic (replacement character ratio > 1 triggers CP949 fallback).

---

## F-TEST-07: Generic CSV parser test doesn't test data inference fallback
**Severity: Low | Confidence: High**
**File**: `packages/parser/__tests__/csv-adapters.test.ts` lines 193-199

The "handles reordered columns" test uses headers that still match keywords ('이용금액', '거래일시', '가맹점명'). The data-inference fallback path (lines 112-131 in generic.ts) that activates when headers don't match keywords is not tested. This path uses `isDateLike()` and `isAmountLike()` heuristics.

---

## F-TEST-08: Web-side parser has no unit tests
**Severity: Medium | Confidence: High**
**File**: `apps/web/src/lib/parser/`

The entire web-side parser suite (csv.ts, xlsx.ts, pdf.ts, detect.ts, date-utils.ts) has no dedicated unit tests. It relies on integration/E2E tests through Playwright. Direct unit tests would catch regressions faster and with less setup.