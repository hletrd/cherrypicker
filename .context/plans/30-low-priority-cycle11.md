# Plan — Low-Priority Fixes (Cycle 11)

**Priority:** LOW
**Findings addressed:** C11-CR03, C11-CR04, C11-CT02, C11-CT03, C11-CT04, C11-TE02, C11-TE04, C11-DS01, C11-UI02, C11-UI04, C11-UI05
**Status:** PENDING

---

## Task 1: Remove web-side console.warn from CSV and PDF parsers

**Finding:** C11-CR03, C11-CR04 — `console.warn` remains in web-side parsers after server-side cleanup in cycle 10.

**Files:**
- `apps/web/src/lib/parser/csv.ts:876`
- `apps/web/src/lib/parser/pdf.ts:478`

**Implementation:**
1. Remove or guard the `console.warn` calls behind `import.meta.env.DEV` check.
2. For PDF fallback warning, replace with a silent fallback or dev-only log.

**Commit:** `fix(web): 🔇 remove production console.warn from web-side CSV and PDF parsers`

---

## Task 2: Add prefers-reduced-motion for upload spinner

**Finding:** C11-UI02, C11-CT03 — Spinner uses `animate-spin` with no reduced-motion alternative.

**File:** `apps/web/src/components/upload/FileDropzone.svelte`

**Implementation:**
1. Add CSS rule to `apps/web/src/app.css` or scoped style:
```css
@media (prefers-reduced-motion: reduce) {
  .animate-spin {
    animation: none;
  }
}
```

**Commit:** `feat(web): ♿ add prefers-reduced-motion for upload spinner`

---

## Task 3: Fix "corrupted" label for quota errors in persistToStorage

**Finding:** C11-CT02 — `persistToStorage` returns `kind: 'corrupted'` for `QuotaExceededError`.

**File:** `apps/web/src/lib/store.svelte.ts:185`

**Implementation:**
1. Change `'corrupted'` to `'quota_exceeded'` in the return value.
2. Update any consumer code that checks for `'corrupted'` kind.

**Commit:** `fix(web): 🐛 use 'quota_exceeded' instead of 'corrupted' for sessionStorage quota errors`

---

## Task 4: Remove stale TODO comment in reward calculator

**Finding:** C11-DS01 — Stale TODO about unimplemented cashback calculation.

**File:** `packages/core/src/calculator/reward.ts:78`

**Implementation:**
1. Remove the TODO comment if the function is fully implemented.

**Commit:** `docs(core): 📝 remove stale TODO comment from reward calculator`

---

## Task 5: Add merchant matcher length guard tests

**Finding:** C11-TE02 — No tests for the `lower.length < 2` guard in MerchantMatcher.

**File:** `packages/core/__tests__/categorizer.test.ts`

**Implementation:**
1. Add test cases for:
   - Empty string merchant → uncategorized, confidence 0
   - Single character merchant → uncategorized, confidence 0
   - Two character merchant → forward match only

**Commit:** `test(core): 🧪 add merchant matcher length guard tests`

---

## Task 6: Add dashboard card region roles

**Finding:** C11-UI05 — Dashboard cards lack `role="region"` + `aria-labelledby`.

**Files:** `apps/web/src/components/dashboard/*.svelte`

**Implementation:**
1. Wrap each dashboard card in `<section role="region" aria-labelledby="title-id">`.
2. Ensure each card has a visible title with a matching `id`.

**Commit:** `feat(web): ♿ add region roles to dashboard cards for screen reader navigation`

---

## Task 7: Fix formatSavingsValue sign stripping

**Finding:** C11-CT04 — `formatSavingsValue` unconditionally strips negative sign.

**File:** `apps/web/src/lib/formatters.ts:226`

**Implementation:**
1. Either rename to `formatSavingsValueAbsolute` or add a parameter to control sign stripping.
2. Update all callers.

**Commit:** `refactor(web): ♻️ clarify formatSavingsValue sign-stripping behavior`

---

## Deferred Findings (Cycle 11)

The following findings are deferred per repo policy and previous cycle decisions:

### D7-M13 — CSP unsafe-inline in script-src
- **Severity:** MEDIUM
- **File:** `apps/web/src/layouts/Layout.astro:50`
- **Reason:** Requires Astro framework-level nonce/hash-based CSP support.
- **Exit criterion:** Astro adds nonce injection for inline scripts, or we migrate to SSG-only with external script files.

### D-01 — Parser duplication (web vs packages)
- **Severity:** HIGH
- **Files:** `apps/web/src/lib/parser/*` vs `packages/parser/src/*`
- **Reason:** Major architectural refactor requiring extraction of shared parser logic into isomorphic modules.
- **Exit criterion:** Create dedicated refactor cycle with design doc, then implement incrementally with dual-path testing.

### D-09 — O(n*m) scoreCardsForTransaction
- **Severity:** LOW
- **File:** `packages/core/src/optimizer/greedy.ts:39-71`
- **Reason:** For typical use cases (< 1000 transactions), performance is acceptable.
- **Exit criterion:** If performance becomes an issue for large statement sets, implement incremental reward tracking.

### D-02 — README license mismatch
- **Severity:** LOW
- **Files:** `README.md:169-171` vs `LICENSE:1-15`
- **Reason:** Requires project owner confirmation of intended license.
- **Exit criterion:** Confirm intended license with project owner, then update README or LICENSE.
