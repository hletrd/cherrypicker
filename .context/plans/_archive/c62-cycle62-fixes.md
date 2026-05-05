# Cycle 62 Implementation Plan

**Date:** 2026-04-21
**Source reviews:** `.context/reviews/2026-04-21-cycle62-comprehensive.md`, `.context/reviews/_aggregate.md`

---

## Findings to Address

### Task 1: C62-11 (LOW, MEDIUM): `persistToStorage` bare catch returns 'corrupted' for non-quota errors

**File:** `apps/web/src/lib/store.svelte.ts:155`
**Problem:** The `persistToStorage` function catches all exceptions and returns `{ kind: 'corrupted', truncatedTxCount: null }`. If `JSON.stringify` throws due to a circular reference or other non-quota error, the user sees a "corrupted" message that implies quota issues rather than a serialization bug. The error is also silently swallowed with no diagnostic logging.

**Fix:** Narrow the catch to distinguish `QuotaExceededError` from other errors, and add a diagnostic `console.warn` for non-quota failures:

```ts
catch (err) {
  // QuotaExceededError is expected in private browsing or with very large data
  if (typeof DOMException !== 'undefined' && err instanceof DOMException &&
      (err.name === 'QuotaExceededError' || err.name === 'NS_ERROR_DOM_QUOTA_REACHED')) {
    return { kind: 'corrupted', truncatedTxCount: null };
  }
  // Non-quota errors (e.g., circular reference in JSON.stringify) are unexpected
  // and should be logged for diagnostics while still treating the save as failed
  if (typeof console !== 'undefined') {
    console.warn('[cherrypicker] Unexpected error persisting analysis data:', err);
  }
  return { kind: 'corrupted', truncatedTxCount: null };
}
```

**Steps:**
1. ~~Update `persistToStorage` catch block in `store.svelte.ts`~~ DONE
2. ~~Run all gates to confirm no regressions~~ DONE (tsc PASS, vitest 189 pass, bun test 57 pass)
3. ~~Commit with message: `fix(store): 🐛 narrow persistToStorage catch to distinguish quota vs unexpected errors`~~ DONE (commit 00000009)

---

### Task 2: C62-09 (MEDIUM, HIGH): Build card-by-ID index for O(1) lookups

**File:** `apps/web/src/lib/cards.ts:280-307`
**Problem:** `getCardById` does a linear scan through all issuers and cards: `for (const issuer of data.issuers) { const card = issuer.cards.find(...) }`. With 683+ cards across 24 issuers, this is O(n) per lookup. Flagged by 4 cycles (C3-D111, C50, C56, C62). Every CardDetail render and CardPage hash change triggers this scan.

**Fix:** Build a `Map<string, CardRuleSet>` index when `loadCardsData()` is first called, and use it for O(1) lookups in `getCardById`:

```ts
let cardIndex: Map<string, { issuer: IssuerData; card: CardRuleSet }> | null = null;

function buildCardIndex(data: CardsJson): Map<string, { issuer: IssuerData; card: CardRuleSet }> {
  const index = new Map<string, { issuer: IssuerData; card: CardRuleSet }>();
  for (const issuer of data.issuers) {
    for (const card of issuer.cards) {
      index.set(card.card.id, { issuer, card });
    }
  }
  return index;
}
```

Then in `loadCardsData()`, after resolving the data, build the index:
```ts
cardsPromise = fetch(...)
  .then(res => res.json())
  .then(data => { cardIndex = buildCardIndex(data); return data; })
  // ...
```

And simplify `getCardById` to use the index:
```ts
export async function getCardById(cardId: string, options?: { signal?: AbortSignal }): Promise<CardDetail | null> {
  const data = await loadCardsData(options?.signal);
  if (!data) return null;
  const entry = cardIndex?.get(cardId);
  if (!entry) return null;
  // ... build CardDetail from entry
}
```

**Steps:**
1. ~~Add `cardIndex` module-level variable and `buildCardIndex` function to `cards.ts`~~ DONE
2. ~~Build index on successful `loadCardsData()` resolution~~ DONE
3. ~~Clear index when `cardsPromise` is reset (on error)~~ DONE
4. ~~Simplify `getCardById` to use the index~~ DONE (with fallback to linear scan)
5. ~~Run all gates to confirm no regressions~~ DONE (tsc PASS, vitest 189 pass, bun test 57 pass)
6. ~~Commit with message: `perf(cards): ⚡ build card-by-ID index for O(1) lookups instead of O(n) scan`~~ DONE (commit 0000000c)

---

### Task 3: C62-15 (MEDIUM, HIGH): Fix FileDropzone navigation to preserve session state

**File:** `apps/web/src/components/upload/FileDropzone.svelte:237-239`
**Problem:** After successful upload, `window.location.href = buildPageUrl('dashboard')` triggers a full page reload. This loses the in-memory store state. The store persists to sessionStorage, but if persistence was truncated (`persistWarning`), the transactions are lost on the dashboard page. Flagged by 3 cycles (C19, C60, C62).

**Fix:** Use Astro's client-side navigation API instead of a full page reload. Astro 6 exposes `navigate()` from `astro:transitions`:

```ts
// Replace:
window.location.href = buildPageUrl('dashboard');
// With:
import { navigate } from 'astro:transitions/client';
navigate(buildPageUrl('dashboard'));
```

If `astro:transitions/client` is not available (e.g., during SSR), fall back to the full page reload:

```ts
try {
  const { navigate } = await import('astro:transitions/client');
  navigate(buildPageUrl('dashboard'));
} catch {
  window.location.href = buildPageUrl('dashboard');
}
```

