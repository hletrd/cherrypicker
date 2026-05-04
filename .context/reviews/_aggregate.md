# Aggregate Review -- Cycle 50

## New Findings: 3 actionable, 3 test gaps

### Actionable (implement this cycle)

**F1. PDF filterTransactionRows accepts any 6-digit string as date [MEDIUM]**
- `packages/parser/src/pdf/table-parser.ts:5,156-162`
- `apps/web/src/lib/parser/pdf.ts:33,174-180`
- DATE_PATTERN includes `(?<!\d)\d{6}(?!\d)` matching any 6-digit string
- CSV parser validates via isYYMMDDLike() but PDF parser has no such validation
- Fix: add post-filter YYMMDD validation in tryStructuredParse

**F2. PDF getHeaderColumns doesn't split combined headers [MEDIUM]**
- `packages/parser/src/pdf/table-parser.ts:204-229`
- `apps/web/src/lib/parser/pdf.ts:214-235`
- Combined headers like "비고/적요" tested as whole strings
- findColumn() already splits on "/" and "|"
- Fix: refactor getHeaderColumns() to use findColumn()

**F3. Summary row pattern missing standalone "합 계" variant [LOW]**
- `packages/parser/src/csv/column-matcher.ts:83`
- Has `총\s*합\s*계` but no standalone `합\s*계`
- Fix: add standalone pattern

### Test Gaps

**T1. PDF YYMMDD date validation tests [MEDIUM]**
- No test for 6-digit transaction ID rejection vs valid YYMMDD acceptance

**T2. PDF combined header splitting tests [MEDIUM]**
- No test for "/" or "|" delimited headers in PDF column detection

**T3. Summary row "합 계" spacing variant test [LOW]**
- No test for spaced "합 계" in summary row detection

### Confirmed Fixed (from cycle 49)

- Cycle 49 F1-F4: All confirmed present in current code

### Deferred (unchanged)

| Item | Reason |
|------|--------|
| D-01 | Server/web shared module -- architectural refactor |
| D-02 | PDF multi-line headers -- edge case |
| D-03 | Web CSV hand-rolled adapters -> factory pattern |