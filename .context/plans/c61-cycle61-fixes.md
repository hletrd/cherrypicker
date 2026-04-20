# Cycle 61 Implementation Plan

**Date:** 2026-04-21
**Source reviews:** `.context/reviews/2026-04-21-cycle61-comprehensive.md`, `.context/reviews/_aggregate.md`

---

## Findings to Address

### C61-01 (LOW, MEDIUM): `TransactionReview.svelte` $effect sync skips clearing `editedTxs` when store is reset

**File:** `apps/web/src/components/dashboard/TransactionReview.svelte:74-82`
**Problem:** The `$effect` at line 74 syncs `editedTxs` from `analysisStore.transactions` when `analysisStore.generation` changes. The condition `txs.length > 0` at line 77 means that if the store is reset (transactions become empty, generation increments), `editedTxs` is NOT cleared -- it retains stale data from the previous analysis.

**Fix:** Add an `else` branch to clear `editedTxs` when `txs.length === 0` and `gen !== lastSyncedGeneration`:

```ts
$effect(() => {
  const gen = analysisStore.generation;
  const txs = analysisStore.transactions;
  if (txs.length > 0 && gen !== lastSyncedGeneration) {
    editedTxs = txs.map(tx => ({ ...tx }));
    hasEdits = false;
    lastSyncedGeneration = gen;
  } else if (txs.length === 0 && gen !== lastSyncedGeneration) {
    editedTxs = [];
    hasEdits = false;
    lastSyncedGeneration = gen;
  }
});
```

**Steps:**
1. ~~Update `TransactionReview.svelte` to clear `editedTxs` on store reset~~ DONE
2. ~~Run all gates to confirm no regressions~~ DONE (tsc PASS, vitest 189 pass, bun test 57 pass)
3. ~~Commit with message: `fix(dashboard): 🐛 clear edited transactions when store is reset`~~ DONE (commit 0000000f)

---

### C61-02 (LOW, HIGH): `CardPage.svelte` breadcrumb uses inconsistent interactive elements

**File:** `apps/web/src/components/cards/CardPage.svelte:70-73`
**Problem:** The breadcrumb navigation uses `<a>` for "홈" but `<button>` for "카드 목록". Keyboard users interact differently with each item (links respond to Enter, buttons respond to Enter and Space). The inconsistency is a minor accessibility issue.

**Fix:** Change the "카드 목록" `<button>` to an `<a>` tag with `href="#"` and `onclick` with `preventDefault`, matching the breadcrumb pattern used for "홈":

```svelte
<li>
  <a
    href="#"
    class="transition-colors hover:text-[var(--color-primary)]"
    onclick={(e) => { e.preventDefault(); goBack(); }}
  >카드 목록</a>
</li>
```

**Steps:**
1. ~~Update `CardPage.svelte` breadcrumb to use consistent `<a>` tags~~ DONE
2. ~~Run all gates to confirm no regressions~~ DONE (tsc PASS, vitest 189 pass, bun test 57 pass)
3. ~~Commit with message: `fix(a11y): ♿ use consistent link elements in card breadcrumb`~~ DONE (commit 00000006)

---

### C61-03 (LOW, LOW): `SpendingSummary.svelte` console.warn for expected QuotaExceededError in private browsing

**File:** `apps/web/src/components/dashboard/SpendingSummary.svelte:141`
**Problem:** The dismiss button's `sessionStorage.setItem` catch block logs a `console.warn` for all errors, including expected `QuotaExceededError` in private browsing. This is minor logging noise.

**Fix:** Suppress the warning for `QuotaExceededError` (DOMException with name `QuotaExceededError` or `NS_ERROR_DOM_QUOTA_REACHED` in Firefox):

```ts
if (typeof sessionStorage !== 'undefined' && !(err instanceof DOMException && (err.name === 'QuotaExceededError' || err.name === 'NS_ERROR_DOM_QUOTA_REACHED'))) {
  console.warn('[cherrypicker] Failed to persist dismiss state:', err);
}
```

**Steps:**
1. ~~Update `SpendingSummary.svelte` dismiss catch block to suppress QuotaExceededError warnings~~ DONE
2. ~~Run all gates to confirm no regressions~~ DONE (tsc PASS, vitest 189 pass, bun test 57 pass)
3. ~~Commit with message: `fix(dashboard): 🐛 suppress expected QuotaExceededError warning in private browsing`~~ DONE (commit 0000000f)

---

### C61-04 (LOW, LOW): `CardDetail.svelte` category labels fetch races with card data fetch

