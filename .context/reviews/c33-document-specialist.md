# Cycle 33 Document Specialist Review — CherryPicker

**Agent:** c33-document-specialist  
**Date:** 2026-05-06  
**Status:** Agent spawn failed; review performed by orchestrator

---

## Finding 1: README card count uses dynamic `totalCards+` but claims are still stale in other places [LOW / High confidence]

**File:** `README.md`

**Problem:** Previous cycle (C32) fixed README claims. Re-verified: card count is now dynamic via `build-stats.ts`. TypeScript version claim was corrected to 5.9. AI classification text updated.

**Result:** FIXED in C32.

---

## Finding 2: Comment in `reward.ts` about `excludeOnline` references C32-F2 but schema docs may be stale [LOW / Medium confidence]

**File:** `packages/core/src/calculator/reward.ts:40`

**Problem:** Comment says "excludeOnline removed — no parser populates isOnline (C32-F2)". Need to verify rule schema docs don't still mention `excludeOnline`.

**Verification:** The `CategorizedTransaction` interface in `packages/core/src/models/transaction.ts` no longer has `isOnline`. The `RewardRule` schema in `@cherrypicker/rules` should be checked for `excludeOnline`.

**Suggested action:** Search for any remaining `excludeOnline` references in schema files.

**Confidence:** Medium

---

## Finding 3: Inline code comments are generally accurate and well-maintained [VERIFIED / High confidence]

The codebase has extensive inline comments referencing cycle IDs (e.g., C32-F1, C81-01). This creates a strong audit trail. Comments accurately describe the code they annotate.

**Confidence:** High

---

## Final Sweep

- No stale TODO/FIXME comments in production code (only Layout.astro CSP TODO, which is tracked).
- Function signatures match their documentation.
- Error messages are accurate and actionable.
