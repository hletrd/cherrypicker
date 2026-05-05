# Cycle 4 Implementation Plan

**Date:** 2026-04-20
**Based on:** `.context/reviews/2026-04-20-cycle4-comprehensive.md`

---

## Task 1: Fix misleading log message in `build-stats.ts` catch block

- **Finding:** C4-01 (LOW/HIGH)
- **File:** `apps/web/src/lib/build-stats.ts:25-30`
- **Current behavior:** The `catch (err)` block logs "cards.json not found at build time" for all non-SyntaxError errors, even when the actual error is a permission issue, path issue, etc.
- **Fix:** Change the else-branch message to a more accurate generic message like "could not read cards.json at build time" or include the actual error type.
- **Risk:** None -- this is a build-time log message only, not user-facing.
- **Status:** DONE

---

## Deferred Items (carried forward, no changes)

All deferred items from `.context/plans/00-deferred-items.md` remain unchanged. No new deferred items this cycle.
