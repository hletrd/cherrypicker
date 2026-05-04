# Verifier Report — Cycle 10

## Consistency Checks

### 1. Column Matcher Duplication (web vs server)
**Status**: Known deferred item. Both copies currently in sync — same patterns, same HEADER_KEYWORDS, same isValidHeaderRow logic.

### 2. Bank Column Config Duplication
**Status**: Known deferred item. XLSX adapters index and web xlsx.ts have identical BANK_COLUMN_CONFIGS. Currently in sync.

### 3. PDF Amount Pattern — Won Sign Gap
**Finding**: Server-side PDF `AMOUNT_PATTERN` (`table-parser.ts:7`) is `/(?<![a-zA-Z\d-])[\d,]+원?(?![a-zA-Z\d-])/` and `index.ts:19` is `/^-?[\d,]+원?$/`. Neither handles ₩/￦ Won signs. CSV/XLSX parsers all strip Won signs during parsing but PDF regex never matches them.

### 4. Web vs server CSV generic parser: Korean character regex
Server uses `/[가-힣a-zA-Z]/.test(c)`, web uses `/[가-힯a-zA-Z]/.test(c)`. Both correct but inconsistent representation.

## Summary
One actionable finding: PDF amount patterns do not handle Won signs.
