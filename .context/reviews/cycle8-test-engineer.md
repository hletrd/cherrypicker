# Cycle 8 — Test Engineering Review (Parser-focused)

## Coverage Gaps

### C8T-01: No tests for Won sign in web-side parsers [HIGH]
Web-side XLSX/CSV/PDF parsers lack tests for ₩/￦ prefixed amounts.
Server-side has tests but web-side has no test runner configured.

### C8T-02: No tests for merged cell forward-fill in web XLSX [MEDIUM]
Server-side has tests; web-side has no equivalent.

## Recommendation
Add server-side test cases to validate the fixes are consistent with server behavior (which already has tests).