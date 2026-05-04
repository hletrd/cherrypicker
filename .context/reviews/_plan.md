# Cycle 36 Implementation Plan

## Fixes (ordered by priority)

### P1: Extend column patterns with missing Korean/English terms
**File:** `packages/parser/src/csv/column-matcher.ts`
- Add to MERCHANT_COLUMN_PATTERN: `승인가맹점`, `이용내용`, `거래내용`, `내용`, `결제처`, English `name`
- Add to AMOUNT_COLUMN_PATTERN: `청구금액`, `출금액`, `결제대금`, `승인취소금액`, English `charge`, `payment`
- Add to DATE_COLUMN_PATTERN: `승인일시`, `접수일`, `발행일`, English `posted`, `billing`
- Add to INSTALLMENTS_COLUMN_PATTERN: `할부횟수`

### P2: Sync HEADER_KEYWORDS and category keyword Sets
**File:** `packages/parser/src/csv/column-matcher.ts`
- Add all new terms from P1 to HEADER_KEYWORDS array
- Add to DATE_KEYWORDS Set: `승인일시`, `접수일`, `발행일`, `posted`, `billing`
- Add to MERCHANT_KEYWORDS Set: `승인가맹점`, `이용내용`, `거래내용`, `내용`, `name`
- Add to AMOUNT_KEYWORDS Set: `청구금액`, `출금액`, `결제대금`, `승인취소금액`, `charge`, `payment`

### P3: PDF AMOUNT_PATTERN explicit 마이너스 support
**File:** `packages/parser/src/pdf/table-parser.ts`
- Add `마이너스[\d,]+원?` alternation to AMOUNT_PATTERN regex

### P4: Web PDF fallback pattern 마이너스 group
**File:** `apps/web/src/lib/parser/pdf.ts`
- Add 마이너스 capture group to fallbackAmountPattern (4th group)
- Update group extraction fallback chain to include group 4

### P5: Tests
**File:** `packages/parser/__tests__/column-matcher.test.ts` (new)
**File:** `packages/parser/__tests__/table-parser.test.ts`
- Test new column pattern terms
- Test PDF 마이너스 amounts
- Test combined headers with new terms

## Deferred Items
| ID | Item | Reason |
|----|------|--------|
| D-01 | Web CSV adapter factory refactor | Architecture refactor |
| D-02 | PDF multi-line header support | Complex, low ROI |
| D-03 | Server/web CSV parser dedup | Architecture refactor |
