# Cycle 100 — Test Engineer Review

## Test Coverage Gaps

### 1. No tests for web-side parsers
The web-side parsers (`apps/web/src/lib/parser/`) have NO dedicated test files. All tests exist only for the server-side parsers (`packages/parser/__tests__/`). This means the parity bugs found in this cycle (web HTML missing forward-fill, web JSON rejecting negatives, web OFX missing CCSTMTRS) have zero test coverage.

### 2. HTML parser test coverage
The server-side HTML parser test (`packages/parser/__tests__/html.test.ts`) covers:
- Basic table parsing
- Summary row skipping
- Korean date formats
- Malformed closing tags

**Missing tests**:
- Forward-fill with merged cells (the fix from cycle 99)
- Multiple tables in one HTML file (select best)
- Empty table cells mixed with data
- HTML entities in merchant names

### 3. OFX parser test coverage
**Missing tests**:
- Credit card statement OFX (CCSTMTRS path)
- Mixed bank + credit card transactions in one file
- OFX 1.x vs 2.x format handling

### 4. JSON parser test coverage
**Missing tests**:
- Negative amount handling (should store abs value)
- Nested wrapper objects (e.g., `{ response: { data: [...] } }`)
- JSON with BOM prefix

### 5. Cross-format consistency test
There is no test that verifies the same transaction data produces identical ParseResult across different formats (CSV, XLSX, JSON, HTML, OFX). This would catch the asymmetry bugs found this cycle.