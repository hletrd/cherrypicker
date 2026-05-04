# Code Review -- Cycle 46

## Findings: 4 actionable

### F1. PDF Merchant Extraction Fails for Adjacent Date/Amount Columns [HIGH]
- `packages/parser/src/pdf/index.ts` lines 160-181
- `apps/web/src/lib/parser/pdf.ts` lines 361-380
- When PDF table columns have date and amount adjacent (no merchant column between), merchant extraction yields empty string
- The "between date and amount" heuristic cannot find merchant text when there are zero cells between them
- Fix: when between-cells extraction yields nothing, scan non-date/amount cells for longest Korean-text cell

### F2. Column Pattern Coverage Gaps [MEDIUM]
- `packages/parser/src/csv/column-matcher.ts` lines 64-69
- Missing common Korean bank column name variations:
  - Date: "사용일", "사용일자" (some banks use "사용" instead of "이용")
  - Merchant: "사용처", "payee"
  - Amount: "매입금액" (purchase amount used by merchant acquirers)
  - Installments: "할부회수", "install" (common English short form)
  - Memo: "상세내역"
- Fix: add missing terms to column pattern regexes and HEADER_KEYWORDS

### F3. Summary Row Pattern Missing Common Terms [MEDIUM]
- `packages/parser/src/csv/column-matcher.ts` line 83
- Missing "이월잔액", "전월이월", "이월금액" which appear in Korean bank statement footers
- Fix: add these terms with boundary guards

### F4. Test Coverage Gaps [LOW]
- No tests for PDF merchant extraction with adjacent date/amount columns
- No tests for summary row pattern matching "합계" inside longer text
- No tests for generic CSV merchant inference from Korean text columns
- Fix: add targeted tests for these scenarios