# Cycle 30 Deep Code Review — Test Engineering

## Reviewer: test-engineer
## Focus: Test coverage gaps for format diversity

---

### Finding T1: No test for SUMMARY_ROW_PATTERN false-positive on merchant names (HIGH)

All 6 parsers (server CSV/XLSX/PDF, web CSV/XLSX/PDF) use `SUMMARY_ROW_PATTERN.test()` against full-line or joined-row text. No test verifies that a merchant name like "합계마트" or "소비마트" is preserved as a valid transaction rather than incorrectly filtered.

**Required test cases:**
- CSV line: `2024-01-15,합계마트,5000` — merchant should be "합계마트", not skipped
- CSV line: `2024-01-15,소비마트,5000` — merchant should be "소비마트", not skipped
- XLSX row: `['2024-01-15', '합계마트', 5000]` — same
- Summary line: `합계,,,,123456` — should still be skipped (keyword at line start, followed by delimiters)

---

### Finding T2: No test for CSV summary row with CSV delimiters (MEDIUM)

The SUMMARY_ROW_PATTERN is tested against raw CSV lines that include delimiters (commas). Existing tests use simple string checks but don't test the actual CSV parser behavior with lines like `합계,,,,123456` where the keyword is followed by delimiter characters.

---

### Finding T3: Server-side `date-utils.ts` has fewer tests than web-side (LOW)

The server-side `date-utils.test.ts` and the web-side `date-utils.test.ts` both test `parseDateStringToISO`, but specific edge cases like trailing garbage text and empty strings may have different coverage levels. Not actionable this cycle.

---

### Current Test Counts
- Bun: 551 pass across 9 files
- Vitest: 243 pass across 9 files
- Total: 794 tests passing