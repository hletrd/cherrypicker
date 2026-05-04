# Cycle 55 Aggregate Review

## Findings (2 actionable, 2 deferred)

### F1: SUMMARY_ROW_PATTERN missing boundary guards on compound patterns (FIXED)
**File**: `packages/parser/src/csv/column-matcher.ts` + `apps/web/src/lib/parser/column-matcher.ts`
**Impact**: Potential false-positive summary row skipping on merchant names
**Fix**: Added `(?<![가-힣])` and `(?![가-힣])` boundary guards to: 승인 합계, 결제 합계, 합 계 금액, 총 사용/이용, 사용 합계, 이용 합계, 총 결제 금액, 총 이용 금액

### F2: CSV/PDF parsers omit `raw` field in amount error messages (FIXED)
**Files**: `packages/parser/src/csv/adapter-factory.ts`, `packages/parser/src/csv/generic.ts`
**Impact**: Harder to debug amount parse failures in CSV
**Fix**: Added `raw` field enrichment to amount errors, matching XLSX parser error format

### F3: Web-side hand-written adapters use hardcoded detect() (DEFERRED)
**File**: `apps/web/src/lib/parser/csv.ts`
**Impact**: No functional bug today; architectural debt
**Status**: Deferred — patterns match central detect.ts currently

### F4: PDF multi-line header support (DEFERRED)
**Impact**: PDFs with headers split across 2+ rows won't be detected
**Status**: Deferred — complex, requires structural PDF parser changes

## Tests Added
- 18 new boundary guard tests in column-matcher.test.ts
- 2 new `raw` field tests in csv.test.ts
- Total: 847 bun tests + 127 vitest tests passing