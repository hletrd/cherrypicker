# Cycle 11 — Code Reviewer Findings

**Date:** 2026-05-05
**Reviewer:** code-reviewer (simulated)
**Scope:** Full repository delta since Cycle 10 aggregate

## Summary

Cycle 10 fixes verified as correctly implemented. No CRITICAL or HIGH severity issues found in current HEAD. Two LOW findings remain.

---

## Findings

### C11-CR01 — [LOW] console.warn remains in web-side parsers

**File:** `apps/web/src/lib/parser/csv.ts:876`
**File:** `apps/web/src/lib/parser/pdf.ts:478`

The cycle 10 fix (`4bb4469`) removed `console.warn` from `packages/parser/src/csv/index.ts:101`, but the web-side parser equivalents still emit warnings on adapter failure and PDF structured-parse fallback. These warnings reach the browser console in production builds.

**Impact:** Minor console noise in production; inconsistent with server-side cleanup.

**Fix:** Remove or guard the `console.warn` calls in web-side parsers behind a `import.meta.env.DEV` check, matching the pattern used elsewhere.

**Confidence:** High

---

### C11-CR02 — [LOW] esc() strips backslash but not all HTML-special characters

**File:** `packages/viz/src/report/generator.ts:31-42`

The `esc()` function handles `& < > " ' \` and control characters. The cycle 10 fix removed forward-slash escaping (which was over-escaping). Current implementation is correct for HTML context. No new issue.

**Status:** VERIFIED FIXED (cycle 10)

---

### C11-CR03 — [LOW] CSP unsafe-inline persists in script-src

**File:** `apps/web/src/layouts/Layout.astro:50`

The `<meta>` CSP tag includes `script-src 'self' 'unsafe-inline'`. This was P2-MEDIUM in cycle 10. The TODO comment at line 48 notes a future migration to hash-based CSP. No change since cycle 10.

**Status:** KNOWN DEFERRED (D7-M13)

---

### C11-CR04 — [LOW] parseAmountString Infinity guard verified correct

**File:** `packages/parser/src/csv/shared.ts:161`
**File:** `apps/web/src/lib/parser/csv.ts:149`
**File:** `packages/parser/src/ofx/index.ts:112`
**File:** `apps/web/src/lib/parser/ofx.ts:80`

All amount parsers now use `Number.isFinite(n)` guard before returning parsed values. The `parseAmountString` shared utility and all delegating parsers (CSV, OFX, XLSX, JSON, PDF, HTML) correctly propagate `null` for Infinity/NaN inputs.

**Status:** VERIFIED FIXED (cycle 10)

---

### C11-CR05 — [LOW] aria-busy on upload button verified correct

**File:** `apps/web/src/components/upload/FileDropzone.svelte:588`

The `aria-busy={uploadStatus === 'uploading'}` attribute is present on the upload button. The button also has `disabled={uploadStatus === 'uploading'}`. Implementation is correct per WAI-ARIA.

**Status:** VERIFIED FIXED (cycle 10)

---

## Positive Observations

- The `reoptimize()` function in `store.svelte.ts` now correctly recalculates `monthlyBreakdown` from edited transactions before updating the result (line 598). This addresses the stale-data bug from cycle 11 plans.
- The `persistToStorage` function has a clear size-guard path: attempts full save, falls back to truncated save omitting transactions, returns appropriate metadata.
- The `parsePreviousSpending` function handles the `-0` edge case correctly via `normalized = n === 0 ? 0 : n`.

## Verdict

**COMMENT** — No blocking issues. Two LOW cleanup items (web-side console.warn removal, CSP migration).
