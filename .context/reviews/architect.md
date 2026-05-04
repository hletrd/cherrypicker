# Cycle 77 Architect Review

## A77-01: DATE_KEYWORDS / DATE_COLUMN_PATTERN / HEADER_KEYWORDS Inconsistency [TO FIX]

The three structures that define "recognized date column headers" are out of sync. `DATE_COLUMN_PATTERN` (regex) and `HEADER_KEYWORDS` (array) include 5 terms (`취소일`, `정산일`, `환불일`, `반품일`, `교환일`) that are NOT in `DATE_KEYWORDS` (Set). This breaks the 2-category requirement in `isValidHeaderRow` for edge-case header rows.

## Deferred Items (unchanged)

- PDF multi-line headers: architecturally complex, marginal benefit
- Historical amount display format: not a parser concern
- Card name suffixes: not a parser concern
- Global config integration: not blocking
- CSS dark mode: not a parser concern
- D-01 shared module refactor: requires build system changes

## Architecture is mature and stable after 77 cycles.