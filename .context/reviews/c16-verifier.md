# Cycle 16 — Verifier Review

**Date:** 2026-05-06
**Scope:** Evidence-based correctness checking

## Findings

### C16-VER01 [MEDIUM] — `isOptimizableTx` comment contradicts code behavior
- **File:** `apps/web/src/lib/store.svelte.ts:195-199` and `:209`
- **Claim:** Comment says "Zero-amount entries (e.g., balance inquiries, declined transactions) are excluded."
- **Actual behavior:** Code at line 209 uses `obj.amount > 0`, which excludes BOTH zero amounts AND negative amounts (refunds/credits).
- **Discrepancy:** The comment does not mention negative amounts, and the function name `isOptimizableTx` implies filtering for optimization suitability — but the caller `loadFromStorage` uses it to filter restored transactions for DISPLAY. Refunds are displayable even if not optimizable.
- **Fix:** Update the comment to mention negative amounts, or change the filter to `amount !== 0` if the intent is to include refunds in display.
- **Confidence:** High

### C16-VER02 [LOW] — `isValidAmount` comment claims negative amounts are accepted, but function returns false for zero
- **File:** `apps/web/src/lib/parser/csv.ts:176-178` and `packages/parser/src/csv/shared.ts`
- **Claim:** Comment says "Skip zero-amount rows (balance inquiries) but accept negative amounts (refunds/credits) by letting callers take absolute value."
- **Actual behavior:** The function returns `false` for `amount === 0` and returns `true` for all non-zero amounts including negatives. The comment is technically correct about negatives but the parenthetical "by letting callers take absolute value" is misleading — callers do not take absolute value; they preserve the negative sign.
- **Fix:** Update comment to clarify that negative amounts are preserved as-is (not converted to absolute value) and filtered later by the optimizer.
- **Confidence:** Medium

### C16-VER03 [LOW] — JSON parser parity verified: both sides preserve negative amounts
- **File:** `apps/web/src/lib/parser/json.ts:98-100` and `packages/parser/src/json/index.ts:113-115`
- **Verification:** Both web-side and server-side JSON parsers correctly preserve negative amounts (only filtering zero amounts). This parity was fixed in C99/C100.
- **Status:** Verified correct.

## Summary
One MEDIUM finding (comment/code mismatch in isOptimizableTx) and two LOW findings.
