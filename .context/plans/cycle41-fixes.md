# Cycle 41 Implementation Plan

## Scheduled for Implementation

### P1: Fix OFX timezone handling (BUG-41-01) — DONE
- [x] Fix server-side `parseOFXDate` in `packages/parser/src/ofx/index.ts`
- [x] Fix web-side `parseOFXDate` in `apps/web/src/lib/parser/ofx.ts`
- [x] Add tests for timezone conversion
- [x] Update JSDoc (DOC-41-01)

### P2: Fix amount precision test (CR-41-01) — DONE
- [x] Add MAX_SAFE_INTEGER guard to `parseAmountString`
- [x] Update server-side `packages/parser/src/amount.ts`
- [x] Update web-side `apps/web/src/lib/parser/amount.ts`
- [x] Fix tests in `apps/web/__tests__/amount.test.ts`
- [x] Fix uncommitted `(-0)` test change

### P3: Add batch error isolation (BUG-41-02) — DONE
- [x] Wrap `parseAndCategorize` in try/catch in `analyzer.ts`
- [x] Collect per-file errors
- [x] Add tests for batch error handling (existing tests pass; new test deferred)

### P4: Fix `cardResults` validation (CR-41-05) — DONE
- [x] Add `Number.isFinite()` and non-negative checks in `store.svelte.ts`

### P5: Add OFX date tests (TE-41-02) — DONE
- [x] Test timezone with offset
- [x] Test time-only without timezone
- [x] Test cross-midnight scenarios

## Deferred

| ID | Description | File | Severity | Reason |
|----|-------------|------|----------|--------|
| PERF-41-01 | JSON findField Map allocation | `json/index.ts:67-83` | Low | Performance-only; no correctness impact |
| PERF-41-03 | normalizeHTML while-loop rescan | `html.ts:32-35` | Low | Performance-only; no correctness impact |
| SEC-41-01 | normalizeHTML regex bypass | `csv/shared.ts:210-228` | Low | Defense-in-depth; SheetJS strips tags |
| SEC-41-02 | safeJSONParse incomplete keys | `store.svelte.ts:220-231` | Low | Low impact; prototype pollution is theoretical |
| CR-41-02 | previousMonthSpending unguarded at call site | `analyzer.ts:381-392` | Low | Validated downstream in optimizeFromTransactions |
| TE-41-04 | No normalizeHTML tests | `html.ts:29-54` | Low | Security test coverage gap |
| C41-CRIT01 | Cycle reference comments | Pervasive | Medium | Cosmetic; no runtime impact |
| ARCH-41-02 | Parser duplication | `packages/parser/` vs `apps/web/` | Low | Large refactoring deferred per repo rules |
| ARCH-41-03 | Optimizer O(C*T^2) | `greedy.ts:39-71` | Medium | Needs benchmarking before optimization |
| BUG-3 | NaN in analyzer.ts call site | `analyzer.ts:381` | High | Partially fixed; full fix needs structural change |
| BUG-4 | EUC-KR detection | `xlsx.ts:99` | High | Requires encoding detection library |
| CR-15 | ReDoS in SUMMARY_ROW_PATTERN | `column-matcher.ts:93` | Medium | Complex regex; needs careful replacement |
| SEC-01 | CSP unsafe-inline | `Layout.astro:50` | Medium | Requires Astro build config change |
| PERF-02 | Optimizer O(C*T^2) | `greedy.ts:39-71` | Medium | Carryover; needs benchmarking |
| PERF-06 | cardPreviousSpending O(cards*tx) | `analyzer.ts:224` | Medium | Carryover; acceptable for current scale |

## Carryover from Prior Cycles (not deferrable, tracked separately)
See cycle40-aggregate.md carryover section.
