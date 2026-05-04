# Cycle 70 Aggregate Review

## Findings (3 actionable, all fixed)

### F1: Server adapter-factory missing-column error (SERVER/WEB PARITY - MEDIUM) -- FIXED
**File**: `packages/parser/src/csv/adapter-factory.ts`
Server-side createBankAdapter() silently returned empty results when required
columns (date, amount) were not found. Added "필수 컬럼을 찾을 수 없습니다" error
reporting matching web-side behavior.

### F2: ISO 8601 T-separator datetime not detected (FORMAT DIVERSITY - LOW-MEDIUM) -- FIXED
**Files**: `packages/parser/src/csv/generic.ts`, `apps/web/src/lib/parser/csv.ts`
CSV column detection's `isDateLike()` only matched datetime with space separator.
Added `[\sT]` to match both "2024-01-15 10:30:00" and "2024-01-15T10:30:00".

### F3: Memo column pattern gap (FORMAT DIVERSITY - LOW) -- FIXED
**File**: `packages/parser/src/csv/column-matcher.ts`
Added "비고내역" to MEMO_COLUMN_PATTERN for broader Korean bank header coverage.

## Deferred
- D1: PDF multi-line header support
- D2: D-01 architectural refactor (shared module between Bun/browser)
- D3: Historical amount display format
- D4: Card name suffixes
- D5: Global config integration