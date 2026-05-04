# Code Reviewer -- Cycle 34

**Date:** 2026-05-05
**Tests:** 851 bun, 243 vitest (1094 total)

## Focus Areas
- Server/web parity: Won-sign (₩/╋) amount handling across all parsers
- "마이너스" prefix handling parity
- PDF fallback line scanner Won-sign support
- Test coverage gaps

## Findings

### F-01: Server-side PDF AMOUNT_PATTERN missing ╋ alternation (MEDIUM)
**File:** `packages/parser/src/pdf/index.ts:23`
The server-side AMOUNT_PATTERN has `₩\d[\d,]*` but NOT `￩\d[\d,]*`. Small Won-sign amounts with fullwidth ╋ (like "￩500", 3 digits, no comma) fail to match. The web-side version and table-parser.ts already have both alternations.

### F-02: Server+Web PDF fallbackAmountPattern missing Won-sign alternations (MEDIUM)
**Files:** `packages/parser/src/pdf/index.ts:293`, `apps/web/src/lib/parser/pdf.ts:534`
Both fallback line-scanner regexes are missing Won-sign alternations. Won-sign amounts like "₩500" or "￩1,234" on PDF lines without structured table data would be silently dropped.

### F-03: Server-side XLSX parseAmount missing "마이너스" prefix (MEDIUM)
**File:** `packages/parser/src/xlsx/index.ts` parseAmount
The server XLSX parseAmount handles parenthesized negatives but NOT "마이너스" prefix. The CSV shared parseCSVAmount and all web-side parsers handle it.

### F-04: Web-side PDF parseAmount missing "마이너스" prefix (MEDIUM)
**File:** `apps/web/src/lib/parser/pdf.ts:265-283`
The web PDF parseAmount is missing "마이너스" prefix handling that the web CSV and XLSX parsers have.

### F-05: Test coverage gaps (MEDIUM)
Missing tests for Won-sign PDF amounts, 마이너스 web PDF, 마이너스 server XLSX, and Won-sign PDF fallback amounts.

## No Regressions
All existing code paths unchanged. Only additive regex alternations and prefix handling insertions.