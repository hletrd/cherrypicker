# Cycle 10 Implementation Plan

**Date:** 2026-04-24
**Based on:** `.context/reviews/c10-aggregate.md` (cycle 10 multi-agent review)

---

## Task 1: Add unit tests for `formatSavingsValue` helper [LOW]

- **Finding:** C10-01 (test-engineer C10-TE01)
- **File:** `apps/web/src/lib/formatters.ts:224-227`
- **Current behavior:** The `formatSavingsValue` helper centralizes sign-prefix logic across SavingsComparison, VisibilityToggle, and ReportContent, but has no dedicated unit tests.
- **Fix:** Add unit tests covering:
  - Positive value >= 100 (shows '+' prefix)
  - Positive value < 100 (no '+' prefix)
  - Zero value (no '+' prefix)
  - Negative value (uses Math.abs, no redundant '-')
  - `prefixValue` parameter override (prefix decision based on prefixValue, not value)
  - Boundary at exactly 99 and 100
- **Steps:**
  1. Add test cases to `apps/web/__tests__/formatters.test.ts` (or create if needed)
  2. Verify `bun run test` passes
- **Verification:** `bun run test`, `npm run typecheck`, `npm run lint`
- **Status:** DONE

---

## Task 2: Add C10-01 to deferred test coverage items [LOW — DEFERRED]

- **Finding:** C10-01 (same as Task 1)
- **Description:** The `formatSavingsValue` test gap is LOW severity. The function works correctly in production (used by 3 components that are all tested via E2E). Adding unit tests is valuable but not blocking.
- **Reason for deferral:** Test coverage gap. The function's behavior is straightforward and covered by E2E tests. Adding unit tests is a quality improvement.
- **Exit criterion:** When a dedicated test coverage improvement cycle is scheduled (same as C9-08/C9-09).

---

## Task 3: Refresh deferred-items ledger with cycle 10 section [DOCUMENTATION]

- **File:** `.context/plans/00-deferred-items.md`
- **Change:** Append "Cycle 10 resolutions and status re-affirmation" section.
- **Commit:** `docs(plans): 📝 cycle 10 multi-agent reviews, aggregate, plan, and deferred-items refresh`
- **Status:** PENDING

---

## Prior deferred items (carried forward, no changes)

All deferred items from `.context/plans/00-deferred-items.md` remain unchanged, including:
- C7-01 (CATEGORY_NAMES_KO drift) — MEDIUM
- C7-02 (FALLBACK_CATEGORY_LABELS drift) — LOW
- C7-04 (entertainment.subscription inconsistency) — LOW
- C8-01 (FALLBACK_GROUPS third duplicate) — LOW
- C9-01 through C9-05 (5 more taxonomy/issuer duplicates) — MEDIUM/LOW
- C9-08, C9-09, C9-10 (test coverage gaps, fallback staleness) — LOW
- All D-01 through D-111 items
- All D7-M1 through D7-M14 items
