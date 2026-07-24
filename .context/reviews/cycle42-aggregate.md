# Aggregate Review — CherryPicker Cycle 42

**Date:** 2026-05-06
**Cycle:** 42 / 100
**Reviews performed by:** code-reviewer, security-reviewer, test-engineer, debugger

---

## Executive Summary

Cycle 42 is a **focused maintenance cycle** with 1 new High-severity finding and 3 new Medium-severity findings. The dominant theme is **parity gaps between server-side and web-side parsers**: cycle 41's double-negative fix was not propagated to the web-side amount parser, leaving user-facing parsing vulnerable. All cycle 41 fixes are verified correct.

| Severity | New (Cycle 42) | Carryover | Total Open |
|----------|----------------|-----------|------------|
| Critical | 0 | 0 | 0 |
| High | 1 | 2 | 3 |
| Medium | 3 | 16 | 19 |
| Low | 0 | 22 | 22 |

---

## Verified Fixed in Cycle 42 (from Cycle 41)

| ID | Finding | File | Evidence |
|----|---------|------|----------|
| BUG-41-01 | OFX timezone handling | `ofx/index.ts:109-111` | No-tz path returns date without conversion |
| BUG-41-02 | Batch error isolation | `analyzer.ts:325-341` | try/catch wraps each parseAndCategorize |
| CR-41-01 | Amount precision test | `amount.test.ts` | Tests assert null for >MAX_SAFE_INTEGER |
| CR-41-05 | cardResults validation | `store.svelte.ts:302-304` | `Number.isFinite(cr.totalReward)` guard present |

---

## New Findings (Cycle 42) — Priority Ordered

### Debugger / Correctness

| ID | Severity | File | Description |
|----|----------|------|-------------|
| BUG-42-01 | **High** | `apps/web/src/lib/parser/amount.ts:36-37` | Web-side parseAmount missing double-negative fix — `(-1234)` → positive 1234 |
| BUG-42-02 | Medium | `apps/web/src/lib/store.svelte.ts:270-272` | `optimization.totalReward`/`totalSpending`/`effectiveRate` lack `Number.isFinite()` |
| BUG-42-03 | Medium | `apps/web/src/lib/store.svelte.ts:345-346` | `monthlyBreakdown` entries lack `Number.isFinite()` for spending/transactionCount |
| BUG-42-04 | Low | `apps/web/src/lib/store.svelte.ts:344` | `monthlyBreakdown` month accepts empty strings |

### Code Review

| ID | Severity | File | Description |
|----|----------|------|-------------|
| CR-42-01 | Medium | `apps/web/src/lib/parser/amount.ts:36-37` | Parser parity gap: server fixed, web not fixed |
| CR-42-02 | Medium | `apps/web/src/lib/store.svelte.ts:265-356` | Inconsistent validation depth across loadFromStorage fields |
| CR-42-03 | Low | `packages/parser/` vs `apps/web/` | Parser duplication continues to grow (ARCH carryover) |

### Test Engineering

| ID | Severity | File | Description |
|----|----------|------|-------------|
| TE-42-01 | Medium | `apps/web/__tests__/amount.test.ts` | No web-side test for `(-1234)` double-negative |
| TE-42-02 | Medium | `apps/web/__tests__/` | No test for NaN in optimization scalars |
| TE-42-03 | Low | `apps/web/__tests__/` | No test for monthlyBreakdown NaN |

### Security

| ID | Severity | File | Description |
|----|----------|------|-------------|
| SEC-42-01 | Low | `store.svelte.ts:220-231` | safeJSONParse incomplete key list (carryover from SEC-41-02) |

---

## Cross-Agent Agreement

1. **Web-side Double-Negative Bug** (BUG-42-01, CR-42-01, TE-42-01): **AGREED** by debugger, code-reviewer, test-engineer. The web-side amount parser is missing the cycle 41 fix. This is the highest-priority finding this cycle.

2. **loadFromStorage Validation Gaps** (BUG-42-02, BUG-42-03, CR-42-02, TE-42-02, TE-42-03): **AGREED** by debugger, code-reviewer, test-engineer. Multiple numeric fields use `typeof === 'number'` without `Number.isFinite()`, allowing NaN/Infinity from corrupted sessionStorage to propagate.

---

## Carryover Issues (Still Open from Cycles 32-41)

