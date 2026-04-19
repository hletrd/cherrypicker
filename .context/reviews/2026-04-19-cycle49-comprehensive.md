# Comprehensive Code Review -- Cycle 49

**Date:** 2026-04-19
**Reviewer:** Multi-angle comprehensive review (cycle 49)
**Scope:** Full repository -- all packages, apps, and shared code
**Angles covered:** code quality, correctness, performance, security, UI/UX, architecture, test coverage, type safety

---

## Methodology

Read every source file in the repository (40+ source files across packages/core, packages/parser, packages/rules, packages/viz, tools/cli, tools/scraper, apps/web). Cross-referenced with prior cycle 1-48 reviews and deferred items. Ran `bun test` (266 pass, 0 fail), `tsc --noEmit` per package, and `bun run build`. Focused on finding genuinely NEW issues not previously reported.

---

## Verification of Prior Findings

All prior cycle 47-48 findings (C47-L01, C47-L02) are confirmed fixed. Deferred items (D-106, D-107, D-110) remain deferred with documented rationale.

---

## New Findings

### C49-M01: TypeScript build error -- `parsed` variable used before being assigned in `llm-fallback.ts`

- **Severity:** MEDIUM (build-breaking)
- **Confidence:** High
- **File+line:** `packages/parser/src/pdf/llm-fallback.ts:111`
- **Description:** The `llm-fallback.ts` file has a TypeScript error at line 111: `Variable 'parsed' is used before being assigned`. The variable `parsed` is declared with `let parsed: LLMTransaction[];` at line 84, assigned inside a `try` block at line 86 (`parsed = JSON.parse(jsonMatch[0]);`), and then used at line 111 in the `.filter()` call. TypeScript cannot guarantee that the `try` block's assignment succeeded before reaching line 111, especially since the `catch` block (lines 87-108) has a complex fallback loop that assigns `parsed` conditionally inside a `while` loop with a `parsedOk` flag, but TypeScript doesn't track the `parsedOk` control flow.
- **Concrete failure scenario:** Running `bun run build` or `tsc --noEmit` in `packages/parser` fails with TS2454. This blocks the monorepo build.
- **Fix:** Initialize `parsed` with a default value: `let parsed: LLMTransaction[] = [];`, or restructure the control flow so TypeScript can verify assignment before use. The simplest and safest fix is to add `= []` to the declaration, since the subsequent `.filter()` call on an empty array is a no-op, and the `if (!parsedOk)` throw at line 106-108 ensures the code never reaches line 111 with invalid data.
- **Evidence:** `tsc --noEmit` in `packages/parser` produces `src/pdf/llm-fallback.ts(111,10): error TS2454`. `bun run build` fails with `@cherrypicker/parser#build` error.

### C49-L01: `scoreCardsForTransaction` rate calculation divides by `tx.amount` without checking for zero

- **Severity:** LOW (defensive coding)
- **Confidence:** High
- **File+line:** `packages/core/src/optimizer/greedy.ts:131`
- **Description:** In `scoreCardsForTransaction`, the rate is calculated as `rate = transaction.amount > 0 ? reward / transaction.amount : 0`. The `> 0` guard correctly prevents division by zero for positive amounts. However, transactions with `amount === 0` get `rate = 0`, which means a card that gives 0 reward on a 0-amount transaction has the same rate as a card that gives positive reward on a positive-amount transaction. The `filter((tx) => tx.amount > 0)` in `greedyOptimize` at line 266 already filters out zero-amount transactions before scoring, so this path is unreachable in practice. However, `calculateCardOutput` is called with the transaction added (line 129), so if `scoreCardsForTransaction` were ever called with a zero-amount transaction from a different code path, the rate would be misleading (0% instead of undefined/NaN).
- **Concrete failure scenario:** Unreachable with current code flow. If a future caller passes zero-amount transactions, the rate would be 0, which is technically correct but could mask a data issue.
- **Fix:** No action needed for current codebase. The guard is sufficient for the actual usage.

---

## Final Sweep -- Cross-File Interactions

1. **All `formatWon` implementations are consistent** -- all 4 implementations have `Number.isFinite` guards and negative-zero normalization. (Previously verified in C48.)

2. **All `formatRate` implementations are consistent** -- all 5 implementations have `Number.isFinite` guards. (Previously verified in C48.)

3. **TypeScript build error in `llm-fallback.ts` is the only gate failure.** The apps/web `tsc --noEmit` errors are in test files (`__tests__/analyzer-adapter.test.ts`, `__tests__/parser-date.test.ts`) that reference `bun:test` which is not recognized by `tsc`. These are pre-existing test infrastructure issues, not new code errors. The actual application code in apps/web typechecks correctly.

4. **Reward calculation consistency** -- `calculateDiscount`, `calculatePoints`, `calculateCashback` all delegate to `calculatePercentageReward`. The `getCalcFn` function in `reward.ts` correctly maps all four types. Mileage uses the points calculator (Won-equivalent). No divergence.

5. **`buildCategoryKey` export** -- `packages/core/src/index.ts:18` exports `buildCategoryKey` (D-102 is fixed).

6. **SessionStorage validation** -- `isValidTx` checks `Number.isFinite(tx.amount) && tx.amount > 0` (D-99 is fixed).

7. **Web-side vs server-side parser consistency** -- Both have identical date validation (month 1-12, day 1-31), encoding detection (utf-8, euc-kr, cp949 with replacement-character ratio), and amount parsing. The only remaining inconsistency is D-106 (bare `catch {}` in web PDF parser).

8. **No new security issues found.** LLM fallback is server-side only with browser guard, API key from env, 30-second timeout, text truncation. No secrets in code.

9. **No new performance issues found.** All previously identified performance concerns (D-09/D-51/D-86/D-100) remain deferred and are acceptable at current scale.

10. **No new UI/UX issues found.** CategoryBreakdown colors, SavingsComparison animation, FileDropzone validation all previously reviewed and deferred items documented.

---

## Summary of Active Findings

| ID | Severity | Confidence | File | Description | Status |
|---|---|---|---|---|---|
| C49-M01 | MEDIUM | High | `packages/parser/src/pdf/llm-fallback.ts:84,111` | TS2454: `parsed` used before assigned -- breaks build | NEW |
| C49-L01 | LOW | High | `packages/core/src/optimizer/greedy.ts:131` | Rate calculation for zero-amount transactions is 0, but unreachable | NOTED (no action) |
