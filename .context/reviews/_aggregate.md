# Cycle 37 Aggregate Review

**Date:** 2026-05-05
**Cycles completed:** 37
**Tests:** 673 bun (before changes)
**Reviewer:** Cycle 37 inline deep scan

---

## Finding 1: PDF table parser AMOUNT_PATTERN missing 마이너스 prefix [BUG]
- **Severity**: Medium
- **Files**: `packages/parser/src/pdf/table-parser.ts:14`, `apps/web/src/lib/parser/pdf.ts:42`
- Both server and web PDF `AMOUNT_PATTERN` (used by `filterTransactionRows()`) does NOT include `마이너스[\d,]+원?` as an alternative.
- Result: PDFs with 마이너스-prefixed amounts skip structured table parsing and fall through to the fallback line scanner, losing structured metadata (category, memo, installments).
- The `parseAmount()` function on both sides DOES handle 마이너스. Only the row-detection regex is missing it.
- **Impact**: Format diversity bug -- 마이너스 PDFs silently degrade.

## Finding 2: Server CSV adapter-factory only has 10 banks [COVERAGE]
- **Severity**: Medium
- **File**: `packages/parser/src/csv/adapter-factory.ts`
- Server CSV factory creates adapters for only 10 banks.
- XLSX adapter config (`packages/parser/src/xlsx/adapters/index.ts`) has 24 banks (adds kakao, toss, kbank, bnk, dgb, suhyup, jb, kwangju, jeju, sc, mg, cu, kdb, epost).
- If a CSV from one of these 14 banks is uploaded, the bank is detected but no bank-specific adapter exists, falling through to the generic parser.
- **Impact**: These 14 banks use the generic parser with weaker header matching.

## Finding 3: Web CSV parser hand-written adapters [TECH DEBT / DEFERRED]
- **File**: `apps/web/src/lib/parser/csv.ts` (1100+ lines)
- 10 hand-written adapters + duplicated helpers. Server-side solved with `createBankAdapter()`.
- **Decision**: DEFERRED to D-01 architectural refactor (requires shared module between Bun and browser).

## Finding 4: Missing test for PDF 마이너스 table rows [TEST]
- **File**: `packages/parser/__tests__/table-parser.test.ts`
- No test for `filterTransactionRows()` with 마이너스 amounts.

## Finding 5: Missing test for CSV adapters of non-top-10 banks [TEST]
- No tests for kakao, toss, kbank, etc. bank-specific CSVs via adapter-factory.

---

## Plan
1. **FIX**: Add 마이너스 to PDF AMOUNT_PATTERN (server + web)
2. **FIX**: Add 14 missing bank adapters to server CSV adapter-factory
3. **TEST**: Add tests for PDF 마이너스 table rows
4. **TEST**: Add tests for new CSV bank adapters (kakao, toss, kbank sample)
5. **DEFER**: Web CSV duplication (D-01 architectural refactor)