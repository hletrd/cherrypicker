# Cycle 12 Implementation Plan

## Fix 1: Server CSV adapter-factory date error reporting (HIGH)
- **Files**: `packages/parser/src/csv/adapter-factory.ts`
- **Change**: After `parseDateStringToISO(dateRaw)`, add `isValidISODate()` check and push error to errors array when date is unparseable. Pass errors array and line index to match generic parser behavior.
- **Tests**: Add test in `packages/parser/__tests__/csv-adapters.test.ts` for unparseable date error reporting

## Fix 2: Web XLSX parser use shared findColumn (MEDIUM)
- **Files**: `apps/web/src/lib/parser/xlsx.ts`
- **Change**: Import `findColumn` from `./column-matcher.js` and replace the local `findCol()` closure with calls to `findColumn()`. The local `findCol` function (lines 423-430) should be removed.
- **Tests**: Existing XLSX parity tests should continue to pass

## Fix 3: Column-matcher dedicated tests (MEDIUM)
- **Files**: New `packages/parser/__tests__/column-matcher.test.ts`
- **Change**: Add comprehensive tests for:
  - `normalizeHeader()`: zero-width spaces, soft hyphens, parenthetical suffixes, internal whitespace
  - `findColumn()`: exact match, regex fallback, no match (-1), precedence
  - `isValidHeaderRow()`: 2+ category requirement, single-category rejection, English case-insensitive
  - All `*_COLUMN_PATTERN` constants against expected column names

## Fix 4: CSV isDateLike whitespace tolerance (LOW)
- **Files**: `packages/parser/src/csv/generic.ts`, `apps/web/src/lib/parser/csv.ts`
- **Change**: Update DATE_PATTERNS to allow optional whitespace around delimiters: `[.\-\/\s]` instead of `[.\-\/]`
- **Tests**: Add test for spaced date formats in generic CSV parsing

## Fix 5: Server CSV adapter-factory isValidISODate validation (HIGH)
- **Files**: `packages/parser/src/csv/adapter-factory.ts`
- **Change**: Import `isValidISODate` from date-utils and validate parsed dates, reporting errors for unparseable ones. Combined with Fix 1.

## Deferred Items (explicitly not this cycle)
- Server/web full parser deduplication (D-01)
- PDF multi-line header support
- Web-side BANK_COLUMN_CONFIGS deduplication
- Historical amount display format
- Card name suffixes
- Global config integration
- CSS dark mode migration