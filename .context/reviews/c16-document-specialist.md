# Cycle 16 — Document-Specialist Review

**Date:** 2026-05-06
**Scope:** Doc/code mismatches

## Findings

### C16-DOC01 [MEDIUM] — `isOptimizableTx` comment does not match code behavior
- **File:** `apps/web/src/lib/store.svelte.ts:195-199`
- **Documentation:** "Zero-amount entries (e.g., balance inquiries, declined transactions) are excluded."
- **Code:** Line 209: `obj.amount > 0` — excludes BOTH zero AND negative amounts.
- **Mismatch:** The comment does not mention negative amounts, but they are excluded.
- **Fix:** Update comment to: "Zero-amount and negative-amount entries are excluded. Zero amounts (balance inquiries) don't contribute to optimization. Negative amounts (refunds) are handled by..." — or change the code to match the comment.
- **Confidence:** High

### C16-DOC02 [LOW] — `isValidAmount` comment mentions absolute value but code preserves negative
- **File:** `apps/web/src/lib/parser/csv.ts:176-178`
- **Documentation:** "accept negative amounts (refunds/credits) by letting callers take absolute value"
- **Code:** Callers do NOT take absolute value. The negative sign is preserved through to the optimizer which filters at its own layer.
- **Fix:** Update comment to remove the absolute value mention.
- **Confidence:** Medium

### C16-DOC03 [LOW] — `build-stats.ts` comment claims "fallback" but values may be stale
- **File:** `apps/web/src/lib/build-stats.ts:15-16`
- **Documentation:** "Returns fallback values if the file is unavailable."
- **Reality:** The fallback values (683, 24, 45) are hardcoded and will become stale over time.
- **Fix:** Add a build-time verification or generate from cards.json.
- **Confidence:** Low

## Summary
One MEDIUM and two LOW doc/code mismatches.
