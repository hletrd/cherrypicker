# Cycle 58 Aggregate Review

## Findings (3 actionable, 2 deferred)

### F1: Fullwidth minus `－` not handled in PDF amount patterns (BUG - Medium)
**Severity**: Medium — real format from Korean bank exports
**Scope**: 5 files (server PDF index.ts, table-parser.ts; web PDF pdf.ts)
**Impact**: PDFs with `－50,000원` amounts misidentified as positive (should be negative, skipped)
**Fix**: Add `－` (U+FF0D) as optional negative prefix in all PDF amount patterns

### F2: YYMMDD missing from PDF fallback date patterns (GAP - Medium)
**Severity**: Medium — format diversity gap
**Scope**: 2 files (server PDF index.ts, web PDF pdf.ts)
**Impact**: PDFs with YYMMDD dates fail in fallback line scanner path
**Fix**: Add YYMMDD pattern with validation to fallback date patterns

### F3: `－` prefix lost in PDF fallback amount extraction (BUG - Low)
**Severity**: Low — consequence of F1 in fallback path
**Scope**: 2 files (server PDF index.ts, web PDF pdf.ts)
**Impact**: Fallback scanner extracts digits after `－` as positive amount
**Fix**: Add `－` capture group to fallbackAmountPattern

### Deferred:
- F4: Fullwidth letter normalization in headers (extremely rare)
- F5: PDF multi-line header support (complex, low frequency)
- F6: Server/web CSV parser duplication (architectural, D-01)

## Tests Passing
- 872 bun tests
- 271 vitest tests