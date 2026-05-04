# Cycle 76 Aggregate Review

## Review Summary

After 75 cycles of intensive parser improvements, the codebase is extremely mature. This cycle focused on identifying remaining format diversity gaps in column header patterns and summary row detection.

## Findings

### 1. Missing Date Column Header Terms [TO FIX]
- **Severity**: Medium (format diversity)
- **Location**: `packages/parser/src/csv/column-matcher.ts`, `apps/web/src/lib/parser/column-matcher.ts`
- **Issue**: DATE_COLUMN_PATTERN missing "취소일", "정산일", "환불일", "반품일", "교환일". These are valid date column headers used by some Korean bank exports.
- **Fix**: Add missing terms to DATE_COLUMN_PATTERN, HEADER_KEYWORDS, and DATE_KEYWORDS in both server and web column-matcher files.

### 2. Missing Summary Row Patterns [TO FIX]
- **Severity**: Low
- **Location**: `packages/parser/src/csv/column-matcher.ts` SUMMARY_ROW_PATTERN
- **Issue**: Pattern doesn't match "할부수수료" (installment fee) or "연체료" (late fee) summary lines.
- **Fix**: Add summary row patterns with Korean boundary constraints.

### 3. Web-side Architecture Duplication [DEFERRED]
- **Severity**: Low (architecture debt)
- **Issue**: Web CSV parser duplicates parseAmount, parseInstallments, splitLine, splitCSVContent from server-side shared module. D-01 shared module refactor remains deferred.

## Server/Web Parity Status
All parser parity items remain resolved from cycle 75. Both server and web use identical column patterns (after this cycle's updates), date utilities, amount parsing, and summary row detection.

## Deferred Items (unchanged from cycle 75)
- PDF multi-line header support
- Historical amount display format
- Card name suffixes
- Global config integration
- Generic parser fallback behavior
- CSS dark mode complete migration
- D-01 shared module refactor (web CSV duplication)