# Code Reviewer — Cycle 3

## F-CR-01: Web-side CSV adapters use exact indexOf() for column matching
**Severity: High | Confidence: High**
**Files**: `apps/web/src/lib/parser/csv.ts` lines 330-334, 395-399, 461-465, 527-531, 591-595, 656-660, 723-727, 788-792, 854-858, 918-923

All 10 bank-specific web CSV adapters use `headers.indexOf('exact string')`. The server-side adapters were replaced with ColumnMatcher in cycle 1. The user-facing web app has the weakest parsing — column names with trailing spaces, parenthetical suffixes like "이용금액(원)", or synonym variations will fail silently.

**Fix**: Replace all 10 adapters' indexOf calls with the ColumnMatcher findColumn() function already available at `apps/web/src/lib/parser/column-matcher.ts`.

## F-CR-02: Web-side bank adapter header detection inconsistent and lacks category requirement
**Severity: High | Confidence: High**
**File**: `apps/web/src/lib/parser/csv.ts` lines 316-324, 383-389, 448-455, etc.

Each web adapter has its own header detection: some require TWO specific headers (samsung: '이용일'+'가맹점명'), others use keyword arrays (kb: `cells.some(c => KB_HEADERS.includes(c))`). No category-based validation (unlike server-side which was fixed in cycle 2).

**Fix**: Standardize all adapters to use keyword + category-based detection.

## F-CR-03: Server-side XLSX returns first sheet, not best sheet
**Severity: Medium | Confidence: High**
**File**: `packages/parser/src/xlsx/index.ts` lines 117-124

Server returns first sheet with transactions. Web-side (xlsx.ts line 331) selects sheet with most transactions. For multi-sheet workbooks, server may miss data.

## F-CR-04: Unused isValidCSVAmount export
**Severity: Low | Confidence: High**
**File**: `packages/parser/src/csv/shared.ts`

## F-CR-05: Web-side csv.ts 1030 lines of duplicated adapter code
**Severity: Medium | Confidence: High**
**File**: `apps/web/src/lib/parser/csv.ts`

10 bank adapters duplicate ~60 lines each. Server-side has createBankAdapter() factory reducing each bank to ~8 lines.

## F-CR-06: HEADER_KEYWORDS duplicated 4 times
**Severity: Medium | Confidence: High**
**Files**: generic.ts:47-51, xlsx/index.ts:133-137, web/csv.ts:158-162, web/xlsx.ts:369-373

## F-CR-07: BANK_COLUMN_CONFIGS duplicated 3 times
**Severity: Medium | Confidence: High**
**Files**: xlsx/adapters/index.ts, web/xlsx.ts, adapter-factory.ts

## F-CR-08: splitCSVLine only handles RFC 4180 for comma delimiter
**Severity: Low | Confidence: Medium**
**File**: packages/parser/src/csv/shared.ts

## F-CR-09: Server-side date parsing has no error reporting unlike web-side
**Severity: Medium | Confidence: High**
**Files**: adapter-factory.ts:133, generic.ts:175 vs web/csv.ts:49

## F-CR-10: Date format YYYYMMDD ambiguity with large amounts
**Severity: Low | Confidence: Medium**
**File**: packages/parser/src/date-utils.ts:65
