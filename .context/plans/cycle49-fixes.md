# Cycle 49 Implementation Plan

**Date:** 2026-04-19
**Source:** `.context/reviews/2026-04-19-cycle49-comprehensive.md`

---

## Task 1: Fix TypeScript build error -- `parsed` variable used before assigned in `llm-fallback.ts`

- **Finding:** C49-M01
- **Severity:** MEDIUM (build-breaking)
- **Confidence:** High
- **Files:** `packages/parser/src/pdf/llm-fallback.ts:84,111`
- **Description:** The variable `parsed` is declared with `let parsed: LLMTransaction[];` at line 84, assigned inside a `try` block at line 86, and used at line 111. TypeScript cannot verify that the assignment succeeded before line 111 is reached, because the `catch` block has a complex fallback loop that conditionally assigns `parsed` via a `parsedOk` flag that TypeScript doesn't track. This causes `tsc --noEmit` to report TS2454 and `bun run build` to fail for `@cherrypicker/parser`.
- **Fix:** Initialize `parsed` with a default empty array: `let parsed: LLMTransaction[] = [];`. This is safe because:
  1. The subsequent `.filter()` call on an empty array is a no-op (returns empty array).
  2. The `if (!parsedOk)` throw at line 106-108 ensures that if the fallback loop fails, execution never reaches line 111.
  3. The `try` block's `JSON.parse()` always assigns `parsed` before the `.filter()` call.
  The only path where `parsed` could be `[]` at line 111 is if the code somehow bypassed both the `try` and `catch` assignments, which is impossible given the control flow.
- **Verification:** Run `tsc --noEmit` in `packages/parser` and `bun run build` from root. Both should succeed with no errors.
- **Status:** DONE

---

## Deferred Items (Active, carried forward)

No new deferred items. Prior deferred items (D-106, D-107, D-110) remain deferred with documented rationale per `.context/plans/00-deferred-items.md`.
