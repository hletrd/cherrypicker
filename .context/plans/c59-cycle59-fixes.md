# Cycle 59 Implementation Plan

**Date:** 2026-04-21
**Source reviews:** `.context/reviews/2026-04-21-cycle59-comprehensive.md`, `.context/reviews/_aggregate.md`

---

## Findings to Address

### C59-03 (LOW, HIGH): `VisibilityToggle.svelte` cleanup function hardcodes Korean text for savings label reset

**File:** `apps/web/src/components/ui/VisibilityToggle.svelte:119`
**Problem:** The cleanup function at line 119 resets `cachedStatSavingsLabel.textContent` to `'예상 절약액'`. This hardcodes a Korean string instead of restoring the original value. If the label element is replaced by Astro View Transition, the cleanup of the old instance could overwrite the new element's text. The `isConnected` guard should prevent this for removed elements, but if `getOrRefreshElement` picks up a new element with the same ID, the cleanup would write the hardcoded value to it.

**Fix:** Store the original textContent of the savings label element on first access and restore it during cleanup:
1. Add a variable `originalSavingsLabelText: string | null = null` alongside the other cached refs
2. When first populating the savings label (around line 101-103), capture `cachedStatSavingsLabel.textContent` into `originalSavingsLabelText` before any modification
3. In the cleanup function (line 119), restore `originalSavingsLabelText ?? '예상 절약액'` instead of the hardcoded string

**Steps:**
1. Update `VisibilityToggle.svelte` to store and restore original savings label text
2. Run all gates to confirm no regressions
3. Commit with message: `fix(web): 🐛 store original savings label text for VisibilityToggle cleanup`

---

### C59-02 (LOW, MEDIUM): `SpendingSummary.svelte` monthDiff calculation uses parseInt without format validation

**File:** `apps/web/src/components/dashboard/SpendingSummary.svelte:124-128`
**Problem:** Lines 124-128 compute `m1`, `m2`, `y1`, `y2` by calling `parseInt(latestMonth.month.slice(5, 7), 10)` and `parseInt(latestMonth.month.slice(0, 4), 10)`. If `month` is not in `YYYY-MM` format (e.g., corrupted data), `parseInt` returns `NaN`. The `Number.isFinite(monthDiff)` guard at line 128 prevents a crash, but the code would still proceed with `NaN` intermediates before reaching that guard.

**Fix:** Add a format validation check before the parseInt calls:
1. Before lines 124-128, verify `month` matches `/^\d{4}-\d{2}$/`
2. If the format is invalid, fall back to "이전 실적" label (same as the `Number.isFinite` fallback)
3. This makes the guard explicit and prevents NaN intermediates

**Steps:**
1. Add regex validation in `SpendingSummary.svelte` before the monthDiff calculation
2. Run all gates to confirm no regressions
3. Commit with message: `fix(web): 🐛 add month format validation before parseInt in SpendingSummary`

---

## Deferred Findings (no action this cycle)

| Finding | Severity | Confidence | Reason for deferral |
|---|---|---|---|
| C59-01 | LOW | HIGH | Extension of C8-05/C4-09 dark mode contrast issue, already deferred across many cycles. Adding dark: variants for gray-toned colors is a visual enhancement, not a bug. |
| C59-04 | LOW | HIGH | O(n) taxonomy scan relates to C33-01 (MEDIUM). Building a trie or Aho-Corasick automaton is a significant refactoring effort disproportionate to LOW severity. |
| C59-05 | LOW | MEDIUM | `toLocaleString('ko-KR')` inconsistency is a latent SSR risk. All modern browsers produce consistent output for ko-KR. Switching to `Intl.NumberFormat` is an enhancement, not a bug fix. |
| C59-06 | LOW | MEDIUM | Bare subcategory IDs intentionally omitted per C49-02. Edge case only affects manually edited categories. No fix needed. |

All prior deferred findings from the aggregate remain deferred. See `.context/reviews/_aggregate.md` for the complete list.

---

## Verification Plan

After implementing fixes:
1. Run `npx tsc -p apps/web/tsconfig.json --noEmit` -- expect 0 errors
2. Run `npx vitest run` -- expect all pass
3. Run `bun test` in packages/parser -- expect all pass
