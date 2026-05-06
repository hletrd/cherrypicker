# Aggregate Review — CherryPicker Cycle 40

**Date:** 2026-05-06
**Cycle:** 40 / 100
**Reviews performed by:** code-reviewer, security-reviewer, perf-reviewer, test-engineer, architect, debugger, critic, verifier, designer, document-specialist

---

## Executive Summary

Cycle 40 is a **light maintenance cycle** with 3 new findings of Medium or Low severity. The dominant theme is **layered validation gaps**: the C39 NaN guard in `calculateRewards` correctly rejects invalid input at the core, but the store layer above it does not prevent NaN from flowing through sessionStorage, resulting in poor UX when the guard triggers. All gates pass.

| Severity | New (Cycle 40) | Carryover | Total Open |
|----------|----------------|-----------|------------|
| Critical | 0 | 0 | 0 |
| High | 0 | 3 | 3 |
| Medium | 1 | 14 | 15 |
| Low | 2 | 22 | 24 |

---

## New Findings (Cycle 40) — Priority Ordered

### Debugger / Correctness

| ID | Severity | File | Description |
|----|----------|------|-------------|
| BUG-40-01 | Medium | `store.svelte.ts:347,490-492` | NaN persists to sessionStorage via `typeof === 'number'` validation |
| BUG-40-02 | Low | `csv/shared.ts:165-183` | `parseAmountString` double-negative: `(-1234)` → positive 1234 |

### Code Review

| ID | Severity | File | Description |
|----|----------|------|-------------|
| CR-40-01 | Medium | `store.svelte.ts:490-492` | `analyze()` stores unvalidated `previousMonthSpending` |
| CR-40-02 | Low | `csv/shared.ts:165-183` | `parseAmountString` double-negative bug |
| CR-40-03 | Low | `ofx/index.ts:34-56` | OFX parser silently drops SGML blocks in mixed-format files |

### Security

| ID | Severity | File | Description |
|----|----------|------|-------------|
| SEC-40-01 | Low | `store.svelte.ts:347` | NaN in sessionStorage violates data integrity |

### Test Engineering

| ID | Severity | File | Description |
|----|----------|------|-------------|
| TE-40-01 | Low | `non-spending-parity.test.ts` | Parity tests only cover server-side parsers |
| TE-40-02 | Low | `csv/shared.ts:165-183` | No test for `parseAmountString` double-negative |

### Architecture

| ID | Severity | File | Description |
|----|----------|------|-------------|
| ARCH-40-01 | Low | `csv/shared.ts:148-184` | `parseAmountString` replacement ordering is fragile |

### Designer / UX

| ID | Severity | File | Description |
|----|----------|------|-------------|
| U-DES-40-01 | Low | `reward.ts:190-193` | Calculator error message leaks implementation detail |

### Documentation

| ID | Severity | File | Description |
|----|----------|------|-------------|
| DOC-40-01 | Low | `csv/shared.ts:134-147` | JSDoc omits parenthesized negative format detail |

### Critic / Design

| ID | Severity | File | Description |
|----|----------|------|-------------|
| C40-CRIT01 | Medium | `store.svelte.ts`, `reward.ts` | Layered validation gap — store accepts NaN that core rejects |
| C40-CRIT02 | Low | Pervasive | Cycle reference comments continue to proliferate |

---

## Cross-Agent Agreement

1. **NaN Persistence Through Store** (BUG-40-01, CR-40-01, SEC-40-01, C40-CRIT01): **AGREED** by debugger, code-reviewer, security-reviewer, critic, verifier. The `typeof === 'number'` check in `loadFromStorage` and the unvalidated store in `analyze()` allow NaN to persist and crash reoptimize.
2. **Double-Negative Parse Bug** (BUG-40-02, CR-40-02, TE-40-02): **AGREED** by debugger, code-reviewer, test-engineer, verifier. `(-1234)` incorrectly returns positive 1234.

---

## Carryover Issues (Still Open from Cycles 32-39)

### High Priority Carryover

| ID | Description | File |
|----|-------------|------|
| C32-V02 | `isOnline` dead code removed in C39 | FIXED |
| BUG-3 | NaN propagation — core fixed (C39), store gap remains | `store.svelte.ts` |
| BUG-4 | EUC-KR detection | `xlsx.ts:99` |

### Medium Priority Carryover (Selection)

| ID | Description | File |
|----|-------------|------|
| CR-15 | ReDoS in SUMMARY_ROW_PATTERN | `column-matcher.ts:93` |
| SEC-01 | CSP unsafe-inline | `Layout.astro:50` |
| PERF-02 | Optimizer O(C*T^2) | `greedy.ts:39-71` |
| PERF-06 | cardPreviousSpending O(cards*tx) | `analyzer.ts:224` |
| TE-37-01 | No tests for OFX CCSTMTRS | `ofx/index.ts:29-31` |
| TE-37-02 | No tests for HTML forward-fill (web-side) | `html.ts` |
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
   - BUG-40-01 / CR-40-01 (NaN persistence) — add `Number.isFinite()` validation in `loadFromStorage` and `analyze()`
   - BUG-40-02 (double-negative) — fix `parseAmountString` parenthesis handling

2. **FIX RECOMMENDED:**
   - CR-40-03 (OFX mixed-format) — always run SGML extraction as supplement
   - U-DES-40-01 (error message UX) — translate calculator error to Korean

3. **SCHEDULE FOR NEXT MAJOR CYCLE:**
   - Parser unification (eliminate duplication)
   - Remove cycle references older than Cycle 20

---

## Gate Verification

| Gate | Result |
|------|--------|
| `npm run lint` | PASS |
| `npm run typecheck` | PASS |
| `bun run test` | PASS (1555+ tests) |

---

## Agent Notes

- All reviews performed manually.
- Reviews verified against current HEAD (commit 97ae75c).
- Cross-agent agreement identified two clusters: NaN persistence and double-negative parsing.