**File:** `apps/web/src/components/cards/CardDetail.svelte:21-28,68-87`
**Problem:** The `onMount` for category labels and the `$effect` for card data run independently. If card data completes first, the template briefly shows raw category IDs.

**Fix:** Add a `categoryLabelsLoaded` guard so the rewards table only renders after labels are available:

```ts
let categoryLabelsLoaded = $state(false);

onMount(async () => {
  try {
    const nodes = await loadCategories();
    categoryLabels = buildCategoryLabelMap(nodes);
    categoryLabelsLoaded = true;
  } catch {
    categoryLabelsLoaded = true; // Show raw IDs as fallback
  }
});
```

Then in the template, gate the rewards table rendering on `categoryLabelsLoaded || card === null`.

**Steps:**
1. ~~Add `categoryLabelsReady` state and guard~~ DONE
2. ~~Run all gates to confirm no regressions~~ DONE (tsc PASS, vitest 189 pass, bun test 57 pass)
3. ~~Commit with message: `fix(cards): 🐛 prevent flash of raw category IDs before labels load`~~ DONE (commit 0000000f)

---

### C61-05 (LOW, LOW): `report.astro` print stylesheet doesn't remove `dark` class from `<html>`

**File:** `apps/web/src/pages/report.astro:64-81`
**Problem:** Extension of C60-02. The print stylesheet forces `body` background/color but doesn't remove the `dark` class from `<html>`, causing Tailwind dark-mode variants to still apply during printing.

**Fix:** Add a `@media print` rule to remove the `dark` class from the `<html>` element, or add print-specific overrides for dark-mode styles. Since CSS cannot remove classes, add explicit print overrides for the key dark-mode elements:

```css
@media print {
  :global(.dark .bg-gradient-to-br.from-blue-50),
  :global(.dark .bg-gradient-to-br.from-green-50),
  :global(.dark .bg-gradient-to-br.from-amber-50),
  :global(.dark .bg-gradient-to-br.from-purple-50) {
    background: #f9fafb !important;
  }
  :global(.dark .text-blue-400),
  :global(.dark .text-green-400),
  :global(.dark .text-amber-400),
  :global(.dark .text-purple-400) {
    color: #374151 !important;
  }
}
```

However, this approach is brittle. A better approach is to add a small inline script that removes the `dark` class from `<html>` when `window.print()` is called:

```html
onclick="document.documentElement.classList.remove('dark'); window.print();"
```

**Steps:**
1. ~~Update `report.astro` print button to remove `dark` class before printing~~ DONE
2. ~~Add a `afterprint` event listener to restore the `dark` class~~ DONE
3. ~~Run all gates to confirm no regressions~~ DONE (tsc PASS, vitest 189 pass, bun test 57 pass)
4. ~~Commit with message: `fix(report): 🐛 remove dark mode class before printing for consistent output`~~ DONE (commit 00000006)

---

## Deferred Findings (no action this cycle)

| Finding | Severity | Confidence | Reason for deferral |
|---|---|---|---|
| C60-02/C61-05 | LOW | LOW | Print stylesheet dark-mode inline style reset is a minor visual polish issue. The forced `background: #fff` and `color: #000` already ensures basic print readability. The edge case (issuer badge colors in print) is cosmetic and rarely noticed by users. C61-05 provides a more targeted fix approach but is still LOW priority. |
| C60-03/C19-04/C19-05 | LOW | HIGH | Full-page reload navigation already deferred across many cycles (C19-04, C19-05). Migrating to Astro `navigate()` requires Astro View Transitions integration testing. |
| C59-01 | LOW | HIGH | Extension of C8-05/C4-09 dark mode contrast issue, already deferred across many cycles. Adding dark: variants for gray-toned colors is a visual enhancement, not a bug. |
| C59-04 | LOW | HIGH | Extension of C33-01 (MEDIUM). Building a trie or Aho-Corasick automaton is a significant refactoring effort disproportionate to LOW severity. |
| C59-05 | LOW | MEDIUM | `toLocaleString('ko-KR')` inconsistency is a latent SSR risk. All modern browsers produce consistent output for ko-KR. Switching to `Intl.NumberFormat` is an enhancement, not a bug fix. |
| C59-06 | LOW | MEDIUM | Bare subcategory IDs intentionally omitted per C49-02. Edge case only affects manually edited categories. No fix needed. |

All prior deferred findings from the aggregate remain deferred. See `.context/reviews/_aggregate.md` for the complete list.

---

## Verification Plan

After implementing fixes:
1. Run `npx tsc -p apps/web/tsconfig.json --noEmit` -- expect 0 errors
2. Run `npx vitest run` -- expect all pass
3. Run `bun test` in packages/parser -- expect all pass
