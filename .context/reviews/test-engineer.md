# Test Engineer Review -- Cycle 21

## New Test Cases Needed

### 1. isDateLikeShort month-aware validation (F21-01)

Add tests in `packages/parser/__tests__/csv.test.ts` (or a new CSV column-detection test) to verify:
- "2/31" is NOT recognized as a date (Feb has 28 days max)
- "4/31" is NOT recognized as a date (Apr has 30 days max)
- "6/31" is NOT recognized as a date (Jun has 30 days max)
- "2/28" IS recognized as a valid date
- "1/31" IS recognized as a valid date
- "12/25" IS recognized as a valid date

### 2. Web XLSX parseAmount whitespace stripping (F21-02)

Add test in web-side test files (or server xlsx.test.ts parity test) to verify:
- "1,234 원" (space before Won) is parsed as 1234
- "₩ 1,234" (space after Won sign) is parsed as 1234

## Current Test Counts

- Bun: 495 pass, 0 fail
- Vitest: 236 pass, 0 fail
- Total: 731 tests passing