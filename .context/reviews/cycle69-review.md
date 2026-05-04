# Cycle 69 Deep Code Review

## Findings (6 actionable, 3 deferred)

### F1: Additional column header terms for broader bank format coverage (FORMAT DIVERSITY - MEDIUM)
**Files**: `packages/parser/src/csv/column-matcher.ts`, `apps/web/src/lib/parser/column-matcher.ts`
Missing Korean bank column header terms that some banks use:
- DATE: "입금일", "주문일", "결제예정일", "작성일시", "승인시간"
- MERCHANT: "상호명", "업체명", "판매자", "가맹점상호"
- AMOUNT: "실청구금액", "실결제금액", "결제예정금액"
- MEMO: "승인번호", "카드번호", "승인내역", "비고사항"

### F2: Additional summary row patterns (FORMAT DIVERSITY - MEDIUM)
**Files**: `packages/parser/src/csv/column-matcher.ts`, `apps/web/src/lib/parser/column-matcher.ts`
Missing summary/total row patterns:
- "당월청구금액" (current month billing amount)
- "이전잔액" (previous balance)  
- "결제완료" (payment complete)
- "승인취소합계" (approval cancel total)
- "할인합계" (discount total)
- "포인트사용" (point usage - not a card transaction)

### F3: Web-side CSV bank adapter missing amount error raw text enrichment (SERVER/WEB PARITY - LOW)
**File**: `apps/web/src/lib/parser/csv.ts` line 503
Server-side adapter-factory.ts enriches amount errors with raw row text for debugging (line 134-139). Web-side bank adapters just skip with no raw text.

### F4: Web-side CSV bank adapter missing column detection failure error (UX - LOW)
**File**: `apps/web/src/lib/parser/csv.ts` createBankAdapter
The web-side generic CSV parser reports "필수 컬럼을 찾을 수 없습니다" (line 367-372), but the web-side bank adapter factory does NOT report this error when date/amount columns aren't found.

### F5: Web-side CSV missing console.warn on adapter detect failure (OBSERVABILITY - LOW)
**File**: `apps/web/src/lib/parser/csv.ts` line 822
Server-side logs adapter detection failures; web-side does not (was already noted in cycle 67 F3).

### F6: Additional English column header terms (FORMAT DIVERSITY - LOW)
**Files**: Both column-matcher.ts files
Missing English terms for international users:
- DATE: "transaction_date", "trans_date", "purchase_date", "order_date"
- MERCHANT: "seller", "company", "business", "payee_name"
- AMOUNT: "total_amount", "paid", "spent", "cost", "value"

### Deferred
- **D1**: PDF multi-line header support (complex, low ROI)
- **D2**: D-01 architectural refactor (shared module between Bun and browser)
- **D3**: Historical amount display format