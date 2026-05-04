# Code Review -- Cycle 56

## Reviewer: code-reviewer
## Focus: Format diversity edge cases, "KRW" prefix, test coverage gaps

### C56-01: "KRW" currency prefix not handled by amount parsers (ACTIONABLE)
**Severity:** Medium | **Kind:** Format diversity gap

Korean bank CSV/XLSX exports sometimes prefix amounts with "KRW" (ISO 4217 currency code), e.g., "KRW 10,000" or "KRW10,000". Six `parseAmount` implementations across server and web strip `₩`, `￦`, `원` but NOT "KRW". A cell containing "KRW 10,000" normalizes to "KRW10000" which `parseFloat` returns as `NaN`, silently dropping the transaction.

Additionally, AMOUNT_PATTERNS in the generic CSV parser's `isAmountLike()` column-detection don't recognize "KRW" prefixed values, so columns with KRW amounts won't be detected during data-inference.

**Affected files (amount parsing):**
- `packages/parser/src/csv/shared.ts` (parseCSVAmount, line ~37)
- `packages/parser/src/xlsx/index.ts` (parseAmount, line ~119)
- `packages/parser/src/pdf/index.ts` (parseAmount, line ~48)
- `apps/web/src/lib/parser/csv.ts` (parseAmount, line ~67)
- `apps/web/src/lib/parser/xlsx.ts` (parseAmount, line ~274)
- `apps/web/src/lib/parser/pdf.ts` (parseAmount, line ~270)

**Affected files (column detection):**
- `packages/parser/src/csv/generic.ts` (AMOUNT_PATTERNS, line ~77)
- `apps/web/src/lib/parser/csv.ts` (AMOUNT_PATTERNS, line ~191)

**Fix:** Add `.replace(/^KRW\s*/i, '')` to amount cleaning chains. Add KRW pattern to AMOUNT_PATTERNS.

### C56-02: XLSX parity test only checks column configs (ACTIONABLE - test)
**Severity:** Low | **Kind:** Test coverage gap
**File:** `packages/parser/__tests__/xlsx-parity.test.ts`

The xlsx-parity test only verifies `BANK_COLUMN_CONFIGS` alignment. It should also verify SUMMARY_ROW_PATTERN, HEADER_KEYWORDS, column pattern regexes, and isValidHeaderRow behavior consistency between server and web.

### C56-03: No test for CSV generic parser with numeric-only headers (ACTIONABLE - test)
**Severity:** Low | **Kind:** Test coverage gap
**File:** `packages/parser/__tests__/csv.test.ts`

Some CSV exports have purely numeric column headers (e.g., "1", "2", "3"). The `hasNonNumeric` guard in the generic parser correctly rejects these, but there's no test documenting this behavior.

### C56-04: parseCSVAmount missing early return for empty string (ACTIONABLE - minor)
**Severity:** Very low | **Kind:** Robustness
**File:** `packages/parser/src/csv/shared.ts`

`parseCSVAmount('')` processes the empty string through all normalization steps (regex replacements, prefix detection, parseFloat) before returning null. An early return for empty/whitespace-only input would be cleaner.

### Parity Check (all pass)
- Server/web column-matcher: PARITY
- Server/web date-utils: PARITY
- Server/web SUMMARY_ROW_PATTERN: PARITY
- Server/web HEADER_KEYWORDS: PARITY
- Server/web AMOUNT_PATTERNS: PARITY
- Server/web XLSX column configs: PARITY (24 banks each)
- No regressions detected

### Test Coverage
- 826 bun + 265 vitest = 1091 total tests passing
- Fullwidth amount tests present in csv-shared.test.ts
- Combined header tests cover "/" "|" "," "+" "＋" delimiters
- SUMMARY_ROW_PATTERN has boundary guard tests