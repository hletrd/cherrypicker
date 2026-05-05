# Cycle 86 Aggregate Review

## Summary
After 85 cycles, the parser is very mature with 1244+ bun + 299+ vitest tests passing.
This cycle identifies **5 actionable findings**: missing English keywords in HEADER_KEYWORDS and a missing `할인` summary row pattern, both affecting format diversity for English-only header rows.

## Findings

| # | Severity | Area | Description | Status |
|---|----------|------|-------------|--------|
| F1 | MEDIUM | column-matcher | Missing 13 English date keywords in HEADER_KEYWORDS | Planned |
| F2 | LOW | column-matcher | Missing `name` merchant keyword in HEADER_KEYWORDS | Planned |
| F3 | LOW | column-matcher | Missing `debit`/`credit`/`net`/`netamount`/`gross` in HEADER_KEYWORDS | Planned |
| F4 | LOW | column-matcher | Missing standalone `할인` in SUMMARY_ROW_PATTERN | Planned |
| T1 | MEDIUM | column-matcher.test | Missing English-only header detection test coverage | Planned |

## Reviewer Results
- **code-reviewer**: 4 findings (F1-F4), keyword gaps in HEADER_KEYWORDS
- **test-engineer**: 1 finding (T1), missing English-only header test coverage
- **verifier**: All findings low-risk, safe to implement

## Deferred Items (unchanged)
- D-01: Shared module between Bun/browser (significant refactor)
- PDF multi-line header support (needs fixture data)
- Historical amount display (low priority)
- Card name suffixes (low priority)
- Global config integration (feature work)
- Generic parser fallback (needs UX decisions)
- CSS dark mode (frontend work)