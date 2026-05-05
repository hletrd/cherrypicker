# Cycle 99 Implementation Plan

## Goal
Fix reliability gaps in HTML, OFX, and JSON parsers. Add isValidShortDate to web-side date-utils.ts. Improve HTML parser with forward-fill for merged cells. Add CREDITCARDMSGSRSV1 support to OFX parser. Fix JSON negative-amount handling.

## Plan

### P1: Add isValidShortDate to web-side date-utils.ts + update PDF import (F1, F8) [RELIABILITY]
**Files:** `apps/web/src/lib/parser/date-utils.ts`, `apps/web/src/lib/parser/pdf.ts`
- Add `isValidShortDate` function to `apps/web/src/lib/parser/date-utils.ts` (copy from server-side `packages/parser/src/date-utils.ts` lines 201-221)
- Update `apps/web/src/lib/parser/pdf.ts` to import `isValidShortDate` from `./date-utils.js` instead of defining it locally
- Remove ~25 lines of local definition from pdf.ts

### P2: Add forward-fill to HTML parser (F2) [RELIABILITY]
**Files:** `packages/parser/src/html/index.ts`
- Add forward-fill variables (lastDate, lastMerchant, lastCategory, lastInstallments, lastMemo, lastAmount)
- Add `isNonEmpty()` helper matching XLSX parser pattern
- Apply forward-fill for each column before parsing, matching XLSX parser logic
- Handle summary row contamination prevention

### P3: Add CREDITCARDMSGSRSV1 support to OFX parser (F3) [RELIABILITY]
**Files:** `packages/parser/src/ofx/index.ts`
- Add XML extraction for `<CCSTMTTRNRS>` wrapper blocks containing `<STMTTRN>`
- Add SGML extraction terminator `</CCSTMTRS` alongside existing `</STMTRS`
- Extract bank name from `<ORG>` tag in OFX FI (financial institution) element

### P4: Fix JSON parser negative amount handling (F7) [RELIABILITY]
**Files:** `packages/parser/src/json/index.ts`
- Change amount filter: take abs(negative amounts) for refunds, skip zero only
- Report negative amounts as valid transactions rather than silently dropping

### P5: Add tests for new behaviors
**Files:** `packages/parser/__tests__/html.test.ts`, `packages/parser/__tests__/ofx.test.ts`, `packages/parser/__tests__/json.test.ts`
- HTML forward-fill test with merged cell data
- OFX CREDITCARDMSGSRSV1 credit card file test
- JSON negative amount test

### P6: Quality gates
- bun test, vitest, typecheck, lint, build

## Deferred
- D-01: Full server/web dedup into packages/shared/ (requires build system changes)
- D-02: Confidence scoring on ParseResult
- D-03: Clipboard paste format