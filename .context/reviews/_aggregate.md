# Cycle 87 Aggregate Review

## Summary
After 86 cycles, the parser is very mature with 1261+ bun tests passing. This cycle identifies **3 actionable findings**: missing standalone keywords (`desc`, `amt`, `txn`) in column patterns that cause header-detection/column-matching desync, missing keywords in HEADER_KEYWORDS, and XLSX numeric YYYYMMDD dates being rejected as errors.

## Findings

| # | Severity | Area | Description | Status |
|---|----------|------|-------------|--------|
| F1 | MEDIUM | column-matcher | Missing `desc`/`amt`/`txn` standalone in column patterns | Planned |
| F2 | LOW | column-matcher | Missing `installment`/`install`/`remark` in HEADER_KEYWORDS | Planned |
| F3 | MEDIUM | xlsx (server+web) | Numeric YYYYMMDD dates (20240115) rejected as errors | Planned |
| T1 | MEDIUM | tests | Missing test coverage for `desc`/`amt`/`txn` column matching | Planned |
| T2 | MEDIUM | tests | Missing test for numeric YYYYMMDD dates in XLSX | Planned |

## Reviewer Results
- **code-reviewer**: 3 findings (F1-F3), column pattern gaps and XLSX numeric date issue

## Deferred Items (unchanged)
- D-01: Shared module between Bun/browser (significant refactor)
- PDF multi-line header support (needs fixture data)
- Historical amount display (low priority)
- Card name suffixes (low priority)
- Global config integration (feature work)
- Generic parser fallback (needs UX decisions)
- CSS dark mode (frontend work)