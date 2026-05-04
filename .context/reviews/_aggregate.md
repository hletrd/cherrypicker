# Aggregate Review -- Cycle 46

## New Findings: 4 actionable

### Actionable (implement this cycle)

**F1. PDF Merchant Extraction Fails for Adjacent Date/Amount Columns [HIGH]**
- `packages/parser/src/pdf/index.ts`, `apps/web/src/lib/parser/pdf.ts`
- Fix: add fallback scanning non-date/amount cells for Korean text

**F2. Column Pattern Coverage Gaps [MEDIUM]**
- `packages/parser/src/csv/column-matcher.ts`
- Fix: add 사용일|사용일자, 사용처|payee, 매입금액, 할부회수|install, 상세내역

**F3. Summary Row Pattern Missing Common Terms [MEDIUM]**
- `packages/parser/src/csv/column-matcher.ts`
- Fix: add 이월잔액|전월이월|이월금액 with boundary guards

**F4. Test Coverage Gaps [LOW]**
- Fix: add tests for new patterns and edge cases

### Deferred (unchanged)

| Item | Reason |
|------|--------|
| D-01 | Server/web shared module -- architectural refactor |
| D-02 | PDF multi-line headers -- edge case |
| D-03 | Web CSV 10 hand-rolled adapters -> factory pattern |