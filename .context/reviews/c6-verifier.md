# Cycle 6 — Verifier

**Date:** 2026-04-24
**Reviewer:** verifier
**Scope:** Evidence-based correctness check

---

## C6-V01: Layout.astro BASE_URL migration incomplete (confirms C6-CR01)

- **Severity:** MEDIUM
- **Confidence:** High
- **File+line:** `apps/web/src/layouts/Layout.astro:11`
- **Evidence:** Grep for `import.meta.env.BASE_URL` in `apps/web/src/` shows 3 locations:
  1. `Layout.astro:11` — `const base = import.meta.env.BASE_URL` (used 17+ times)
  2. `formatters.ts:238` — inside `buildPageUrl()` itself (correct — this is where the helper lives)
  3. `cards.ts:171` — inside `getBaseUrl()` (used for data fetches only)

  Items 2 and 3 are correct usages. Item 1 is the same pattern that was fixed in the page files.

---

## Final Sweep

Verified gate evidence from cycle 5: lint PASS, typecheck PASS, 197 tests PASS, verify PASS. No regressions detected.
