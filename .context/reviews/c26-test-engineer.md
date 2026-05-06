# Cycle 26 — Test Engineer Findings

**Date:** 2026-05-06
**Scope:** Test coverage gaps, parity tests, edge cases
**Method:** Inventory of test files vs source files, gap analysis

---

## C26-TEST01 — Missing web-side parity tests for OFX and JSON parsers (MEDIUM)

**File:** `apps/web/__tests__/` (directory)
**Confidence:** High

The web-side parser tests (`apps/web/__tests__/`) cover:
- `parser-html.test.ts` — HTML parser (including normalizeHTML)
- `parser-detect-parity.test.ts` — Bank detection parity
- `web-detect-parity.test.ts` — Additional detection tests

But there are NO web-side tests for:
- OFX parser (`apps/web/src/lib/parser/ofx.ts`)
- JSON parser (`apps/web/src/lib/parser/json.ts`)

The server-side has comprehensive tests:
- `packages/parser/__tests__/ofx.test.ts` — 24+ test cases
- `packages/parser/__tests__/parse-error.test.ts` — includes JSON error cases

The web-side OFX and JSON parsers were added in C98/C99 but parity tests were never created. This is the same class of gap that led to C25-COR01 (server HTML parser missing forward-fill reset) — web/server behavioral drift.

**Impact:** Web-side OFX/JSON parsers could silently diverge from server-side behavior. Edge cases fixed on the server (e.g., timezone handling, amount parsing) may not be present on the web.

**Fix:** Create `apps/web/__tests__/parser-ofx-parity.test.ts` and `apps/web/__tests__/parser-json-parity.test.ts` with tests covering:
- Basic OFX 1.x (SGML) and 2.x (XML) parsing
- JSON array parsing and wrapper object parsing
- Error handling (malformed input)
- Amount/date parsing edge cases

---

## C26-TEST02 — Missing test for reward calculator combined rate+fixed branch (LOW)

**File:** `packages/core/__tests__/calculator.test.ts`
**Confidence:** Medium

The reward calculator at `packages/core/src/calculator/reward.ts:260-267` has a branch for when both `rate` and `fixedAmount` are present on the same tier. This branch is currently unreachable in practice (Korean card rules don't combine them), but there is no test verifying the behavior if they ever do.

**Impact:** If a card rule is added with combined rate+fixed, the calculator behavior is untested.

**Fix:** Add a test case for a rule with both `rate: 1.0` and `fixedAmount: 500` on the same tier, verifying which reward is applied.

---

## C26-TEST03 — Missing reoptimize metadata consistency test (carry-over from C25-TEST03)

**File:** `apps/web/src/lib/store.svelte.ts:569-593`
**Confidence:** Medium

Cycle 25 fixed the stale metadata issue (C25-COR02) by recomputing `transactionCount`, `totalTransactionCount`, `statementPeriod`, and `fullStatementPeriod` from `editedTransactions`. However, there is still no test verifying this behavior.

**Impact:** Regression risk. A future refactor could accidentally revert to using stale snapshot data.

**Fix:** Add a store test or analyzer test that verifies recompute metadata after editing transactions with different counts and date ranges.

---

## Summary

| Severity | Count | Categories |
|----------|-------|------------|
| MEDIUM | 1 | coverage gap |
| LOW | 2 | coverage gap |

**Verdict:** FIX AND SHIP — The OFX/JSON web parity gap is the highest priority.
