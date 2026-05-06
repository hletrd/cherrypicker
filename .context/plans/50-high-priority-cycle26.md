# Cycle 26 Implementation Plan — High Priority

**Date:** 2026-05-06
**Source reviews:** `.context/reviews/c26-aggregate.md`, `.context/reviews/c26-{code-reviewer,debugger,verifier,test-engineer,architect,critic}.md`
**Status:** COMPLETED

---

## Task 1: Remove redundant branch in reward calculator [C26-COR01] — MEDIUM ✅

- **Files:** `packages/core/src/calculator/reward.ts:260-272`
- **Change:** Merged the `if (rate && fixed)` and `else if (rate)` branches into a single `if (rate)` branch. Updated comment to accurately describe that rate takes precedence and fixedAmount is ignored when both are present.
- **Commit:** `a05c374` fix(core): 🐛 remove redundant rate+fixed branch in reward calculator (C26-COR01)

---

## Task 2: Align JSON parser negative-amount handling with other parsers [C26-COR02] — MEDIUM ✅

- **Files:** `packages/parser/src/json/index.ts:115`, `apps/web/src/lib/parser/json.ts:100`
- **Change:** Changed `if (amount === 0)` to `if (amount <= 0)` in BOTH server-side and web-side JSON parsers. Updated comments. Updated server-side and web-side tests to expect the new behavior.
- **Commits:**
  - `24516ee` fix(parser): 🐛 align JSON parser negative-amount handling with other parsers (C26-COR02)
  - `ef92be8` fix(web): 🐛 align web-side JSON parser with server-side negative-amount handling (C26-COR02)

---

## Task 3: Add web-side OFX parser parity tests [C26-TEST01a] — MEDIUM

- **Status:** NOT NEEDED — Review finding was incorrect. Web-side OFX tests already exist at `apps/web/__tests__/parser-ofx.test.ts` (added 2026-05-06, covers SGML, XML, CCSTMTRS, error handling, bank detection).

---

## Task 4: Add web-side JSON parser parity tests [C26-TEST01b] — MEDIUM

- **Status:** NOT NEEDED — Review finding was incorrect. Web-side JSON tests already exist at `apps/web/__tests__/parser-json.test.ts` (added 2026-05-06, covers arrays, wrappers, aliases, errors, date formats).

---

## Task 5: Replace unsafe non-null assertion in analyzer [C26-COR03] — LOW ✅

- **Files:** `apps/web/src/lib/analyzer.ts:367-368`
- **Change:** Replaced `monthlySpending.get(previousMonth)!` with `monthlySpending.get(previousMonth) ?? 0`.
- **Commit:** `94433e2` fix(web): 🐛 replace unsafe assertions in analyzer and PDF fallback (C26-COR03/COR04)

---

## Task 6: Fix fragile regex capture group in web PDF fallback [C26-COR04] — LOW ✅

- **Files:** `apps/web/src/lib/parser/pdf.ts:626`
- **Change:** Replaced `dateMatch[1]!` with `dateMatch[0]`.
- **Commit:** `94433e2` fix(web): 🐛 replace unsafe assertions in analyzer and PDF fallback (C26-COR03/COR04)

---

## Task 7: Add combined rate+fixed calculator test [C26-TEST02] — LOW ✅

- **Files:** `packages/core/__tests__/calculator.test.ts`
- **Change:** Added `combinedRateFixedFixture` and a test verifying that rate takes precedence over fixedAmount when both are present on the same tier.
- **Commit:** `2dc13e0` test(core): ✅ add combined rate+fixed reward calculator test (C26-TEST02)

---

## Deferred Items

| Finding | Severity | Confidence | Reason for deferral | Exit criterion |
|---------|----------|------------|---------------------|----------------|
| C26-ARCH01 | LOW | High | Parser duplication is A-ARCH-01 carry-over. Requires shared module with Buffer/TextEncoder abstraction. | A-ARCH-01 shared module is implemented |
| C25-PERF01 | LOW | High | Greedy optimizer double calculation requires architectural change (incremental rewards or caching). Complexity outweighs benefit for typical statement sizes. | User reports slow optimization on statements > 1000 transactions |
| C25-TEST03 | LOW | Medium | Store unit test requires complex mocking of Svelte runes and async dependencies. No store test file exists. | `store.svelte.ts` has testable exports or dedicated test file |

---

## Gate Results

- `npm run lint`: PASS (0 errors, 0 warnings)
- `npm run typecheck`: PASS (0 errors)
- `bun run test`: PASS (11/11 packages green, 1827 tests total)

## Commits

1. `a05c374` fix(core): 🐛 remove redundant rate+fixed branch in reward calculator (C26-COR01)
2. `24516ee` fix(parser): 🐛 align JSON parser negative-amount handling with other parsers (C26-COR02)
3. `94433e2` fix(web): 🐛 replace unsafe assertions in analyzer and PDF fallback (C26-COR03/COR04)
4. `ef92be8` fix(web): 🐛 align web-side JSON parser with server-side negative-amount handling (C26-COR02)
5. `2dc13e0` test(core): ✅ add combined rate+fixed reward calculator test (C26-TEST02)
