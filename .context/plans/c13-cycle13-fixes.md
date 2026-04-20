# Plan: Cycle 13 Fixes

**Date:** 2026-04-20
**Source reviews:** `.context/reviews/2026-04-20-cycle13-comprehensive.md`, `.context/reviews/_aggregate.md`

---

## Tasks

### 1. [MEDIUM] Fix `loadCardsData` AbortSignal handling on cached promise (C13-01)

**File:** `apps/web/src/lib/cards.ts:155-168`
**Problem:** The `loadCardsData` function accepts an optional `AbortSignal` parameter, but if a fetch is already in-flight (the `cardsPromise` guard), the second caller's signal is silently ignored. This means `CardDetail.svelte`'s AbortController cleanup has no effect when cards data is already being fetched by another component (e.g., `CardGrid.svelte`).
**Fix:** Store the active AbortController alongside the cached promise. When a new signal arrives while a fetch is in-flight, chain the new signal so that aborting it also aborts the active fetch. Alternatively, simply document that the signal only applies to the first fetch attempt (since the data is static JSON and unlikely to change mid-session). The simplest fix: pass the signal through on every call by creating the fetch with the signal, but only create a new promise if one doesn't already exist. If one exists and its signal is not yet aborted, return the existing promise.
**Implementation:**
- Add a `let cardsAbortController: AbortController | null = null` alongside `cardsPromise`
- When a new `loadCardsData(signal)` is called:
  - If `cardsPromise` exists and the active controller is not aborted, return the existing promise
  - If the signal is aborted, create a new fetch (the old one's response will be discarded)
  - Chain the new signal to abort the active controller if needed
**Status:** DONE

### 2. [LOW] Add AbortSignal support to `loadCategories` (C13-02)

**File:** `apps/web/src/lib/cards.ts:170-184`
**Problem:** Unlike `loadCardsData`, the `loadCategories` function does not accept an `AbortSignal` parameter. Multiple components call `loadCategories` but none can cancel the request on unmount.
**Fix:** Add `signal?: AbortSignal` parameter to `loadCategories`, matching the `loadCardsData` pattern. Apply the same signal-chaining approach as C13-01.
**Status:** DONE

### 3. [LOW] Extract inline `reduce` in SpendingSummary to `$derived` (C13-03)

**File:** `apps/web/src/components/dashboard/SpendingSummary.svelte:67`
**Problem:** The template contains `analysisStore.result.monthlyBreakdown.reduce((sum, m) => sum + m.spending, 0)` directly in the markup. This recalculates on every render instead of using Svelte's `$derived` for change detection.
**Fix:** Add a `$derived` variable:
```ts
let totalAllSpending = $derived.by(() => {
  const mb = analysisStore.result?.monthlyBreakdown;
  return mb ? mb.reduce((sum, m) => sum + m.spending, 0) : 0;
});
```
Then use `{formatWon(totalAllSpending)}` in the template.
**Status:** DONE

### 4. [LOW] Add AbortController cleanup to CardPage `$effect` (C13-04)

**File:** `apps/web/src/components/cards/CardPage.svelte:13-19`
**Problem:** The `$effect` on `selectedCardId` calls `getCardById(selectedCardId).then(...)` without AbortController or cleanup. Rapid card clicks can cause racing responses and visual flicker. `CardDetail.svelte:77-96` correctly handles this but `CardPage.svelte` does not.
**Fix:** Add AbortController + generation counter pattern matching `CardDetail.svelte`:
```ts
let fetchGeneration = 0;

$effect(() => {
  if (!selectedCardId) { cardName = ''; return; }
  const gen = ++fetchGeneration;
  const controller = new AbortController();
  getCardById(selectedCardId, { signal: controller.signal })
    .then(c => { if (!controller.signal.aborted && gen === fetchGeneration) cardName = c?.nameKo ?? selectedCardId ?? ''; })
    .catch(() => { if (!controller.signal.aborted && gen === fetchGeneration) cardName = selectedCardId ?? ''; });
  return () => { controller.abort(); };
});
```
**Status:** DONE

---

## Deferred Items (not implemented this cycle)

| Finding | Severity | Reason for deferral | Exit criterion |
|---|---|---|---|
| C7-04 | LOW | TransactionReview $effect re-sync is fragile but functional; Svelte 5 proxy-based reactivity handles it correctly in practice | Svelte 5 reactivity model changes or bug reported |
| C7-06 | LOW | analyzeMultipleFiles optimizes only latest month by design; all-month transactions are preserved for display | Multi-month optimization feature requested |
| C7-07 | LOW | BANK_SIGNATURES duplication between packages/parser and apps/web; refactoring requires shared module that works in both Bun and browser | Shared parser module extraction (D-01) |
| C7-10 | LOW | CategoryBreakdown percentage rounding can cause total > 100%; cosmetic issue | Threshold adjustment or rounding fix |
| C7-11 | LOW | persistWarning message could be more specific; functional but slightly misleading | UX review of error messages |
| C8-01 | MEDIUM | AI categorizer disabled but dead code remains; removing it would lose the re-enablement comments and interface | Self-hosted AI runtime ready or decision to permanently remove |
| C8-05/C4-09 | LOW | CATEGORY_COLORS dark mode contrast; requires design token system | Design system integration |
| C8-06/C7-12 | LOW | Full page reload navigation in CardDetail and FileDropzone; works correctly | SPA router integration |
| C8-07/C4-14 | LOW | build-stats.ts fallback values drift; only affects build-time failures | Build pipeline robustification |
| C8-08 | LOW | inferYear() timezone edge case near midnight Dec 31; theoretical | Real user report of date misattribution |
| C8-09 | LOW | Test duplicates production code; intentional for black-box testing | Test architecture refactor |
| C8-10 | LOW | csv.ts installment NaN filtered by `> 1`; works correctly by coincidence | CSV parser refactor |
| C8-11 | LOW | pdf.ts fallback date regex could match decimals; no known PDFs produce this | PDF parser refactor |
| C9R-03 | LOW | pdf.ts negative amounts (refunds) silently dropped; by design for optimization | Refund handling feature |
| D-106 | LOW | bare `catch {}` in pdf.ts tryStructuredParse; returns null on any error (correct fallback) | PDF parser error handling refactor |
| D-110 | LOW | Non-latest month edits have no visible optimization effect; by design | Multi-month optimization feature |
| D-66 | LOW | CardGrid issuer filter shows issuers with 0 cards after type filter; less severe than originally reported | Design review |
| C11-02 | LOW | BASE_URL trailing slash assumption; Astro guarantees this | Astro version change breaking guarantee |
| C53-02 | LOW | Duplicated card stats reading logic; already extracted to build-stats.ts shared module | Further deduplication if needed |
| C53-03 | LOW | CardDetail performance tier header dark mode contrast; `dark:text-blue-300` already added | Design system integration |
| C4-06/C52-03 | LOW | Annual savings projection label; "최근 월 기준" caveat already added | UX team recommends different label |
| C4-10 | MEDIUM | E2E test stale dist/ dependency; requires E2E infrastructure change | E2E test framework refactor |
| C4-11 | MEDIUM | No regression test for findCategory fuzzy match; requires test infrastructure | Test coverage sprint |
| C4-13/C9-08 | LOW | Small-percentage bars nearly invisible; visual polish | Design review |
