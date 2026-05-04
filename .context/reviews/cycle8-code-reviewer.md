# Cycle 8 — Code Review: Parser Format Diversity (Parser-focused)

## Scope
Deep review of packages/parser/ and apps/web/src/lib/parser/ focusing on format diversity after 7 cycles.

## Critical Findings

### C8-01: Won sign (₩/￦) not stripped in web-side XLSX parseAmount [BUG]
**File:** `apps/web/src/lib/parser/xlsx.ts` line 245
**Severity:** HIGH
The web XLSX `parseAmount()` strips `원` and commas but NOT ₩/￦. Server-side does strip them.
`₩1,234` → `₩1234` → NaN → null → row silently skipped.

### C8-02: Won sign not stripped in web-side CSV parseAmount [BUG]
**File:** `apps/web/src/lib/parser/csv.ts` line 67
**Severity:** HIGH
Same issue. Server `shared.ts` strips ₩/￦; web csv.ts does not.

### C8-03: Won sign not stripped in web-side PDF parseAmount [BUG]
**File:** `apps/web/src/lib/parser/pdf.ts` line 188
**Severity:** HIGH
Same issue for PDF. Server pdf/index.ts strips ₩/￦; web pdf.ts does not.

### C8-04: Web XLSX parser missing merged cell forward-fill [BUG]
**File:** `apps/web/src/lib/parser/xlsx.ts` lines 422-468
**Severity:** HIGH
Server XLSX parser forward-fills date/merchant/category for merged cells (lines 261-296).
Web XLSX parser has no forward-fill — installment sub-rows with empty merged date cells are skipped.

### C8-05: Unused HEADER_KEYWORDS import [CODE QUALITY]
**File:** `apps/web/src/lib/parser/xlsx.ts` line 12
**Severity:** LOW — lint hint (ts6133)

## Positive Observations
1. Server-side Won sign, forward-fill, encoding detection all correct
2. Column matcher patterns identical server ↔ web
3. isValidHeaderRow normalization handles all edge cases
4. PDF fallback line scanner robust on both sides
5. All 231 vitest + 481 bun tests pass