# Comprehensive Code Review -- Cycle 53

**Date:** 2026-04-20
**Reviewer:** Single-agent comprehensive review (cycle 2 of review-plan-fix loop)
**Scope:** Full repository -- all packages, apps, and shared code
**Angles covered:** code quality, correctness, performance, security, UI/UX, architecture, test coverage

---

## Methodology

Read every source file in the repository (40+ source files across packages/core, packages/parser, packages/rules, packages/viz, tools/cli, tools/scraper, apps/web). Cross-referenced with prior cycle 1-52 reviews and the aggregate. Ran `bun test` (266 pass, 0 fail), `bun run lint` (0 errors), `bun run typecheck` (0 errors), and `bun run build` (success). Focused on finding genuinely NEW issues not previously reported.

---

## Verification of Prior "Still-Open" Deferred Findings

All deferred findings from the aggregate (`.context/reviews/_aggregate.md`) are confirmed still present:

| Finding | Status | Notes |
|---|---|---|
| D-106 | STILL DEFERRED | `apps/web/src/lib/parser/pdf.ts:284` bare `catch {}` -- the catch in `tryStructuredParse` swallows all errors silently |
| D-107 | NOW FIXED | Web-side CSV adapter error collection -- `apps/web/src/lib/parser/csv.ts:966-974` now collects errors into `fallbackResult.errors.unshift()` |
| D-110 | STILL DEFERRED | Non-latest month edits have no visible optimization effect |
| C4-06/C52-03 | STILL DEFERRED | Annual savings projection label unchanged in SavingsComparison |
| C4-07/C52-06 | NOW FIXED | `SpendingSummary.svelte:10,128` now uses `sessionStorage` for the dismissal flag |
| C4-09/C52-05 | STILL DEFERRED | Hardcoded `CATEGORY_COLORS` in CategoryBreakdown (dark mode contrast) |
| C4-10 | STILL DEFERRED | E2E test stale dist/ dependency |
| C4-11 | STILL DEFERRED | No regression test for findCategory fuzzy match |
| C4-13 | STILL DEFERRED | Small-percentage bars nearly invisible |
| C4-14/C52-04 | STILL DEFERRED | Stale fallback values in Layout footer and index.astro |
| C9-02/C52-03 | STILL DEFERRED | Redundant comparison UI when savings=0 |
| C9-04 | STILL DEFERRED | Complex fallback date regex in PDF parser |
| C9-06 | STILL DEFERRED | Percentage rounding can shift "other" threshold |
| C9-07 | STILL DEFERRED | Math.max spread stack overflow risk (theoretical) |
| C9-08 | STILL DEFERRED | Comparison bars misleading when both rewards are 0 |
| C9-09 | STILL DEFERRED | Categories cache never invalidated |
| C9-10 | STILL DEFERRED | HTML-as-XLS double-decode and unnecessary re-encode |
| C9-12 | STILL DEFERRED | Module-level cache persists across store resets |
| C52-02 | NOW FIXED | `TransactionReview.svelte:108-130` now uses `updatedTxs.map()` to replace entries instead of mutating in-place |

---

## New Findings

### C53-01: `TransactionReview.svelte` `changeCategory` still mutates editedTxs entries in-place (MEDIUM, HIGH)

**File:** `apps/web/src/components/dashboard/TransactionReview.svelte:187-205`
**Description:** While the `runAICategorization` function was fixed (C52-02) to replace entries instead of mutating in-place, the `changeCategory` function still directly mutates the found `tx` object's properties (`tx.category`, `tx.subcategory`, `tx.confidence`). This is the same fragile pattern that was fixed in `runAICategorization` -- Svelte 5's proxy-based reactivity should detect these mutations, but the pattern is inconsistent and fragile.
**Failure scenario:** User manually changes a category via the dropdown. The category value updates in the object but Svelte 5's reactivity system may not trigger a re-render if the deep property write is not properly tracked by the proxy.
**Fix:** Use the same replacement pattern as `runAICategorization`:
```ts
function changeCategory(txId: string, newCategory: string) {
  const idx = editedTxs.findIndex(t => t.id === txId);
  if (idx !== -1) {
    const tx = editedTxs[idx];
    if (tx) {
      const parentCategory = subcategoryToParent.get(newCategory);
      let updated: CategorizedTx;
      if (parentCategory) {
        const subId = newCategory.includes('.') ? newCategory.split('.')[1] ?? newCategory : newCategory;
        updated = { ...tx, category: parentCategory, subcategory: subId, confidence: 1.0 };
      } else {
        updated = { ...tx, category: newCategory, subcategory: undefined, confidence: 1.0 };
      }
      editedTxs = editedTxs.map((t, i) => i === idx ? updated : t);
      hasEdits = true;
    }
  }
}
```

