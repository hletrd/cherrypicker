# Comprehensive Code Review -- Cycle 13

**Date:** 2026-04-20
**Reviewer:** Single-agent comprehensive review (cycle 13 of review-plan-fix loop)
**Scope:** Full repository -- all packages, apps, and shared code
**Angles covered:** code quality, correctness, performance, security, UI/UX, architecture, test coverage

---

## Methodology

Read every source file in the repository (40+ source files across packages/core, packages/parser, packages/rules, packages/viz, tools/cli, tools/scraper, apps/web). Cross-referenced with prior cycle 1-53 reviews and the cycle 12 aggregate. Ran `bun test` (266 pass, 0 fail), `bun run lint` (0 errors), `bun run typecheck` (0 errors), and `bun run build` (success). Focused on finding genuinely NEW issues not previously reported.

---

## Verification of Prior "Still-Open" Deferred Findings

All deferred findings from the aggregate (`.context/reviews/_aggregate.md`) are confirmed still present unless noted:

| Finding | Status | Notes |
|---|---|---|
| C11-01 | **FIXED** (prior) | `analyzer.ts:304` uses `Math.abs(tx.amount)` |
| C11-03 | **FIXED** (prior) | `pdf.ts:382-389` reports errors for unparseable amounts |
| C12-01 | **PARTIALLY FIXED** | `OptimalCardMap.svelte:19-25` maxRate floor lowered from 0.005 to 0.001 -- improved but still present as a design choice |
| C12-04 | **FIXED** | `SavingsComparison.svelte:205` removed `Object.is(displayedSavings, -0)` guard; now uses `displayedSavings >= 0` with comment explaining `formatWon` normalizes negative-zero |
| C7-04 | STILL DEFERRED | TransactionReview $effect re-sync fragile |
| C7-06 | STILL DEFERRED | analyzeMultipleFiles returns all-month transactions but optimizes only latest month |
| C7-07 | STILL DEFERRED | BANK_SIGNATURES duplicated between packages/parser and apps/web |
| C7-10 | STILL DEFERRED | CategoryBreakdown percentage rounding can cause total > 100% |
| C7-11 | STILL DEFERRED | persistWarning message misleading for data corruption vs size truncation |
| C8-01 | STILL DEFERRED | AI categorizer disabled but dead code |
| C8-05/C4-09 | STILL DEFERRED | CategoryBreakdown CATEGORY_COLORS poor dark mode contrast |
| C8-06/C7-12 | STILL DEFERRED | FileDropzone + CardDetail use full page reload navigation |
| C8-07/C4-14 | STILL DEFERRED | build-stats.ts fallback values will drift |
| C8-08 | STILL DEFERRED | inferYear() timezone-dependent near midnight Dec 31 |
| C8-09 | STILL DEFERRED | Test duplicates production code |
| C8-10 | STILL DEFERRED | csv.ts installment NaN fragile implicit filter |
| C8-11 | STILL DEFERRED | pdf.ts fallback date regex could match decimals |
| C9R-03 | STILL DEFERRED | pdf.ts negative amounts (refunds) silently dropped |
| D-106 | STILL DEFERRED | bare `catch {}` in pdf.ts tryStructuredParse |
| D-110 | STILL DEFERRED | Non-latest month edits have no visible optimization effect |
| C4-06/C52-03 | STILL DEFERRED | Annual savings projection label unchanged |
| C4-10 | STILL DEFERRED | E2E test stale dist/ dependency |
| C4-11 | STILL DEFERRED | No regression test for findCategory fuzzy match |
| C4-13/C9-08 | STILL DEFERRED | Small-percentage bars nearly invisible |
| C53-02 | STILL DEFERRED | Duplicated card stats reading logic |
| C53-03 | STILL DEFERRED | CardDetail performance tier header dark mode contrast |
| D-66 | STILL DEFERRED | CardGrid issuer filter shows issuers with 0 cards after type filter |

---

## New Findings

### C13-01: `loadCardsData` in `cards.ts:155-168` -- Signal from second caller is silently ignored on cached promise (MEDIUM, Medium)

