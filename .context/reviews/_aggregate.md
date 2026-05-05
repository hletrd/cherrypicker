# Cycle 2 Aggregate Review

## Summary
Cycle 2 of new batch. Found 14 new issues — 5 critical/high severity, 9 medium/low. Focus on server/web parity bugs and a critical runtime bug in FileDropzone.svelte.

## New Findings (14)

| ID | Severity | Type | Description |
|----|----------|------|-------------|
| F-CR-01 | CRITICAL | BUG | FileDropzone.svelte `errorMessage` vs `errorMessages` ReferenceError |
| F-CR-02 | CRITICAL | BUG | FileDropzone ACCEPTED_EXTENSIONS blocks JSON/OFX/HTML formats |
| F-CR-03 | HIGH | RELIABILITY | Web CSV parser drops refunds (amount <= 0 filter) |
| F-CR-04 | HIGH | RELIABILITY | Web HTML parser drops refunds |
| F-CR-05 | HIGH | RELIABILITY | Web XLSX parser drops refunds |
| F-CR-06 | HIGH | RELIABILITY | Web PDF parser drops refunds |
| F-DBG-02 | MEDIUM | RELIABILITY | fetcher.ts second fetch() loses abort timeout |
| F-TEST-01 | CRITICAL | TESTS | No tests catch FileDropzone ReferenceError |
| F-TEST-02 | HIGH | TESTS | No tests for refund handling across parsers |
| F-ARCH-01 | HIGH | ARCHITECTURE | Server/web parser parity gap on negative amounts |
| F-ARCH-02 | HIGH | ARCHITECTURE | UI file types don't match parser capabilities |
| F-SEC-01 | MEDIUM | SECURITY | fetcher.ts abort timeout lost on EUC-KR detection |
| F-SEC-07 | LOW | SECURITY | LLM fallback truncates PDF text to 8000 chars |
| F-CR-07 | MEDIUM | CODE_QUALITY | JSON parser handles negatives correctly but siblings don't |

## Detailed Critical/High Findings

### F-CR-01: FileDropzone.svelte runtime ReferenceError [CRITICAL]
- **File**: `apps/web/src/components/upload/FileDropzone.svelte` lines 251, 314, 363
- **Impact**: Complete component crash on any error path
- **Root cause**: Variable declared as `errorMessages` but referenced as `errorMessage`
- **Fix**: Rename all references to match declaration

### F-CR-02: FileDropzone blocks supported formats [CRITICAL]
- **File**: `apps/web/src/components/upload/FileDropzone.svelte` lines 97-103
- **Impact**: Users cannot upload OFX/QFX, HTML, or JSON files
- **Root cause**: Hardcoded ACCEPTED_EXTENSIONS only allows csv/xlsx/pdf
- **Fix**: Extend to include json/ofx/qfx/html/htm and corresponding MIME types

### F-CR-03 through F-CR-06: Web parsers drop refunds [HIGH]
- **Files**: `apps/web/src/lib/parser/csv.ts:175`, `html.ts:212`, `xlsx.ts:617`, `pdf.ts:440`
- **Impact**: Refund transactions silently discarded, incorrect totals
- **Root cause**: `amount <= 0` filter instead of `amount === 0` + `Math.abs()`
- **Fix**: Change all four to match JSON parser behavior

### F-ARCH-01: Server/web parity on negative amounts [HIGH]
- **Files**: All web parsers except JSON
- **Impact**: Same statement produces different results on web vs CLI
- **Fix**: Extract shared `validateAmount()` utility

### F-ARCH-02: UI/parser capability mismatch [HIGH]
- **Files**: FileDropzone.svelte vs parser/index.ts
- **Impact**: Parser supports formats that UI rejects
- **Fix**: Derive accepted types from parser capability map