However, since this is a Svelte component with `client:load`, the dynamic import approach is appropriate. But we need to verify that Astro View Transitions are enabled and the Svelte islands are correctly hydrated after client-side navigation.

**Alternative (safer) fix:** Since the `navigate` import from `astro:transitions/client` requires View Transitions to be enabled, and enabling it may have side effects, a simpler fix is to use `window.location.assign()` (same as current but clearer intent) and accept the full reload. The key issue is that truncated session data is lost -- that's already addressed by the `persistWarning` UI. The full reload is a design trade-off, not a bug.

**Decision:** Implement the Astro `navigate()` approach since Astro 6 supports it by default. If it causes issues during testing, fall back to the current behavior and defer.

**Steps:**
1. ~~Add dynamic `import('astro:transitions/client')` with fallback to `FileDropzone.svelte`~~ DONE
2. ~~Replace `window.location.href = buildPageUrl('dashboard')` with `navigate()` + fallback~~ DONE
3. ~~Also fix `CardDetail.svelte:271` which uses `window.location.href = buildPageUrl('cards')` for the "카드 목록으로 돌아가기" button~~ DONE
4. ~~Run all gates to confirm no regressions~~ DONE (tsc PASS, vitest 189 pass, bun test 57 pass)
5. ~~Commit with message: `fix(nav): 🐛 use Astro client-side navigation instead of full page reload`~~ DONE (commit 00000005)

---

### Task 4: C62-05/C61-02 (LOW, MEDIUM): Fix breadcrumb accessibility -- use `<button>` instead of `<a href="#">`

**File:** `apps/web/src/components/cards/CardPage.svelte:70-74`
**Problem:** The breadcrumb "카드 목록" uses `<a href="#" onclick={(e) => { e.preventDefault(); goBack(); }}>` which is semantically a button disguised as a link. Screen readers announce it as a navigation link rather than an action. The `#` href also adds a history entry. Already flagged by C61-02. Still OPEN.

**Fix:** Change the `<a>` to a `<button>` styled to look like a breadcrumb link:

```svelte
<li>
  <button
    type="button"
    class="transition-colors hover:text-[var(--color-primary)] text-inherit bg-transparent border-none cursor-pointer p-0 font-inherit"
    onclick={goBack}
  >카드 목록</button>
</li>
```

**Steps:**
1. ~~Update `CardPage.svelte` breadcrumb to use `<button>` instead of `<a href="#">`~~ DONE
2. ~~Run all gates to confirm no regressions~~ DONE (tsc PASS, vitest 189 pass, bun test 57 pass)
3. ~~Commit with message: `fix(a11y): ♿ use button instead of link for breadcrumb action in CardPage`~~ DONE (commit 0000000d)

---

## Deferred Findings (no action this cycle)

| Finding | Severity | Confidence | Reason for deferral |
|---|---|---|---|
| C62-01/C33-01 | MEDIUM | HIGH | MerchantMatcher/taxonomy O(n) scan. Already deferred as D-100. Building a trie-based prefix index is a significant refactoring effort disproportionate to the current scale (~2000 keywords, < 1000 transactions). The precomputed `SUBSTRING_SAFE_ENTRIES` in `matcher.ts` already optimizes the outer loop. |
| C62-02/C56-04 | LOW | HIGH | date-utils unparseable passthrough. Already deferred. Returning raw input for malformed dates is acceptable fallback behavior -- the transaction is still created with the raw string, which the user can see and correct in TransactionReview. Adding an error to `parseErrors` would require changing the return type of `parseDateStringToISO`. |
| C62-03/C18-03/C7-06 | LOW | MEDIUM | Annual savings simple *12 projection. Already deferred as D-40/D-82. The "약" label makes it clear this is an estimate. Changing the calculation requires UX design decisions. |
| C62-04/C21-04/C33-02 | LOW | MEDIUM | cachedCategoryLabels stale across redeployments. Already deferred across 6 cycles. The cache is invalidated on explicit `reset()`. Staleness across deployments is a theoretical concern -- users rarely keep a tab open across deployments. Adding a cache-busting version parameter would require build-time configuration changes. |
| C62-06/C20-02/C25-03 | LOW | LOW | CSV DATE_PATTERNS divergence risk with date-utils.ts. Already deferred across 3 cycles. The patterns are only used for the `isDateLike()` heuristic in the generic CSV parser, not for actual date parsing. A code comment already notes the sync requirement. |
| C62-08/C18-04 | LOW | MEDIUM | xlsx.ts isHTMLContent only checks first 512 bytes. Already deferred. Files with > 512 bytes of BOM+whitespace before HTML content are extremely rare in Korean card exports. |
| C62-10/C18-01 | LOW | HIGH | VisibilityToggle $effect directly mutates DOM. Already deferred across 2 cycles. The imperative DOM manipulation is architecturally necessary for managing non-Svelte container visibility. Refactoring to a fully declarative approach would require restructuring the Astro page layout. |
| C62-12/C8-05/C4-09 | LOW | LOW | CategoryBreakdown CATEGORY_COLORS incomplete + dark mode contrast. Already deferred as D-42/D-64. Dynamic color generation requires design work. |
| C62-13/C62-04 | LOW | MEDIUM | cachedCoreRules stale across redeployments. Same deferral rationale as C62-04. The `invalidateAnalyzerCaches()` function already clears the cache on explicit reset. |
| C62-14/C8-09 | LOW | LOW | Tests duplicate production code. Already deferred as D-35/D-55. The test file tests the same logic as `date-utils.ts` but cannot import it because the functions are not exported. Exporting `parseDateStringToISO` and `inferYear` from `date-utils.ts` would fix this, but requires updating all consumers. |

All prior deferred findings from the aggregate remain deferred. See `.context/reviews/_aggregate.md` for the complete list.
