# Cycle 8 — Aggregate Review (Parser Format Diversity Focus)

## Summary
4 HIGH-severity bugs found in web-side parsers: Won sign (₩/￦) not stripped in all 3 parsers (XLSX, CSV, PDF), and web XLSX missing merged cell forward-fill. 1 LOW unused import. Server-side parser is solid.

## Findings by Severity

### HIGH (4)
| ID | Finding | File | Fix |
|----|---------|------|-----|
| C8-01 | Won sign not stripped in web XLSX parseAmount | apps/web/src/lib/parser/xlsx.ts:245 | Add .replace(/[₩￦]/g, '') |
| C8-02 | Won sign not stripped in web CSV parseAmount | apps/web/src/lib/parser/csv.ts:67 | Add .replace(/[₩￦]/g, '') |
| C8-03 | Won sign not stripped in web PDF parseAmount | apps/web/src/lib/parser/pdf.ts:188 | Add .replace(/[₩￦]/g, '') |
| C8-04 | Web XLSX missing merged cell forward-fill | apps/web/src/lib/parser/xlsx.ts:422-468 | Port forward-fill from server |

### LOW (1)
| ID | Finding | File | Fix |
|----|---------|------|-----|
| C8-05 | Unused HEADER_KEYWORDS import | apps/web/src/lib/parser/xlsx.ts:12 | Remove import |

## Deferred Items (unchanged from cycle 7)
- Server-side ColumnMatcher module path consistency
- Web-side CSV parser vs server-side duplication
- PDF multi-line header support
- Historical amount display format
- Card name suffixes
- Global config integration
- Generic parser fallback behavior
- CSS dark mode complete migration