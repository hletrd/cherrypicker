# Test Engineer — Cycle 3

## F-TEST-01: No XLSX parser tests for actual parsing behavior
**Severity: High | Confidence: High**
**File**: packages/parser/__tests__/xlsx-parity.test.ts

The only XLSX test checks config parity between server and web. Zero tests verify actual XLSX parsing (HTML-as-XLS, serial dates, multi-sheet, column matching, amount parsing). This was deferred from cycle 2.

## F-TEST-02: No PDF parser tests
**Severity: High | Confidence: High**
**File**: packages/parser/__tests__/

The PDF parser has a 3-tier approach (structured, fallback line scanning, LLM) — none tested. table-parser.ts column boundary detection, extractor.ts page extraction, and llm-fallback.ts JSON extraction are all untested. Deferred from cycle 2.

## F-TEST-03: No encoding detection tests (EUC-KR / CP949 / UTF-8)
**Severity: Medium | Confidence: High**

The detectFormat function always reads as UTF-8. No test verifies behavior with EUC-KR encoded files.

## F-TEST-04: CSV adapter tests only cover KB and Samsung
**Severity: Medium | Confidence: High**
**File**: packages/parser/__tests__/csv.test.ts

Only sample-kb.csv and sample-samsung.csv fixtures have parsing tests. 8 other bank adapters (hyundai, ibk, woori, shinhan, lotte, hana, nh, bc) have fixtures but no tests.

## F-TEST-05: No test for generic CSV parser with unknown bank
**Severity: Medium | Confidence: High**

The generic CSV parser is the fallback for unrecognized banks. No test verifies it works with non-bank CSV files that have valid Korean credit card headers.

## F-TEST-06: No test for semicolon/tab delimiter parsing end-to-end
**Severity: Low | Confidence: Medium**

detectCSVDelimiter is tested, but no test verifies that actual parsing works with non-comma delimiters.
