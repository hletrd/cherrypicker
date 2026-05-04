# Cycle 14 Implementation Plan

## Priority 1: XLSX formula error cell detection (server + web)
**Files**: `packages/parser/src/xlsx/index.ts`, `apps/web/src/lib/parser/xlsx.ts`
- Add Excel error string detection (`#VALUE!`, `#REF!`, `#DIV/0!`, `#N/A`, `#NAME?`, `#NULL!`, `#NUM!`, `#CALC!`) in `parseDateToISO` and `parseAmount`
- In `parseDateToISO`: detect error strings early, produce specific "셀 수식 오류: #VALUE!" message
- In `parseAmount`: already returns null for non-numeric strings (correct), no change needed
- Add bun test for formula error cell handling

## Priority 2: `extractPages` space insertion parity
**File**: `packages/parser/src/pdf/extractor.ts`
- Add the same `lastEndX` tracking and space insertion logic from `extractPagesFromBuffer` to `extractPages`
- Add test for `extractPages` producing correct spacing

## Priority 3: Web PDF text extraction Y-coordinate line breaks
**File**: `apps/web/src/lib/parser/pdf.ts`
- Replace simple `.join(' ')` with Y-coordinate-based line break detection
- Track last Y position and insert `\n` when Y changes significantly (matching server-side threshold of 5 units)
- This enables the web PDF structured table parser to work instead of relying solely on fallback

## Priority 4: Server CSV generic parser English error messages
**File**: `packages/parser/src/csv/generic.ts`
- Change `'Empty file'` to `'빈 파일입니다.'`
- Change `Cannot parse amount: ${amountRaw}` to `금액을 해석할 수 없습니다: ${amountRaw}`

## Priority 5: Tests
**File**: `packages/parser/__tests__/xlsx.test.ts`
- Add test for XLSX formula error cells (#VALUE!, #REF!)
- Add test for `extractPages` space insertion

## Deferred Items
- Server/web column-matcher duplication (different build systems)
- Web CSV parser duplication (acknowledged in NOTE)
- PDF multi-line header support (complex, low real-world impact)
- Historical amount display format
- Card name suffixes
- Global config integration
- CSS dark mode
