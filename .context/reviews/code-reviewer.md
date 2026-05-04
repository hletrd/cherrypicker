# Code Review -- Cycle 47

## Findings: 4 actionable

### F1. Summary row pattern missing "합산" [MEDIUM]
- `packages/parser/src/csv/column-matcher.ts` line 83
- SUMMARY_ROW_PATTERN covers 합계/소계/총계/누계 but not "합산" (another common Korean word for "aggregate/total")
- Some bank exports use 합산 instead of 합계
- Fix: add `합\s*산` with Korean boundary guards

### F2. Stale .omc state file in source tree [LOW]
- `packages/parser/src/csv/.omc/state/last-tool-error.json`
- OMC state file landed inside the parser source directory
- Fix: remove and ensure .omc is in .gitignore

### F3. Amount parsing edge cases lack test coverage [MEDIUM]
- `packages/parser/src/csv/shared.ts`, `packages/parser/__tests__/csv-shared.test.ts`
- Single dash `-`, zero-amount with 원 suffix `"0원"`, `-0`, spaces-only, Won-sign with spaces untested
- Fix: add tests for these edge cases

### F4. XLSX forward-fill does not validate against summary row pattern [LOW]
- `packages/parser/src/xlsx/index.ts`
- Forward-filled date/merchant values are not re-validated against SUMMARY_ROW_PATTERN
- A forward-filled value from a summary row could contaminate subsequent rows
- Fix: validate forward-filled values before using them

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