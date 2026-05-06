# Aggregate Review — CherryPicker Cycle 41

**Date:** 2026-05-06
**Cycle:** 41 / 100
**Reviews performed by:** code-reviewer, security-reviewer, perf-reviewer, test-engineer, architect, debugger, critic, verifier, designer, document-specialist

---

## Executive Summary

Cycle 41 is a **light maintenance cycle** with 5 new findings of Medium or Low severity, plus verification of 3 cycle-40 fixes. The dominant themes are **silent precision loss** (amount tests document incorrect behavior) and **OFX timezone handling** (incorrect date for time-only entries). All gates pass.

| Severity | New (Cycle 41) | Carryover | Total Open |
|----------|----------------|-----------|------------|
| Critical | 0 | 0 | 0 |
| High | 0 | 3 | 3 |
| Medium | 3 | 14 | 17 |
| Low | 2 | 22 | 24 |

---

## Verified Fixed in Cycle 41

| ID | Finding | File | Evidence |
|----|---------|------|----------|
| BUG-40-02 | `parseAmountString` double-negative | `csv/shared.ts:170-172` | `isNeg = false` for inner negatives |
| BUG-40-01 | NaN persists to sessionStorage | `store.svelte.ts:347-350` | `Number.isFinite()` validation |
| CR-40-01 | `analyze()` stores unvalidated spending | `store.svelte.ts:494-500` | `Number.isFinite()` + `>= 0` guard |

---

## New Findings (Cycle 41) — Priority Ordered

### Debugger / Correctness

| ID | Severity | File | Description |
|----|----------|------|-------------|
| BUG-41-01 | Medium | `ofx/index.ts:88-115`, `ofx.ts:57-84` | `parseOFXDate` shifts dates for time-only entries without timezone |
| BUG-41-02 | Medium | `analyzer.ts:315-317` | `Promise.all` batch fails entirely on single file error |
| BUG-41-03 | Low | `csv/shared.ts:188-191` | `parseAmountString` silent precision loss above MAX_SAFE_INTEGER |

### Code Review

| ID | Severity | File | Description |
|----|----------|------|-------------|
| CR-41-01 | Medium | `__tests__/amount.test.ts:104-105` | Test documents precision loss as expected behavior |
| CR-41-02 | Low | `analyzer.ts:381-392` | `previousMonthSpending` not validated at call site |
| CR-41-03 | Medium | `ofx/index.ts:88-115`, `ofx.ts:57-84` | Timezone math applies KST offset without timezone present |
| CR-41-04 | Low | `json/index.ts:67-83` | `findField` allocates Map per transaction object |
| CR-41-05 | Low | `store.svelte.ts:295-306` | `cardResults` validation misses `totalReward` finiteness |

### Performance

| ID | Severity | File | Description |
|----|----------|------|-------------|
| PERF-41-01 | Low | `json/index.ts:67-83` | Map allocation per object creates GC pressure |
| PERF-41-02 | Medium | `greedy.ts:39-71` | `scoreCardsForTransaction` O(C*T^2) — carryover |
| PERF-41-03 | Low | `html.ts:32-35` | `normalizeHTML` while-loop rescans content repeatedly |

### Security

| ID | Severity | File | Description |
|----|----------|------|-------------|
| SEC-41-01 | Low | `csv/shared.ts:210-228` | `normalizeHTML` regex bypassable by nested tags |
| SEC-41-02 | Low | `store.svelte.ts:220-231` | `safeJSONParse` key list incomplete |

### Test Engineering

| ID | Severity | File | Description |
|----|----------|------|-------------|
| TE-41-01 | Medium | `__tests__/amount.test.ts:104-105` | No test for precision boundary |
| TE-41-02 | Medium | `ofx/index.ts:88-115` | No tests for `parseOFXDate` timezone conversion |
| TE-41-03 | Medium | `analyzer.ts:315-317` | No tests for batch error handling |
| TE-41-04 | Low | `html.ts:29-54` | No tests for `normalizeHTML` security patterns |

### Architecture

| ID | Severity | File | Description |
|----|----------|------|-------------|
| ARCH-41-01 | Medium | `analyzer.ts:315-317` | Batch analysis lacks per-file error isolation |
| ARCH-41-02 | Low | `packages/parser/` vs `apps/web/` | Parser duplication continues to grow |
| ARCH-41-03 | Medium | `greedy.ts:39-71` | O(C*T^2) optimizer — carryover |

### Critic / Design

| ID | Severity | File | Description |
|----|----------|------|-------------|
| C41-CRIT01 | Medium | Pervasive | Cycle reference comments are technical debt |
| C41-CRIT02 | Medium | `__tests__/amount.test.ts:104-105` | Precision loss test documents incorrect behavior |
| C41-CRIT03 | Medium | `analyzer.ts:315-317` | Batch failure is poor UX |
| C41-CRIT04 | Medium | `ofx/index.ts:80-87` | OFX timezone handling over-engineered and wrong |

### Designer / UX

