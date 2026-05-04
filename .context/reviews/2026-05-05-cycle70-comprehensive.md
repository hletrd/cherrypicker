# Cycle 70 Deep Code Review

## Test Status
- **Bun tests**: 1265/1265 passing
- **Vitest tests**: 285/285 passing

## Findings

### F1: Server CSV adapter-factory missing "required column" error (PARITY GAP)
**Severity**: Medium
**File**: `packages/parser/src/csv/adapter-factory.ts`
The server-side `createBankAdapter()` does NOT report when required columns (date, amount) are not found. The web-side `apps/web/src/lib/parser/csv.ts` pushes `필수 컬럼을 찾을 수 없습니다: 날짜, 금액` errors (F4). The generic CSV parsers on both sides also report this error. This parity gap means server-side users get silent empty results when column detection fails, while web-side users get a helpful error message.

### F2: ISO 8601 datetime with 'T' separator not detected
**Severity**: Low-Medium
**Files**: `packages/parser/src/csv/generic.ts`, `apps/web/src/lib/parser/csv.ts`
The `DATE_PATTERNS` used by `isDateLike()` for data-inference column detection only match datetime strings with space separator (`2024-01-15 10:30:00`). ISO 8601 datetime strings with 'T' separator (`2024-01-15T10:30:00`) are becoming increasingly common in modern bank API exports. While `parseDateStringToISO()` correctly parses these (its non-anchored regex matches the date prefix), the column detection `isDateLike()` function will fail to identify a column containing 'T'-separator datetimes as a date column, causing data inference to potentially misassign the column.

### F3: Column pattern gaps for edge-case headers
**Severity**: Low
**File**: `packages/parser/src/csv/column-matcher.ts`
Some uncommon but real Korean bank header terms are not covered:
- DATE: "작성시간" (already have "승인시간"), "조회기간"
- MEMO: "비고내역", "참고사항" (have "참고" but not the compound)

These are minor and already mostly handled by substring matching in the regex, but explicit coverage improves robustness.

### F4: Server/web parity -- comprehensive check
**Status**: Good parity overall. All major features match:
- 24 bank adapters on both sides
- Column matching with shared patterns
- Date parsing with shared date-utils
- Amount parsing with full-width, KRW, 마이너스, trailing-minus support
- Summary row pattern shared
- Header detection with multi-category validation
- PDF structured + fallback parsing on both sides
- XLSX multi-sheet, forward-fill, summary guard on both sides

The only parity gap found is F1 (missing column error in server adapter-factory).

### F5: Test coverage assessment
**Status**: 1265 bun + 285 vitest tests. Good coverage. New tests should be added for:
- Server adapter-factory missing-column error reporting (F1 fix)
- ISO 8601 T-separator datetime detection (F2 fix)