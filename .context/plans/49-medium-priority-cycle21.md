# Plan 49 — Medium/Low-Priority Fixes (Cycle 21)

**Priority:** MEDIUM/LOW
**Findings addressed:** C21-TEST01, C21-TEST02, C21-TEST03, C21-TEST04
**Status:** TODO

---

## Task 1: Add full-width plus sign test to server-side csv-shared (C21-TEST01)

**Finding:** C21-TEST01 (LOW) — No test verifies `parseAmountString` handles full-width plus sign (`＋`).

**File:** `packages/parser/__tests__/csv-shared.test.ts`

**Implementation:**

Add a test case:
```ts
it('parses full-width plus sign prefix', () => {
  expect(parseAmountString('＋1,234')).toBe(1234);
  expect(parseAmountString('＋10000')).toBe(10000);
});
```

**Commit:** `test(parser): ✅ add full-width plus sign parsing test (C21-TEST01)`

---

## Task 2: Add web-side XLSX parser tests (C21-TEST02)

**Finding:** C21-TEST02 (LOW) — Web-side XLSX parser has zero test coverage.

**Files:** `apps/web/src/lib/parser/xlsx.ts`

**Implementation:**

Since web-side tests require browser environment (SheetJS, TextDecoder), create tests in `apps/web/__tests__/parser-xlsx.test.ts` or add to existing test infrastructure. If no web-side test runner is configured, add parity tests to `packages/parser/__tests__/xlsx.test.ts` that verify the server-side behavior matches what the web-side should do.

Minimum test coverage:
- `isHTMLContent` detection with HTML-as-XLS
- `parseDateToISO` with Excel serial numbers, YYYYMMDD, YYMMDD
- `parseAmountString` with full-width plus (after C21-03 fix)

**Commit:** `test(parser): ✅ add XLSX parser parity tests (C21-TEST02)`

---

## Task 3: Add web-side PDF parser unit tests for pure functions (C21-TEST03)

**Finding:** C21-TEST03 (LOW) — Web-side PDF parser has zero coverage.

**Files:** `apps/web/src/lib/parser/pdf.ts`

**Implementation:**

Extract and test the pure string-processing functions without pdfjs-dist:
- `parseAmount` — test with full-width digits, Won signs, etc.
- `parseDateToISO` — test date format parsing
- `isValidDateCell` — test validation logic
- `parseTable` — test table extraction from text

**Commit:** `test(parser): ✅ add PDF parser pure function tests (C21-TEST03)`

---

## Task 4: Add format detection tests (C21-TEST04)

**Finding:** C21-TEST04 (LOW) — No tests for `detectFormatFromFile` or `detectBank`.

**Files:** `apps/web/src/lib/parser/detect.ts`

**Implementation:**

Create tests for:
- Extension-based detection for all supported extensions
- Bank signature matching with confidence scoring
- Single-pattern bank confidence capping (C70-01)
- Content sniffing after C21-02 implementation

**Commit:** `test(parser): ✅ add format detection tests (C21-TEST04)`

---

## Progress

- [ ] Task 1: Add full-width plus sign test
- [ ] Task 2: Add XLSX parser tests
- [ ] Task 3: Add PDF parser pure function tests
- [ ] Task 4: Add format detection tests
