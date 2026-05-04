# Cycle 69 Aggregate Review

## Findings (6 actionable)

### F1: Additional column header terms for broader bank format coverage (FORMAT DIVERSITY - MEDIUM)
**Files**: Both column-matcher.ts files
Missing Korean bank column header terms for date, merchant, amount, and memo columns.

### F2: Additional summary row patterns (FORMAT DIVERSITY - MEDIUM)
**Files**: Both column-matcher.ts files
Missing summary/total row patterns for "당월청구금액", "이전잔액", "결제완료", "할인합계", "포인트사용".

### F3: Web-side CSV bank adapter missing amount error raw text enrichment (SERVER/WEB PARITY - LOW)
**File**: apps/web/src/lib/parser/csv.ts createBankAdapter

### F4: Web-side CSV bank adapter missing column detection failure error (UX - LOW)
**File**: apps/web/src/lib/parser/csv.ts createBankAdapter

### F5: Web-side CSV missing console.warn on adapter detect failure (OBSERVABILITY - LOW)
**File**: apps/web/src/lib/parser/csv.ts line 822

### F6: Additional English column header terms (FORMAT DIVERSITY - LOW)
**Files**: Both column-matcher.ts files

## Deferred
- D1: PDF multi-line header support
- D2: D-01 architectural refactor
- D3: Historical amount display format