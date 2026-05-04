# Aggregate Review -- Cycle 49

## New Findings: 4 actionable, 2 test gaps

### Actionable (implement this cycle)

**F1. Web CSV parseAmount parenthesized negative + Won sign order-of-operations bug [MEDIUM]**
- `apps/web/src/lib/parser/csv.ts:67-84`
- Strips 원/₩ AFTER checking parens, so `(1,234원)` fails to detect as negative
- Server-side strips first (correct). Fix: reorder to match server-side.

**F2. CSV AMOUNT_PATTERNS missing bare 5+ digit integers [LOW]**
- `packages/parser/src/csv/generic.ts:73-80`, `apps/web/src/lib/parser/csv.ts:183-190`
- Column-detection heuristics don't recognize `50000` as amount-like (requires comma or Won sign)
- Fix: add `/^\d{5,}원?$/` pattern.

**F3. findColumn doesn't split combined headers on "|" [LOW]**
- `packages/parser/src/csv/column-matcher.ts:48-53`
- Splits on "/" but not "|". Some Korean bank exports use "|" in combined headers.
- Fix: add "|" splitting alongside "/".

**F4. PDF DATE_PATTERN missing YYMMDD format [LOW]**
- `packages/parser/src/pdf/table-parser.ts:5`, `apps/web/src/lib/parser/pdf.ts:33`
- 6-digit compact dates (240115) not detected in PDF table row detection.
- Fix: add bounded YYMMDD pattern.

### Test Gaps

**F5. CSV DATE_PATTERNS missing explicit YYMMDD entry [LOW]**
- `packages/parser/src/csv/generic.ts:24-34`, `apps/web/src/lib/parser/csv.ts:133-143`
- Add with isYYMMDDLike validator guard.

**F6. Missing edge-case tests for amount/date/delimiter formats [LOW]**
- Parenthesized amounts with Won suffix, full-width Won sign, 마이너스 prefix, pipe delimiters, YYMMDD detection, bare 5+ digit amounts, "|" combined headers in findColumn.

### Deferred (unchanged)

| Item | Reason |
|------|--------|
| D-01 | Server/web shared module -- architectural refactor |
| D-02 | PDF multi-line headers -- edge case |
| D-03 | Web CSV hand-rolled adapters -> factory pattern |
| D-04 | normalizeHeader unicode character class readability |