# Cycle 19 Aggregate Review

## Summary
5 findings identified. After 18 cycles of fixes, the parser is quite robust.
Remaining issues are: PDF category/memo extraction, code consistency improvements,
test coverage gaps, and minor parity fixes.

## Prioritized Findings

### Should Fix (P2)
| ID | Finding | Files |
|----|---------|-------|
| F19-01 | PDF parsers missing category/memo column extraction from headers | packages/parser/src/pdf/table-parser.ts, apps/web/src/lib/parser/pdf.ts |
| F19-02 | Summary row pattern duplicated 7 times -- extract to shared constant | 7 files across server + web |
| F19-03 | CSV generic parsers use manual regex loop instead of findColumn() | packages/parser/src/csv/generic.ts, apps/web/src/lib/parser/csv.ts |
| F19-04 | Server PDF tryStructuredParse stricter error handling than web | packages/parser/src/pdf/index.ts |

### Test Coverage (P3)
| ID | Finding | Files |
|----|---------|-------|
| F19-05 | No test for XLSX parenthesized negatives, spaced amounts, formula errors | packages/parser/__tests__/xlsx.test.ts |

### Deferred
| ID | Finding | Reason |
|----|---------|--------|
| D-01 | Web-side CSV/XLSX factory refactor | Major refactor; requires shared module between Bun and browser |
| D-02 | Duplicate BANK_COLUMN_CONFIGS | Requires shared module between Bun and browser builds |
| D-03 | PDF multi-line header support | Complex PDF layout parsing, low frequency |
| D-04 | XLSX forward-fill code duplication | Requires shared module between Bun and browser builds |