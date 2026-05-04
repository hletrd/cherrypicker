# Aggregate Review -- Cycle 47

## New Findings: 4 actionable

### Actionable (implement this cycle)

**F1. Summary row pattern missing "합산" [MEDIUM]**
- `packages/parser/src/csv/column-matcher.ts`
- Fix: add 합산 to SUMMARY_ROW_PATTERN

**F2. Stale .omc state file in source tree [LOW]**
- `packages/parser/src/csv/.omc/state/last-tool-error.json`
- Fix: remove

**F3. Amount parsing edge cases lack test coverage [MEDIUM]**
- `packages/parser/__tests__/csv-shared.test.ts`
- Fix: add tests for `-`, `0원`, `-0`, spaces-only, Won+spaces

**F4. XLSX forward-fill does not validate against summary pattern [LOW]**
- `packages/parser/src/xlsx/index.ts`
- Fix: skip forward-fill for summary row values

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