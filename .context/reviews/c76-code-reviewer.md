# Cycle 76 Code Reviewer Report

## Findings

### 1. Missing Date Column Header Terms (Medium - Format Diversity)
**Files**: `packages/parser/src/csv/column-matcher.ts`, `apps/web/src/lib/parser/column-matcher.ts`
**Issue**: `DATE_COLUMN_PATTERN` and `HEADER_KEYWORDS` / `DATE_KEYWORDS` are missing several date column names used by Korean bank exports:
- "취소일" — cancel date (some banks have a separate cancellation date column)
- "정산일" — settlement date (corporate card exports)
- "환불일" — refund date (refund tracking)
- "반품일" — return date (retail-focused banks)
- "교환일" — exchange date (exchange transactions)

These terms are legitimate date column headers that would cause findColumn() to return -1, forcing fallback to data inference which is less reliable.

### 2. Missing Summary Row Patterns (Low)
**File**: `packages/parser/src/csv/column-matcher.ts`
**Issue**: SUMMARY_ROW_PATTERN doesn't cover "할부수수료" (installment fee) or "연체료" (late fee) summary lines that some bank exports include as footer rows. These would be parsed as regular transactions with potentially invalid dates.

### 3. No Regressions Detected
All existing parser behaviors appear correct. Server/web parity is maintained across all parser types (CSV, XLSX, PDF). The 1076 test suite provides solid coverage of the existing feature set.