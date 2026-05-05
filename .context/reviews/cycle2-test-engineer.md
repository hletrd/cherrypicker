# Cycle 2 Test Engineering Review

## Review Scope
All test files across the repository.

---

## F-TEST-01: No test catches FileDropzone errorMessage ReferenceError [CRITICAL]
**Severity: Critical | Confidence: High**
**File**: `apps/web/src/components/upload/FileDropzone.svelte`

The `errorMessage` vs `errorMessages` bug (declared plural, used singular) would be caught by any basic component test that triggers an error path. Currently there are zero unit tests for FileDropzone. A test that uploads an invalid file type or a file exceeding the size limit would immediately reveal the ReferenceError.

**Fix**: Add component tests for FileDropzone covering validation errors, upload errors, and retry paths.

---

## F-TEST-02: No test for refund/negative amount handling across parsers
**Severity: High | Confidence: High**
**Files**: `apps/web/src/lib/parser/csv.ts`, `html.ts`, `xlsx.ts`, `pdf.ts`

Four of five web parsers silently drop negative amounts (refunds). The JSON parser correctly preserves them. No tests verify that refunds survive parsing. A single test case with a negative amount in each format would reveal this inconsistency.

**Fix**: Add refund transaction test cases for CSV, HTML, XLSX, and PDF parsers.

---

## F-TEST-03: No XLSX parser tests for actual parsing behavior
**Severity: High | Confidence: High**
**File**: `packages/parser/__tests__/xlsx-parity.test.ts`

Only test checks that server/web BANK_COLUMN_CONFIGS are equal. No tests verify transaction extraction, serial dates, multi-sheet selection, or header detection.

---

## F-TEST-04: No PDF parser tests
**Severity: High | Confidence: High**
**File**: `packages/parser/__tests__/`

Zero tests for 3-tier PDF parsing (table parsing, line scanning, LLM fallback).

---

## F-TEST-05: No test for encoding detection (EUC-KR / CP949 / UTF-8)
**Severity: Medium | Confidence: High**
**Files**: `packages/parser/__tests__/`, `apps/web/`

Neither side tests encoding detection with actual EUC-KR or CP949 files.

---

## F-TEST-06: No test for `parseDateStringToISO` edge cases
**Severity: Medium | Confidence: High**
**File**: `packages/parser/__tests__/`

No tests for leap years, invalid dates, or year inference.

---

## F-TEST-07: CSV adapter tests don't test edge cases per bank
**Severity: Medium | Confidence: High**
**File**: `packages/parser/__tests__/csv-adapters.test.ts`

Only happy-path fixture parsing. No column variations, metadata preambles, missing columns, empty sets.

---

## F-TEST-08: No test for server-side `parseStatement` entry point
**Severity: Medium | Confidence: High**
**File**: `packages/parser/src/index.ts`

No integration tests for the top-level dispatcher including encoding detection.

---

## F-TEST-09: Generic CSV parser test doesn't test data inference fallback
**Severity: Low | Confidence: High**
**File**: `packages/parser/__tests__/csv-adapters.test.ts` lines 193-199

Data-inference fallback with `isDateLike()` and `isAmountLike()` is untested.

---

## F-TEST-10: Web-side parser has no unit tests
**Severity: Medium | Confidence: High**
**File**: `apps/web/src/lib/parser/`

Entire web-side parser suite has no dedicated unit tests. Relies on Playwright E2E.
