# Code Reviewer -- Cycle 33

**Date:** 2026-05-05
**Tests:** 851 bun, 243 vitest (1094 total)

## Findings

### F-01: Server-side PDF AMOUNT_PATTERN rejects Won-sign-prefixed small amounts [HIGH]

**Location:** `packages/parser/src/pdf/index.ts` line 23 and `packages/parser/src/pdf/table-parser.ts` line 75

Server-side STRICT pattern:
```
/^[₩￦]?-?(?:[\d,]*,|\d{5,})[\d,]*원?$|^\([\d,]+\)$/
```

This requires either a comma or 5+ digits. "₩500" has no comma and only 3 digits, so it fails. The web-side pattern correctly handles this with separate Won-sign alternations. The same issue exists in `STRICT_AMOUNT_PATTERN` in `table-parser.ts`.

**Impact:** PDF transactions with small Won-sign amounts (under 10,000 won) are silently dropped in the server-side PDF parser.

### F-02: Server-side PDF fallback regex missing Won-sign amount support [MEDIUM]

**Location:** `packages/parser/src/pdf/index.ts` line 293

Server:
```
const fallbackAmountPattern = /\(([\d,]+)\)|([\d,]*(?:,|\d{5,})[\d,]*)원?/g;
```

Web (pdf.ts line 531) includes Won-sign alternations. Server fallback line scanner misses small Won-sign amounts.

### F-03: Web-side parseAmount missing "마이너스" prefix handling [MEDIUM]

Server-side `parseCSVAmount` in `shared.ts` (line 38-41) handles "마이너스" prefix. Web-side `parseAmount` in `csv.ts`, `xlsx.ts`, and `pdf.ts` do NOT. Amounts like "마이너스 1,234" would be parsed as positive values on the web side.

### F-04: findColumn fails on combined/delimited column headers [MEDIUM]

**Location:** `packages/parser/src/csv/column-matcher.ts`

Korean bank exports sometimes use combined headers like "이용일/승인일", "이용금액-원". `normalizeHeader` strips whitespace and parentheticals but "/" and "-" remain. "이용일/승인일" normalizes to "이용일승인일" which doesn't match keyword "이용일". Similarly, `isValidHeaderRow` keyword matching fails on combined headers.

**Fix:** `findColumn` should split normalized headers on "/" and "-" delimiters and test each part.

### F-05: Web-side PDF local amount patterns duplicate column-matcher [LOW]

`apps/web/src/lib/parser/pdf.ts` defines local `AMOUNT_PATTERN` and `STRICT_AMOUNT_PATTERN` instead of importing from column-matcher. Maintenance burden and divergence risk.

### F-06: Test coverage gaps [MEDIUM]

Missing tests for:
- Server-side PDF parsing of Won-sign-prefixed amounts like "₩500"
- Web-side "마이너스" prefix handling
- Combined column header matching in findColumn