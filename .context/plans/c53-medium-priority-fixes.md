# Plan: Cycle 53 Fixes

**Date:** 2026-04-20
**Source reviews:** `.context/reviews/2026-04-20-cycle53-comprehensive.md`, `.context/reviews/_aggregate.md`

---

## Tasks

### 1. [MEDIUM] Fix TransactionReview `changeCategory` in-place mutation (C53-01)

**File:** `apps/web/src/components/dashboard/TransactionReview.svelte:187-205`
**Problem:** The `changeCategory` function mutates `editedTxs` entries in-place (`tx.category = ...`, `tx.subcategory = ...`, `tx.confidence = ...`). This is the same fragile pattern that was fixed in `runAICategorization` (C52-02). Svelte 5's proxy-based reactivity should detect these mutations, but the pattern is inconsistent with the fix applied to `runAICategorization` and may fail in edge cases.
**Fix:** Replace entries instead of mutating in-place. Use `findIndex` + array replacement:
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
**Status:** PENDING

### 2. [LOW] Fix CardDetail performance tier header dark mode contrast (C53-03)

**File:** `apps/web/src/components/cards/CardDetail.svelte:222`
**Problem:** The performance tier header row uses `text-blue-700` without a dark mode variant, causing poor contrast in dark mode against the `bg-[var(--color-primary-light)]` background.
**Fix:** Add `dark:text-blue-300` to the class on line 222:
```html
<td colspan="4" class="px-4 py-1.5 text-xs font-semibold text-blue-700 dark:text-blue-300">
```
**Status:** PENDING

### 3. [LOW] Extract duplicated card stats reading logic (C53-02)

**File:** `apps/web/src/pages/index.astro:7-16` and `apps/web/src/layouts/Layout.astro:14-24`
**Problem:** Both files independently read `cards.json` at build time with identical try/catch fallback logic. The fallback values (683, 24, 45) are duplicated in two places.
**Fix:** Extract into a shared Astro module `apps/web/src/lib/build-stats.ts`:
```ts
import { readFile } from 'fs/promises';
import { resolve } from 'path';

export interface CardStats {
  totalCards: number;
  totalIssuers: number;
  totalCategories: number;
}

export async function readCardStats(): Promise<CardStats> {
  let totalCards = 683;
  let totalIssuers = 24;
  let totalCategories = 45;
  try {
    const raw = await readFile(resolve(process.cwd(), 'public/data/cards.json'), 'utf-8');
    const data = JSON.parse(raw);
    totalCards = data.meta?.totalCards ?? totalCards;
    totalIssuers = data.meta?.totalIssuers ?? totalIssuers;
    totalCategories = data.meta?.categories?.length ?? totalCategories;
  } catch {}
  return { totalCards, totalIssuers, totalCategories };
}
```
Then import in both `index.astro` and `Layout.astro`.
**Status:** PENDING

---

## Deferred Items (not implemented this cycle)

| Finding | Reason for deferral | Exit criterion |
|---|---|---|
| C53-02 | LOW severity; duplication is a maintainability concern, not a bug; both files currently produce the same values | Stats reading logic needs to change |
| C52-03/C4-06/C9-02 | LOW severity; annual projection label partially addressed with "최근 월 기준" caveat; UX team input needed | UX review recommends different label |
| C52-04/C4-14 | LOW severity; fallback values are correct at time of writing; only affects build-time failures | cards.json becomes unavailable at build time |
| C52-05/C4-09 | LOW severity; dark mode contrast is acceptable for most colors; only 2-3 very dark entries affected; design token migration is a larger effort | Design system integration planned |
| C4-10 | MEDIUM severity but E2E test infrastructure change; out of scope for this cycle | E2E test framework refactor |
| C4-11 | MEDIUM severity but requires new test infrastructure; out of scope | Test coverage sprint |
| C4-13 | LOW severity; visual polish; small bars still visible at wider widths | Design review |
| C9-04 | LOW severity; complex regex works correctly for all known PDF formats | PDF parser rewrite |
| C9-06 | LOW severity; rounding affects only edge cases with many tiny categories | Threshold adjustment PR |
| C9-07 | LOW severity; theoretical; no real datasets approach the limit | Large dataset reported |
| C9-08 | LOW severity; comparison bars are correct when both rewards are 0 | UX review |
| C9-09 | LOW severity; categories cache is static JSON; invalidation not needed for current use case | Dynamic category loading implemented |
| C9-10 | LOW severity; double-decode is harmless; re-encode is defensive | XLSX parser refactor |
| C9-12 | LOW severity; module-level cache is intentional for static JSON data | Store architecture change |
| D-106 | LOW severity; bare catch in tryStructuredParse is acceptable since any parsing error should result in null return (falling through to fallback) | PDF parser error handling refactor |
| D-110 | LOW severity; by design -- optimization only applies to latest month | Multi-month optimization feature |
