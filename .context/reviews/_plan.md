# Cycle 18 Implementation Plan

## Fixes (ordered by priority)

### 1. F18-01: Server-side XLSX `parseAmount()` whitespace/parenthesized negative fix
**File**: `packages/parser/src/xlsx/index.ts`
**Change**: Move `.replace(/\s/g, '')` before the parenthesized negative check, matching
the pattern used by CSV shared, PDF, and all web-side parsers.

### 2. F18-02: Web-side CSV `parseAmount()` whitespace stripping
**File**: `apps/web/src/lib/parser/csv.ts`
**Change**: Add `.replace(/\s/g, '')` to the amount cleaning pipeline, matching the
server-side CSV shared `parseCSVAmount()` (C70-04).

### 3. F18-03: Web-side CSV bank adapter flexible header matching
**File**: `apps/web/src/lib/parser/csv.ts`
**Change**: For adapters using strict `includes()` (BC, NH, Samsung, Shinhan, Lotte,
Hana), replace with flexible `findColumn()` + `normalizeHeader()` for header keyword
matching, similar to how the server-side factory uses `normalizedKeywords.some()`.
This ensures header detection works with parenthetical suffixes and other variations.

### 4. F18-04: Add XLSX parenthesized negative amount test
**File**: `packages/parser/__tests__/xlsx.test.ts`

### 5. F18-05: Add CSV shared spaced amount test
**File**: `packages/parser/__tests__/csv-shared.test.ts`

## Deferred (explicitly)
- D-01: Web CSV factory refactor (major)
- D-02: Duplicate BANK_COLUMN_CONFIGS (shared module needed)
- D-03: PDF multi-line header support (complex, low frequency)