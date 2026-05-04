# Test Engineering Review — Cycle 1 (test-engineer)

## Scope
Full repository review focusing on test coverage gaps and TDD opportunities.

---

## C1-TE-01: No test fixtures for any bank-specific CSV format
**Severity: High | Confidence: High**

`packages/parser/__tests__/csv.test.ts` exists but the fixtures directory (`packages/parser/__tests__/fixtures/`) likely only contains `sample-kb.csv` and `sample-samsung.csv` (referenced in detect.test.ts). There are no test fixtures for hyundai, ibk, woori, shinhan, lotte, hana, nh, or bc CSV formats.

**Impact**: Bank-specific adapters are completely untested. If any adapter has a bug in header detection, column mapping, or row parsing, it would go undetected.

**Fix**: Create minimal test fixtures for each bank (2-3 transaction rows with realistic headers). Test that each adapter correctly parses its fixture.

---

## C1-TE-02: No tests for XLSX parsing
**Severity: High | Confidence: High**

`packages/parser/__tests__/xlsx-parity.test.ts` exists but there are no XLSX test fixture files visible. The XLSX parser has complex logic (HTML-as-XLS detection, serial date parsing, multi-sheet scanning, header keyword matching) that is entirely untested.

**Fix**: Create XLSX test fixtures for at least 2-3 banks. Test HTML-as-XLS detection, date parsing, amount parsing, and column detection.

---

## C1-TE-03: No tests for PDF parsing
**Severity: High | Confidence: High**

There are no PDF parser tests. The PDF parser has 3 tiers (structured table parsing, fallback line scanner, LLM fallback) with complex date/amount pattern matching. None of this is tested.

**Fix**: Create PDF text fixtures (pre-extracted text) and test the table parser, line scanner, and amount/date extraction.

---

## C1-TE-04: No tests for the generic CSV parser's data-driven column detection
**Severity: Medium | Confidence: High**

The generic CSV parser's second-pass column inference (scanning sample data rows for date-like and amount-like values) is untested. This is the parser's main resilience feature for unknown formats.

**Fix**: Test with CSV files that have non-standard headers but recognizable data patterns.

---

## C1-TE-05: No tests for edge cases in date parsing
**Severity: Medium | Confidence: High**

`packages/parser/src/date-utils.ts` has many date format branches but `packages/parser/__tests__/` doesn't have a date-utils test file. Web-side has `apps/web/__tests__/parser-date.test.ts` but server-side doesn't.

**Untested branches**:
- YYYYMMDD compact format
- YY-MM-DD short year
- Korean full date (2024년 1월 15일)
- Korean short date (1월 15일)
- Invalid date rejection (Feb 31, Apr 31)

**Fix**: Port the web-side date tests to the server-side, or create shared tests.

---

## C1-TE-06: No tests for encoding detection/fallback
**Severity: Medium | Confidence: Medium**

`packages/parser/src/index.ts` has CP949 fallback logic (lines 37-49) but no tests verify it works. The web-side has `apps/web/__tests__/parser-encoding.test.ts` but server-side doesn't.

**Fix**: Create a CP949-encoded test fixture and verify the fallback works.

---

## C1-TE-07: No tests for error handling paths
**Severity: Medium | Confidence: Medium**

No tests verify:
- Empty file handling
- Files with only headers (no data rows)
- Files with malformed amounts
- Files with summary/total rows mixed in
- Files with no recognizable header row

**Fix**: Add negative test cases for each error path.

---

## C1-TE-08: Web-side parser tests exist but may not cover all adapters
**Severity: Low | Confidence: Medium**

`apps/web/__tests__/parser-date.test.ts` and `apps/web/__tests__/parser-encoding.test.ts` exist but may only cover date/encoding, not the full bank adapter matrix.