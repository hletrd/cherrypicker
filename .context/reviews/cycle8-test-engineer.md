# Cycle 8 Test Engineering Review

**Agent:** test-engineer
**Date:** 2026-05-06
**Scope:** Full repository — cherrypicker Korean credit card optimizer

---

## Findings

### C8-T1: No web-side parser tests verify negative amount handling

**Confidence:** High
**Severity:** Medium

**Files:**
- `apps/web/__tests__/parser-date.test.ts`
- `apps/web/__tests__/parser-encoding.test.ts`

The web app has tests for date parsing and encoding detection, but no tests for the parser modules (`pdf.ts`, `xlsx.ts`, `csv.ts`, `html.ts`, `json.ts`, `ofx.ts`). The analyzer tests (`analyzer-adapter.test.ts`) verify that negative amounts are excluded from spending calculations, but this is at the analysis layer — not the parser layer.

**Gap:** There is no test that feeds a PDF/XLSX/CSV file with a negative amount to the web-side parser and asserts that the amount is either skipped or preserved (matching server-side behavior).

**Fix:** Add parser-level tests for each format that verify negative amount handling. Example:
```ts
const result = parseCSV('date,amount\n2024-01-15,-50000');
expect(result.transactions).toHaveLength(0); // or assert amount is preserved
```

---

### C8-T2: No parity test suite between web and server parsers

**Confidence:** High
**Severity:** High

There is no automated test that runs the same input through both web-side and server-side parsers and compares outputs. The Cycle 7 and Cycle 8 parity regressions would have been caught by such a test.

**Fix:** Create a shared test fixture with sample inputs for each format (CSV, XLSX, PDF, HTML, JSON, OFX) and assert that web-side and server-side parsers produce identical `ParseResult` structures.

---

### C8-T3: build-json.ts has no tests

**Confidence:** Medium
**Severity:** Low

**File:** `scripts/build-json.ts`

The card rule validation and JSON generation script has no automated tests. Invalid YAML files could pass CI if the script exits 0 (see C8-03).

**Fix:** Add a test that runs the script against a known-invalid YAML file and asserts non-zero exit code.

---

## Test Coverage Summary

| Package | Tests | Coverage Gaps |
|---------|-------|---------------|
| `packages/core` | calculator, categorizer, optimizer | Good |
| `packages/parser` | 1403 tests across 14 files | Good server-side coverage |
| `packages/rules` | schema, category-names | Good |
| `packages/viz` | report generator | Good |
| `tools/cli` | commands, validation, consent | Good |
| `tools/scraper` | fetcher | Minimal |
| `apps/web` | analyzer-adapter, formatters, parser-date, parser-encoding | Missing parser-level tests |

---

## Recommendations

1. Add `apps/web/__tests__/parser-parity.test.ts` — cross-implementation parity tests
2. Add `apps/web/__tests__/parser-formats.test.ts` — web-side parser unit tests for each format
3. Test `scripts/build-json.ts` exit codes for invalid input