**File:** `apps/web/src/lib/cards.ts:155-168`
**Description:** The `loadCardsData` function accepts an optional `AbortSignal` parameter. On the first call, the signal is passed to `fetch()`. However, if a second call arrives while the first promise is still pending (the `if (!cardsPromise)` guard returns early), the second caller's signal is completely ignored. This means:
1. If caller A starts a fetch with no signal, and caller B calls with an AbortSignal, B's abort will have no effect.
2. If the first fetch fails and the promise is reset (`.catch` sets `cardsPromise = null`), any abort signal from a concurrent caller is lost.

The `getCardById` function (line 214) passes `options?.signal` to `loadCardsData`, which calls `loadCardsData(options?.signal)`. The `CardDetail.svelte` component uses `AbortController` to cancel requests on unmount -- but if the cards data is already being fetched (e.g., by `CardGrid.svelte` on the same page), the AbortController signal from `CardDetail` is silently discarded.
**Failure scenario:** User navigates away from a card detail page quickly; the AbortController fires, but the `loadCardsData` call ignores it because the fetch is already in-flight from another component. The response still arrives and is processed unnecessarily.
**Fix:** Store the active AbortController and chain new signals, or reject the cached promise if any pending signal fires. A simpler fix: add a `forceRefresh` parameter or store the signal alongside the promise.

### C13-02: `loadCategories` in `cards.ts:170-184` has no AbortSignal support at all (LOW, Medium)

**File:** `apps/web/src/lib/cards.ts:170-184`
**Description:** Unlike `loadCardsData`, the `loadCategories` function does not accept an `AbortSignal` parameter. It creates a fetch with no way to cancel. Multiple components call `loadCategories` (SpendingSummary, TransactionReview, CardDetail, analyzer.ts via `getCategoryLabels`), and none can abort the request on unmount. This is a minor inefficiency rather than a bug, since the response is small and cached.
**Failure scenario:** Component unmounts while categories are still loading -- the fetch completes but the result is unused.
**Fix:** Add an optional `signal?: AbortSignal` parameter to `loadCategories`, matching the pattern in `loadCardsData`.

### C13-03: `SpendingSummary.svelte:67` inline `reduce` in template is recalculated on every render (LOW, Low)

**File:** `apps/web/src/components/dashboard/SpendingSummary.svelte:67`
**Description:** The template contains `analysisStore.result.monthlyBreakdown.reduce((sum, m) => sum + m.spending, 0)` directly in the markup. This creates a new function closure and iterates the array on every re-render. Since `monthlyBreakdown` rarely changes, this is a minor performance concern, but the pattern is inconsistent with other components that use `$derived` for computed values.
**Failure scenario:** No functional failure. Minor unnecessary recalculation.
**Fix:** Extract to a `$derived` variable like `totalSpending` for consistency and to leverage Svelte's change detection.

### C13-04: `CardPage.svelte:15` -- `$effect` calls async `getCardById` without cleanup/abort (LOW, Medium)

**File:** `apps/web/src/components/cards/CardPage.svelte:13-19`
**Description:** The `$effect` on `selectedCardId` calls `getCardById(selectedCardId).then(...)` but does not use AbortController or return a cleanup function. If the user rapidly clicks different cards, multiple concurrent `getCardById` calls race, and the last one to resolve wins (not necessarily the last one clicked). This is different from `CardDetail.svelte:77-96` which correctly uses AbortController + generation counter.
**Failure scenario:** User clicks Card A, then quickly clicks Card B. If Card A's response arrives after Card B's, `cardName` briefly shows Card A's name before being overwritten by Card B. This is a visual flicker, not a data corruption issue.
**Fix:** Add AbortController + generation counter pattern matching `CardDetail.svelte`, or use the `$effect` return cleanup pattern.

### C13-05: `CardGrid.svelte:22` -- `availableIssuers` derived shows issuers with 0 cards after type filter (confirmation of D-66)

**File:** `apps/web/src/components/cards/CardGrid.svelte:22`
**Description:** This is already tracked as D-66. Re-confirming it is still present. When the user selects a type filter (e.g., "check"), `availableIssuers` is derived from `filteredCards`, which only contains cards matching the type filter. However, the issuer pills are shown for all issuers that have at least one card in the filtered set. If an issuer has only credit cards and the user selects "check", that issuer correctly disappears. But the count badge at line 123 shows the filtered count, which is correct. The actual issue is cosmetic -- after type filter, the issuer list is correctly filtered, so D-66 may be less severe than originally reported.

