# Test Engineer — cherrypicker (Cycle 13)

**Reviewer:** test-engineer
**Scope:** Test coverage, gaps, regression risks
**Date:** 2026-05-05

---

## Summary

Excellent progress on test coverage. Cycle 12's T12-01 (zero column-matcher tests) is fully resolved with 2500+ lines of comprehensive tests. Server-side parser tests cover all 7 formats. However, web-side parser tests remain sparse — only date and encoding tests exist, with no coverage for HTML, OFX, or JSON parsers. The PDF fallback trailing-minus bug (C13-03) would have been caught by a parity test.

---

## Verified Fixed

| Finding | File | Evidence |
|---------|------|----------|
| T12-01: Zero column-matcher tests | `packages/parser/__tests__/column-matcher.test.ts` | 2500+ lines, 100+ test cases covering all patterns, keyword Sets, combined headers, boundary guards, fullwidth normalization |
| T12-02: No isDateLike/isAmountLike tests | `packages/parser/__tests__/csv.test.ts` | Indirectly covered through parseCSV integration tests (C45-01, C60-01, C65-01, F20-02, F21-01) |

---

## New Findings (Cycle 13)

### [T13-01-MEDIUM] No web-side tests for HTML, OFX, JSON parsers

**Files:** `apps/web/__tests__/`
**Confidence:** High

The web-side test directory contains:
- `analyzer-adapter.test.ts`
- `formatters.test.ts`
- `parser-date.test.ts`
- `parser-encoding.test.ts`

Missing: `parser-html.test.ts`, `parser-ofx.test.ts`, `parser-json.test.ts`, `parser-xlsx.test.ts`, `parser-pdf.test.ts`, `parser-csv.test.ts`.

Server-side has tests for all formats. The web-side parsers are hand-maintained duplicates (D-01) and are at high risk of divergence.

**Fix:** Add web-side parser tests, or implement parity tests that run the same fixtures through both server and web parsers (T6-02).

---

### [T13-02-MEDIUM] No test for PDF fallback trailing-minus bug

**File:** `apps/web/src/lib/parser/pdf.ts:565`
**Confidence:** High

The fallback amount pattern's group 6 loses the trailing minus sign. No test covers this case. A test with a PDF line like `"2024-01-15 스타벅스 1,234-"` would reveal the bug.

**Fix:** Add a test fixture or unit test for trailing-minus amounts in PDF fallback parsing.

---

### [T13-03-LOW] No test for OFX negative amount conversion

**File:** `apps/web/src/lib/parser/ofx.ts:134-135`
**Confidence:** Medium

OFX parser converts negative amounts to positive via `Math.abs()`. No test verifies this behavior, and no test checks that refunds are handled consistently across formats.

---

### [T13-04-LOW] No test for JSON negative amount preservation

**File:** `apps/web/src/lib/parser/json.ts:98-100`
**Confidence:** Medium

JSON parser preserves negative amounts (unlike other formats). The existing server-side JSON test at `packages/parser/__tests__/json.test.ts:106-117` verifies this, but there's no web-side equivalent.

---

## Carry-overs

| ID | Severity | Description |
|---|---|---|
| T6-02 | HIGH | No parity tests between server-side and web-side parsers |
| T12-03 | LOW | No XLSX formula error cell tests (web-side) |
| T12-04 | LOW | No PDF multi-line cell tests |
| C9-08 | LOW | No test coverage for buildCategoryLabelMap edge cases |
| C9-09 | LOW | No test coverage for sessionStorage persistence/recovery |