### High Priority Carryover

| ID | Description | File |
|----|-------------|------|
| BUG-3 | NaN propagation — partially fixed, analyzer.ts:381 monthlySpending accumulation still unguarded | `analyzer.ts` |
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

---

## Recommendations

1. **FIX THIS CYCLE:**
   - BUG-42-01 (web-side double-negative) — port fix from server-side, add web-side test
   - BUG-42-02 (optimization scalar validation) — add Number.isFinite() guards
   - BUG-42-03 (monthlyBreakdown validation) — add Number.isFinite() guards

2. **FIX RECOMMENDED:**
   - BUG-42-04 (monthlyBreakdown month validation) — validate month format
   - TE-42-01 through TE-42-03 (test coverage)

3. **SCHEDULE FOR NEXT MAJOR CYCLE:**
   - Parser unification (eliminate web/server duplication)
   - BUG-4 (EUC-KR detection)
   - CR-15 (ReDoS fix)

---

## Gate Verification

| Gate | Result |
|------|--------|
| `npm run lint` | PASS |
| `npm run typecheck` | PASS |
| `bun run test` | PASS |

---

## Agent Notes

- Reviews performed manually due to unavailability of Agent spawning tool.
- Reviews verified against current HEAD (commit 7fa6eef).
- Cross-agent agreement identified two clusters: web-side parser parity and loadFromStorage validation gaps.
- BUG-42-01 is the most critical finding: user-facing parsing silently flips sign for parenthesized negatives.

---

## Post-Review Resolution (verified 2026-07-24)

This review was generated against commit `7fa6eef`. HEAD has since advanced past
that commit (`git merge-base --is-ancestor 7fa6eef HEAD` → true), and later
cycles landed the web-side parser unification (`375f0f2`) and the persistence
validation rewrite (`09c8e0c`, `09b8fb9`, `774d896`, …). Re-verifying every
finding against the current tree:

| ID | Status | Evidence on current HEAD |
|----|--------|--------------------------|
| BUG-42-01 / CR-42-01 / CR-42-03 | **Resolved** | `apps/web/src/lib/parser/amount.ts` now re-exports `@cherrypicker/parser/browser`; the shared parser preserves `(-1234) → -1234`. Web/server parity is structural (single implementation). |
| BUG-42-02 / CR-42-02 | **Resolved** | `persistence.ts:749-753` guards `optimization.totalReward`/`totalSpending`/`unassigned*` with `safeNonnegativeInteger` and `effectiveRate` with `finiteNonnegativeNumber`; `validCardResult` (`:400-402`) applies the same guards. Validation now lives in the side-effect-free persistence module, applied uniformly. |
| BUG-42-03 | **Resolved** | `persistence.ts:830-832` requires `safeNonnegativeInteger(item.spending)` and `safeNonnegativeInteger(item.transactionCount) && > 0`. |
| BUG-42-04 | **Resolved** | `persistence.ts:829` requires `isYearMonth(item.month)`; empty strings are rejected (`774d896` "reject empty persisted months"). |
| TE-42-01 | **Resolved** | `apps/web/__tests__/amount.test.ts:46-50` asserts `(-1234)`, `(-1,234)`, `(-0)`. |
| TE-42-02 | **Resolved** | `store-persistence.test.ts:1593-1615` rejects NaN/Infinity in optimization money; this cycle added an explicit `effectiveRate` NaN/Infinity/negative regression test. |
| TE-42-03 | **Resolved** | `store-persistence.test.ts:1631-1653` rejects out-of-range monthlyBreakdown values; this cycle added an explicit NaN regression test. |
| SEC-42-01 | **Mitigated (Low)** | `FORBIDDEN_KEYS` covers `__proto__`/`constructor`/`prototype` plus getter/setter variants; `safeJSONParse` throws on any forbidden key. Defense-in-depth only; kept as-is. |

Remaining carryovers (SEC-01 CSP `unsafe-inline`, BUG-4 EUC-KR detection, CR-15
ReDoS, PERF-02 optimizer complexity, TE-37-01/02) stay intentionally deferred:
each needs a dedicated cycle, an added dependency, or benchmarking, per the plan.

No code fixes were required for the cycle-42 findings — all were already closed
by later commits. This cycle only added the two explicit NaN regression tests.
