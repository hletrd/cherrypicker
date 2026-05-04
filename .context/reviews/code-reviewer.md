# Code Review — Cycle 11

## Focus: Format diversity, regressions, consistency after 10 cycles

### Finding 1 (HIGH): PDF DATE_PATTERN missing short dates (MM.DD)
**Files**: `packages/parser/src/pdf/table-parser.ts:3`, `apps/web/src/lib/parser/pdf.ts:21`

The `DATE_PATTERN` regex used by `parseTable()` and `filterTransactionRows()` does NOT include `MM.DD` short dates:
```
const DATE_PATTERN = /(?:\d{4}[.\-\/]\d{1,2}[.\-\/]\d{1,2}|\d{2}[.\-\/]\d{2}[.\-\/]\d{2}|\d{4}년\s*\d{1,2}월\s*\d{1,2}일|\d{1,2}월\s*\d{1,2}일)/;
```

But `findDateCell()` in both PDF parsers DOES check `isValidShortDate(cell)` as a fallback. This means:
- Table boundary detection (`parseTable`) won't start collecting lines for PDFs with only short dates
- `filterTransactionRows` won't match rows with short dates
- The structured parse fails silently and falls through to the less reliable line scanner

**Impact**: Korean bank PDFs that use "1.15" or "01/15" format skip structured parsing entirely.

**Fix**: Add short date alternative to `DATE_PATTERN`. Use a bounded pattern that avoids matching decimal numbers like "3.14" by requiring month 1-12 via lookahead, or use the simpler approach of adding the SHORT_MD_DATE_PATTERN with proper negative lookahead to avoid matching decimal numbers with >2 digits after the dot.

### Finding 2 (MEDIUM): Web XLSX missing serial date error reporting
**File**: `apps/web/src/lib/parser/xlsx.ts:218`

Server XLSX parser reports errors for out-of-range serial dates:
```ts
if (errors && lineIdx !== undefined && raw !== 0) {
  errors.push({ line: lineIdx + 1, message: `날짜를 해석할 수 없습니다: ${raw}` });
}
```

Web XLSX parser silently returns `String(raw)` without error. Parity fix.

### Finding 3 (MEDIUM): normalizeHeader doesn't strip zero-width spaces
**Files**: `packages/parser/src/csv/column-matcher.ts:10`, `apps/web/src/lib/parser/column-matcher.ts:13`

`normalizeHeader` uses `h.trim().replace(/\s+/g, '')` but JavaScript `\s` does NOT match zero-width space (U+200B), zero-width non-joiner (U+200C), or zero-width joiner (U+200D). Korean bank exports occasionally include these Unicode format characters in cell values, causing header matching to fail.

**Fix**: Add explicit removal of common invisible Unicode characters in `normalizeHeader`.

### Finding 4 (LOW): Web CSV splitLine doesn't handle quoted fields for non-comma delimiters
**File**: `apps/web/src/lib/parser/csv.ts:21`

Same issue in server `packages/parser/src/csv/shared.ts:10`. Tab-separated files with quoted fields won't parse correctly. Very rare for Korean credit card exports.

## Regression Check
No regressions detected from cycle 10 refactoring.

## Summary
1 HIGH, 2 MEDIUM, 1 LOW. Most impactful fix: PDF short date support.