### C53-02: `index.astro` duplicates card stats reading logic from `Layout.astro` (LOW, MEDIUM)

**File:** `apps/web/src/pages/index.astro:7-16` and `apps/web/src/layouts/Layout.astro:14-24`
**Description:** Both files independently read `cards.json` at build time with identical try/catch fallback logic. The fallback values (683, 24, 45) are duplicated in two places. If `cards.json` is updated, both files need to stay in sync, but there is no shared module to enforce this.
**Failure scenario:** A developer updates the fallback values in `Layout.astro` but forgets to update `index.astro`, resulting in different stats shown on the home page vs the footer.
**Fix:** Extract the card stats reading logic into a shared Astro module (e.g., `apps/web/src/lib/build-stats.ts`) and import it in both places. Or compute it once in Layout and pass it as a prop.

### C53-03: `CardDetail.svelte` performance tier header row uses hardcoded `text-blue-700` not respecting dark mode (LOW, MEDIUM)

**File:** `apps/web/src/components/cards/CardDetail.svelte:222`
**Description:** The performance tier header row in the rewards table uses `text-blue-700` without a dark mode variant. In dark mode, `text-blue-700` may have insufficient contrast against the `bg-[var(--color-primary-light)]` background (which is `#1e3a5f` in dark mode).
**Failure scenario:** In dark mode, the performance tier label (e.g., "tier0") appears as dark blue text on a dark blue background, making it hard to read.
**Fix:** Add `dark:text-blue-300` or `dark:text-blue-400` to the class.

---

## Cross-File Consistency Checks

1. **All `formatWon` implementations (4 locations):** All have `Number.isFinite` guard + negative-zero normalization. Consistent.

2. **All `formatRate` implementations (5 locations):** All have `Number.isFinite` guard. Consistent.

3. **`parseDateToISO` implementations (6 locations):** All have month/day range validation. Consistent.

4. **`inferYear` implementations (5 locations):** All use the same 90-day look-back heuristic. Consistent.

5. **Web-side CSV error collection (D-107/C52-01):** Now FIXED -- `apps/web/src/lib/parser/csv.ts:966-974` collects adapter failures into `fallbackResult.errors.unshift()`. The signature-detection catch block (lines 978-998) also collects errors. Consistent with server-side.

6. **SessionStorage consistency (C4-07/C52-06):** Now FIXED -- `SpendingSummary.svelte` uses `sessionStorage` for the dismissal flag (line 10 and line 128), matching the store's use of `sessionStorage`. Consistent.

7. **`TransactionReview.svelte` in-place mutation (C52-02 vs C53-01):** The `runAICategorization` function was fixed to use replacement pattern, but `changeCategory` still uses in-place mutation. Inconsistent.

---

## Final Sweep

- No new security issues beyond what is already tracked (CSP with `unsafe-inline` is documented with a TODO for nonce-based migration).
- No new performance issues detected. The greedy optimizer's O(n*m) scoring is adequate.
- No new type safety issues. All gates pass.
- The `categorizer-ai.ts` file is intentionally disabled (AI categorization disabled until self-hosted runtime is ready).
- The ILP optimizer stub (`packages/core/src/optimizer/ilp.ts`) is still a pass-through to greedy, documented with a TODO.
- No new test coverage gaps beyond C4-10 and C4-11 (already deferred).

---

## Summary

1 genuinely new finding this cycle (C53-01: `changeCategory` still mutates in-place, inconsistent with the fix for C52-02). 2 low-severity new findings (C53-02: duplicated stats reading, C53-03: dark mode contrast on performance tier header). 2 previously open findings are now confirmed FIXED (D-107/C52-01, C4-07/C52-06). 1 previously open finding is now confirmed FIXED (C52-02 was fixed but the same pattern persists in `changeCategory`, tracked as C53-01). All gates green. Codebase is stable.
