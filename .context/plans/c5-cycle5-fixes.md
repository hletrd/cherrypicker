# Cycle 5 Implementation Plan

**Date:** 2026-04-24 (updated)
**Based on:** `.context/reviews/_aggregate.md` (cycle 5 re-review)

---

## Task 1: Add NaN guard to SpendingSummary prevLabel computation (C5-01, prior cycle)

- **Finding:** C5-01 (LOW/MEDIUM)
- **File:** `apps/web/src/components/dashboard/SpendingSummary.svelte:119`
- **Current behavior:** The template expression uses `parseInt(latestMonth.month.slice(5, 7) ?? '0', 10)` to compute month difference. If a malformed `month` field (shorter than 7 chars) is present, `slice(5, 7)` returns `''`, and `parseInt('', 10)` returns `NaN`. The `?? '0'` nullish coalescing doesn't help because `''` is not nullish. This causes `Math.abs(NaN - NaN) = NaN`, which fails the `<= 1` check, producing the wrong label.
- **Fix:** Extract the month parsing into a local variable with a `Number.isFinite` guard, falling back to a sensible default:
  ```svelte
  {@const m1 = parseInt(latestMonth.month.slice(5, 7), 10)}
  {@const m2 = parseInt(prevMonth.month.slice(5, 7), 10)}
  {@const prevLabel = (Number.isFinite(m1) && Number.isFinite(m2) && Math.abs(m1 - m2) <= 1) ? '전월실적' : '이전 달 실적'}
  ```
- **Risk:** Very low -- this is a display-only label that defaults to a reasonable value even with corrupted data.
- **Status:** DONE (fixed in prior cycle 5 run)

---

## Task 2: Migrate Astro page `import.meta.env.BASE_URL` to `buildPageUrl()` [MEDIUM]

- **Finding:** C5-01 (6-agent convergence: code-reviewer, architect, designer, verifier, tracer, critic)
- **Files:**
  - `apps/web/src/pages/dashboard.astro` (lines 15, 39, 113 — 3 occurrences)
  - `apps/web/src/pages/results.astro` (lines 12, 36, 89, 108, 117 — 5 occurrences)
  - `apps/web/src/pages/report.astro` (lines 13, 44 — 2 occurrences)
- **Current behavior:** All 3 Astro page templates use raw `import.meta.env.BASE_URL` concatenation in href attributes (e.g., `${import.meta.env.BASE_URL}dashboard`). This bypasses the `buildPageUrl()` helper that handles trailing-slash edge cases. If BASE_URL lacks a trailing slash, these links produce malformed URLs like `/cherrypickerdashboard` instead of `/cherrypicker/dashboard`.
- **Fix:** In each Astro page's frontmatter section, import `buildPageUrl` and create URL constants. Replace all raw template-literal BASE_URL concatenation with the constants.
- **Steps:**
  1. `dashboard.astro`: Add `import { buildPageUrl } from '../lib/formatters.js';` in frontmatter, create `const homeUrl = buildPageUrl('');`, `const resultsUrl = buildPageUrl('results');`, replace 3 raw BASE_URL hrefs.
  2. `results.astro`: Add same import, create `const homeUrl = buildPageUrl('');`, `const dashboardUrl = buildPageUrl('dashboard');`, `const reportUrl = buildPageUrl('report');`, replace 5 raw BASE_URL hrefs.
  3. `report.astro`: Add same import, create `const homeUrl = buildPageUrl('');`, `const resultsUrl = buildPageUrl('results');`, replace 2 raw BASE_URL hrefs.
- **Verification:** Grep for `import.meta.env.BASE_URL` in `.astro` page files (not Layout.astro) should return 0 matches. Run `npm run typecheck` and `npm run lint`.
- **Status:** PENDING

---

## Deferred Items (new from this cycle)

### C5-02: Results page stat elements populated by DOM manipulation instead of reactive binding
- **Severity:** LOW
- **Confidence:** Medium
- **File+line:** `apps/web/src/pages/results.astro:52-60`, `apps/web/src/components/ui/VisibilityToggle.svelte:89-103`
- **Reason for deferral:** Refactoring VisibilityToggle to extract stat population into a dedicated component is a UX architecture change. Current DOM manipulation works correctly. Moving to reactive binding is a quality improvement, not a bug fix.
- **Exit criterion:** When VisibilityToggle is refactored, move stat population into a dedicated ResultsStats component.

### C5-03: VisibilityToggle has dual responsibilities (visibility + stat population)
- **Severity:** LOW
- **Confidence:** High
- **File+line:** `apps/web/src/components/ui/VisibilityToggle.svelte:18-22,76-87`
- **Reason for deferral:** Same as C5-02. The dual responsibility is a code quality concern, not a bug.
- **Exit criterion:** When the results page is refactored, extract stat population into a dedicated component.

### C5-04: No test for Astro page `buildPageUrl` migration
- **Severity:** LOW
- **Confidence:** High
- **File+line:** `apps/web/__tests__/formatters.test.ts` (new or existing)
- **Reason for deferral:** The migration itself is simple and verifiable by grep. A unit test for `buildPageUrl()` would add regression protection but is LOW priority.
- **Exit criterion:** If new raw BASE_URL usage appears in future commits, add a grep-based CI check or ESLint rule.

### C5-05: No test for VisibilityToggle stat population
- **Severity:** LOW
- **Confidence:** Medium
- **File+line:** `apps/web/src/components/ui/VisibilityToggle.svelte:89-103`
- **Reason for deferral:** Depends on C5-02/C5-03 being resolved first.
- **Exit criterion:** When C5-02/C5-03 are resolved, add Playwright test for results page stats.

---

## Prior deferred items (carried forward, no changes)

All deferred items from `.context/plans/00-deferred-items.md` remain unchanged.