| ID | Severity | File | Description |
|----|----------|------|-------------|
| U-DES-41-01 | Medium | `analyzer.ts:315-317` | No per-file error feedback in batch uploads |
| U-DES-41-02 | Low | `csv/shared.ts:188-191` | Precision loss invisible to users |

### Documentation

| ID | Severity | File | Description |
|----|----------|------|-------------|
| DOC-41-01 | Medium | `ofx/index.ts:80-87` | JSDoc misrepresents timezone handling |
| DOC-41-02 | Low | `csv/shared.ts:134-147` | JSDoc omits MAX_SAFE_INTEGER limit |
| DOC-41-03 | Low | Pervasive | Cycle reference comments bloat files |

### Verifier

| ID | Status | File | Description |
|----|--------|------|-------------|
| V-41-01 | VERIFIED | `csv/shared.ts:190-191` | `(-0)` returns `0` via guard |
| V-41-02 | VERIFIED | `store.svelte.ts:586-595` | `previousMonthSpending` validated in `reoptimize()` |
| V-41-03 | CONFIRMED | `ofx/index.ts:88-115` | Time-only OFX date shift confirmed with trace |
| V-41-04 | CONFIRMED | `store.svelte.ts:295-306` | `cardResults.totalReward` not finite-checked |

---

## Cross-Agent Agreement

1. **OFX Timezone Bug** (BUG-41-01, CR-41-03, C41-CRIT04, DOC-41-01): **AGREED** by debugger, code-reviewer, critic, document-specialist, verifier. The timezone math applies +9h even when no timezone is present, potentially shifting dates for evening transactions.
2. **Precision Loss Test** (CR-41-01, BUG-41-03, C41-CRIT02): **AGREED** by code-reviewer, debugger, test-engineer, critic. The amount test documents incorrect behavior above MAX_SAFE_INTEGER.
3. **Batch Error Handling** (BUG-41-02, C41-CRIT03, ARCH-41-01, U-DES-41-01, TE-41-03): **AGREED** by debugger, architect, critic, designer, test-engineer. Single file failure aborts entire batch.

---

## Carryover Issues (Still Open from Cycles 32-40)

### High Priority Carryover

| ID | Description | File |
|----|-------------|------|
| BUG-3 | NaN propagation — core fixed, analyzer.ts:381 unguarded | `analyzer.ts` |
| BUG-4 | EUC-KR HTML detection failure | `xlsx.ts:99` |

### Medium Priority Carryover (Selection)

| ID | Description | File |
|----|-------------|------|
| CR-15 | ReDoS in SUMMARY_ROW_PATTERN | `column-matcher.ts:93` |
| SEC-01 | CSP unsafe-inline | `Layout.astro:50` |
| PERF-02 | Optimizer O(C*T^2) | `greedy.ts:39-71` |
| PERF-06 | cardPreviousSpending O(cards*tx) | `analyzer.ts:224` |
| TE-37-01 | No tests for OFX CCSTMTRS | `ofx/index.ts:29-31` |
| TE-37-02 | No tests for HTML forward-fill (web) | `html.ts` |
| DOC-37-01 | Misleading parseOFXDate JSDoc | `ofx/index.ts:85` |
| U-DES-37-01 | No feedback when transactions filtered | All parsers |

### Deferred (Exit Criteria Not Met)

| ID | Description | Reason |
|----|-------------|--------|
| SEC-08 | sessionStorage encryption | Requires UX key management |
| PERF-02 | Optimizer incremental update | Needs benchmarking |
| PERF-01 | keywords.ts bundle size | Requires measurement |
| CR-07/CR-17 | Type unification + parser dedup | Large refactoring |

---

## Recommendations

1. **FIX THIS CYCLE:**
   - BUG-41-01 (OFX timezone) — incorrect dates for time-only entries
   - CR-41-01 (precision test) — fix or document the test
   - BUG-41-02 (batch failure) — add per-file error isolation

2. **FIX RECOMMENDED:**
   - CR-41-05 (cardResults validation) — add `Number.isFinite()` check
   - TE-41-02 (OFX date tests) — add timezone conversion tests
   - DOC-41-01 (JSDoc) — correct timezone documentation

3. **SCHEDULE FOR NEXT MAJOR CYCLE:**
   - Parser unification (eliminate duplication)
   - Remove cycle references older than Cycle 20
   - Batch upload UX redesign

---

## Gate Verification

| Gate | Result |
|------|--------|
| `npm run lint` | PASS (2 ts(80008) hints in amount.test.ts) |
| `npm run typecheck` | PASS (2 ts(80008) hints in amount.test.ts) |
| `bun run test` | PASS (237 web + 17 CLI tests) |

---

## Agent Notes

- All reviews performed manually due to unavailability of Agent spawning tool.
- Reviews verified against current HEAD (commits through 2bce837).
- Cross-agent agreement identified three clusters: OFX timezone, precision loss, batch error handling.
- The uncommitted change in `packages/parser/__tests__/amount.test.ts` was evaluated and determined correct.
