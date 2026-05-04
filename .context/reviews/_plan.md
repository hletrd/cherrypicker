# Cycle 70 Plan

## Fix 1: Server adapter-factory missing-column error (F1)
**File**: `packages/parser/src/csv/adapter-factory.ts`
After column detection via `findColumn()`, add "필수 컬럼을 찾을 수 없습니다" error
reporting matching the web-side `apps/web/src/lib/parser/csv.ts` createBankAdapter().

## Fix 2: ISO 8601 T-separator datetime detection (F2)
**Files**: `packages/parser/src/csv/generic.ts`, `apps/web/src/lib/parser/csv.ts`
Change datetime pattern from `\s+` to `[\sT]` to match both space and T separators:
`/^\d{4}[\s]*[.\-\/．。]...[\s]*\d{1,2}[\sT]\d/`

## Fix 3: Memo column pattern coverage (F3)
**File**: `packages/parser/src/csv/column-matcher.ts`
Add "비고내역" to MEMO_COLUMN_PATTERN and HEADER_KEYWORDS.

## Fix 4: Tests
Add tests for the new fixes.

## Deferred items (STRICT)
- PDF multi-line header support -- complex, low impact
- Historical amount display format -- feature request
- Card name suffixes -- feature request
- Global config integration -- architecture