**Not a new finding** -- already tracked as D-66.

---

## Cross-File Consistency Checks

1. **`Math.abs(tx.amount)` in monthly spending:** `analyzer.ts:201` and `store.svelte.ts:378` both use `Math.abs(tx.amount)`. Consistent.

2. **PDF fallback error reporting:** `pdf.ts:382-389` reports errors for unparseable amounts in fallback path. Matches structured path behavior at lines 264-273. Consistent.

3. **All `formatWon` implementations:** All have `Number.isFinite` guard + negative-zero normalization. Consistent.

4. **All `formatRate`/`formatRatePrecise` implementations:** All have `Number.isFinite` guard. Consistent.

5. **`parseDateToISO` implementations (3 locations: csv.ts, pdf.ts, xlsx.ts):** All have month/day range validation. All handle the same set of date formats (full YYYY-MM-DD, YYYYMMDD, short YY-MM-DD, Korean full/short, MM/DD). Consistent.

6. **`inferYear` implementations (3 locations):** All use the same 90-day look-back heuristic. Consistent.

7. **`parseAmount` implementations:** CSV uses `parseInt` (returns NaN, guarded by `isValidAmount`), PDF uses `parseInt` with `Number.isNaN` guard (returns 0), XLSX uses `parseInt` for string input with `Number.isNaN` guard (returns null). Intentional design differences between the three formats.

8. **`isValidTx` validation in store.svelte.ts:** Includes `Number.isFinite(tx.amount)` and `tx.amount > 0` checks. Consistent with optimizer's `tx.amount > 0` filter.

9. **`BANK_SIGNATURES` duplication:** Confirmed still present in both `apps/web/src/lib/parser/detect.ts` and `packages/parser/src/detect.ts`. Already tracked as C7-07.

10. **`window.location.href` navigation:** Two locations use `import.meta.env.BASE_URL + 'path'` (CardDetail.svelte:276, FileDropzone.svelte:217). Already tracked as C8-06/C7-12.

11. **`build-stats.ts` fallback values:** Still hardcoded as `totalCards: 683, totalIssuers: 24, totalCategories: 45`. Already tracked as C8-07/C4-14.

12. **Category labels building:** Duplicated in 4 places: `analyzer.ts:210-223`, `store.svelte.ts:262-276`, `CardDetail.svelte:22-36`, and `TransactionReview.svelte:53-67`. Each builds the same Map from the same taxonomy data. This is a code duplication issue but not a correctness issue since the data source is the same.

13. **`loadCardsData` signal handling:** The signal parameter is passed to `fetch()` on the first call but ignored on subsequent cached calls. See C13-01 above.

---

## Final Sweep

- No new security issues beyond what is already tracked.
- No new performance issues beyond C13-01 (signal handling) and C13-03 (inline reduce).
- No new type safety issues. All gates pass (lint, typecheck, test, build).
- The `categorizer-ai.ts` file is still disabled (dead code, tracked as C8-01).
- The ILP optimizer stub is still a pass-through to greedy, documented with a TODO.
- No new test coverage gaps beyond C4-10 and C4-11 (already deferred).
- No new UI/UX accessibility issues beyond what is already tracked.
- CSP meta tag uses `'unsafe-inline'` for both script-src and style-src, documented with a TODO for nonce-based CSP. Already tracked.
- No `innerHTML` usage anywhere in the codebase (confirmed by grep).
- No `as any` casts anywhere in the web app code (confirmed by grep).
- `Object.is(-0)` guard in SavingsComparison has been removed (C12-04 fixed).
- `OptimalCardMap.svelte` maxRate floor lowered to 0.001 (C12-01 improved).

---

## Summary

2 genuinely new actionable findings this cycle (C13-01: loadCardsData signal handling, C13-04: CardPage $effect missing abort). 1 prior finding confirmed improved (C12-01: maxRate floor lowered). 1 prior finding confirmed fixed (C12-04: redundant negative-zero guard removed). All gates green. Codebase is stable with no high-severity new findings.
