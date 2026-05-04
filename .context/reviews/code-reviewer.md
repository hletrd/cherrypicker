# Cycle 72 Code Review

## C72-01: "1,234 원" fails to parse (BUG - HIGH)

All 6 parseAmount/parseCSVAmount functions use `원$` which fails when there is a space before the Won sign character. Korean bank exports sometimes use "1,234 원" with a space.

**Root cause:** The replacement chain `.replace(/원$/, '').replace(/[₩￦]/g, '').replace(/,/g, '').replace(/\s/g, '')` strips whitespace AFTER checking for 원 at end-of-string. For "1,234 원", the 원 is not at end (preceding space), so the replacement fails. After whitespace removal, "1234원" remains, which parseFloat returns NaN for.

**Fix:** Change `원$` to `\s*원$` in all 6 locations. Also change `원?` to `\s*원?` in AMOUNT_PATTERNS column detection arrays.

**Files:**
1. `packages/parser/src/csv/shared.ts` line 108
2. `packages/parser/src/csv/generic.ts` lines 68-76 (AMOUNT_PATTERNS)
3. `packages/parser/src/xlsx/index.ts` line 132
4. `packages/parser/src/pdf/index.ts` line 63
5. `apps/web/src/lib/parser/csv.ts` line 130, lines 240-251
6. `apps/web/src/lib/parser/xlsx.ts` line 287
7. `apps/web/src/lib/parser/pdf.ts` line 269

## C72-02: Server-side XLSX isHTMLContent missing BOM strip (BUG - MEDIUM)

Server-side does not strip BOM before checking HTML signatures. Web-side does (added C75-01).

**File:** `packages/parser/src/xlsx/index.ts` line 28

## C72-03: Missing column header patterns (ENHANCEMENT - LOW)

AMOUNT_COLUMN_PATTERN missing "사용금액". DATE_COLUMN_PATTERN missing "매입일", "전표일". MERCHANT_COLUMN_PATTERN missing "거래내역", "이용가맹점명".

**File:** `packages/parser/src/csv/column-matcher.ts`

## No Regressions

All 1018 bun tests pass. Server/web parity is excellent except C72-02.