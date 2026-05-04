# Test Engineer — Cycle 7

## Test Coverage Review

### T7-01: No UTF-16 Test Fixtures
No test coverage for UTF-16 encoded CSV files. Need fixtures with UTF-16 LE BOM.

### T7-02: No CP949 Test Fixtures
No test coverage for CP949 encoded CSV files. Need a CP949 fixture.

### T7-03: Won Sign Amount Column Inference Not Tested
The generic parser's column inference with ₩/￦ prefixed amounts has no test.

### T7-04: English Header Column Detection Not Tested
No tests for English column headers like "Date", "Amount", "Merchant".

### T7-05: Existing Coverage Good
218 vitest + 201 bun tests passing. Core functionality well covered.
