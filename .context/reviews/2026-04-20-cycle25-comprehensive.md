# Cycle 25 Comprehensive Code Review

**Date:** 2026-04-20
**Reviewer:** Full-spectrum review (code quality, security, performance, architecture, UI/UX)
**Scope:** Full repo re-read of all source files

---

## Verification of Prior Cycle Fixes

All prior cycle 1-24 findings confirmed as-per aggregate status. No regressions detected in previously fixed items.

---

## New Findings

### C25-01 | MEDIUM | High | `apps/web/src/components/dashboard/CategoryBreakdown.svelte:6-49`
**Hardcoded CATEGORY_COLORS with poor dark-mode contrast**

The `CATEGORY_COLORS` object maps category IDs to hex colors. Several colors have very low contrast against dark backgrounds:
- `water: '#1f2937'` — nearly invisible on dark backgrounds (contrast ratio ~1.1:1 against #111827)
- `gas: '#374151'` — very low contrast on dark backgrounds (~1.4:1)
- `electricity: '#4b5563'` — low contrast on dark backgrounds (~2.0:1)
- `toll: '#a8a29e'` — acceptable but borderline

This was previously flagged as C4-09/C8-05 but was downgraded/deferred. The specific `water` and `gas` entries are effectively invisible in dark mode and should be fixed. WCAG 2.2 requires 4.5:1 for normal text and 3:1 for large text/UI components.

**Fix:** Replace dark-mode-invisible colors with lighter alternatives that maintain hue but meet contrast requirements. E.g., `water: '#1f2937'` -> `water: '#93c5fd'` (lighter blue) for dark mode, or use CSS custom properties with dark mode variants.

### C25-02 | MEDIUM | High | `apps/web/src/lib/analyzer.ts:47`
**cachedCoreRules never invalidated across sessions**

The module-level `cachedCoreRules` variable is set once and never cleared. Since card data is fetched from static JSON (`cards.json`), the data doesn't change within a session. However, if the web app is long-lived (e.g., a user keeps a tab open for days), new card data deployed to the server won't be picked up because:
1. `loadCardsData()` caches the fetch promise
2. `cachedCoreRules` caches the transformation result on top of that

This means stale card rules persist indefinitely. Same class as C21-04/C23-02 (cachedCategoryLabels, cachedCoreRules).

**Fix:** Add a TTL or generation counter to invalidate cachedCoreRules. Alternatively, expose a `invalidateCache()` method that resets both `cardsPromise` and `cachedCoreRules`.

### C25-03 | LOW | High | `apps/web/src/lib/parser/csv.ts:79-91`
**DATE_PATTERNS and AMOUNT_PATTERNS divergence risk with date-utils.ts**

The `DATE_PATTERNS` and `AMOUNT_PATTERNS` arrays in csv.ts are used only for the generic parser's `isDateLike()`/`isAmountLike()` column-detection heuristic. They must be kept in sync with `parseDateStringToISO()` in date-utils.ts. If a new date format is added there, these patterns must also be updated. The comment on line 76-78 acknowledges this but there is no programmatic guard.

Previously flagged as C20-02. Still open. The risk is real but low — a new date format would need to be added carefully.

**Fix:** Add a unit test that validates every `parseDateStringToISO()` format against `DATE_PATTERNS` to catch drift.

### C25-04 | LOW | Medium | `packages/core/src/optimizer/greedy.ts:224`
**buildCardResults totalSpending does not guard against negative amounts**

`totalSpending` is computed via `reduce((sum, tx) => sum + tx.amount, 0)` without a guard. The caller filters transactions with `tx.amount > 0 && Number.isFinite(tx.amount)` before passing them, so negative amounts should not reach this code. However, `buildCardResults` is a standalone function that could be called independently.

Previously flagged as C24-06. Still open. Safe in practice but the function lacks its own invariant.

**Fix:** Add `Math.abs(tx.amount)` or a guard assertion in the reduce.

### C25-05 | LOW | High | `apps/web/src/components/dashboard/SpendingSummary.svelte:138`
**monthDiff === 0 shows "0개월 전 실적"**

When two monthlyBreakdown entries are for the same month (e.g., from duplicate data), `monthDiff` computes to 0 and the template shows "0개월 전 실적" which is confusing Korean.

Previously flagged as C24-03. Still open. The existing code already handles this case with the fallback to `'이전 실적'`:

```svelte
{@const prevLabel = !Number.isFinite(monthDiff) || monthDiff === 0 ? '이전 실적' : ...}
```

This is actually already fixed — the ternary explicitly handles `monthDiff === 0` with `'이전 실적'`. **Downgrading to no-action.**

### C25-06 | MEDIUM | High | `apps/web/src/lib/parser/pdf.ts:260`
**Bare `catch {}` in tryStructuredParse**

Line 260: `catch { return null; }` — the structured parse failure is silently swallowed. If the table parser throws due to malformed PDF content, there's no diagnostic trail. The fallback parser will attempt to recover, but the structured parse failure should be logged for debugging.

Previously flagged as D-106. Still open.

**Fix:** Add `console.warn('[cherrypicker] Structured PDF parse failed, falling back:', err instanceof Error ? err.message : String(err))` inside the catch, then return null.

### C25-07 | LOW | Medium | `apps/web/src/lib/store.svelte.ts:264-270`
**clearStorage() SSR guard pattern could be simplified**

The `clearStorage()` function now correctly logs non-SSR failures (C24-02 fix applied). However, the pattern of checking `typeof sessionStorage !== 'undefined'` both before and inside the catch is redundant — if sessionStorage is defined, the catch will only fire for real errors; if it's undefined, the try block's guard already prevents the call. This is a style issue, not a bug.

**No action needed.** The defensive pattern is intentional for clarity.

### C25-08 | LOW | High | `apps/web/src/lib/build-stats.ts:16-18`
**Fallback card stats values will drift**

The hardcoded fallback values (`totalCards: 683`, `totalIssuers: 24`, `totalCategories: 45`) are used when `cards.json` is unavailable at build time. These will become stale as card data is updated.

Previously flagged as C8-07/C4-14. Still open. The fix comment in readCardStats already logs when fallbacks are used.

**Fix:** Add a CI check or build-time warning that compares the fallback values against the actual JSON values and alerts on drift.

### C25-09 | MEDIUM | Medium | `apps/web/src/components/cards/CardDetail.svelte:225-229`
**Performance tier header dark mode contrast**

The performance tier group header uses `text-blue-700 dark:text-blue-300` on `bg-[var(--color-primary-light)]`. In dark mode, `blue-300` on the primary-light background may have insufficient contrast depending on the exact CSS variable values. This is the same class as C53-03.

**Fix:** Use `dark:text-blue-200` or ensure the `--color-primary-light` variable has sufficient contrast in dark mode.

### C25-10 | LOW | Medium | `apps/web/src/lib/parser/pdf.ts:21-27`
**Module-level regex constants divergence with date-utils.ts**

The `DATE_PATTERN`, `STRICT_DATE_PATTERN`, `SHORT_YEAR_DATE_PATTERN`, etc. in pdf.ts are module-level regex constants that must be kept in sync with the formats handled by `parseDateStringToISO()` in date-utils.ts. If a new date format is added there, these patterns must also be updated.

Previously flagged as C20-04. Still open.

**Fix:** Same as C25-03 — add a unit test validating consistency.

### C25-11 | LOW | High | `apps/web/src/components/dashboard/TransactionReview.svelte:128`
**changeCategory O(n) array copy on every category change**

Line 128: `editedTxs = editedTxs.map((t, i) => i === idx ? updated : t);` creates a full copy of the array on every category change. For large transaction lists (hundreds of entries), this is O(n) per edit.

Previously flagged as C22-05. Still open. The practical impact is limited because category changes are infrequent user actions, not hot-path operations.

**Fix:** Use a sparse update approach: `editedTxs[idx] = updated; editedTxs = editedTxs;` (trigger reactivity). In Svelte 5, direct mutation of `$state` arrays triggers reactivity.

### C25-12 | LOW | Medium | `apps/web/src/lib/analyzer.ts:166-170`
**cachedCoreRules filter creates new array but shared cache is not immutable**

When `options?.cardIds` is provided, `coreRules = cachedCoreRules.filter(...)` creates a filtered copy. This is correct — the original `cachedCoreRules` is not mutated. However, if `getAllCardRules()` is called concurrently (two tabs, two components), both get the same `cachedCoreRules` reference. The filter is safe because `.filter()` returns a new array, but the individual `CoreCardRuleSet` objects in the array are shallow copies (spread via `toCoreCardRuleSets`), so mutations to nested objects would affect the cache.

In practice, nothing mutates these objects after creation, so this is a theoretical concern.

**No action needed.** The current code is safe.

---

## Summary of Findings

| ID | Severity | Confidence | Description |
|---|---|---|---|
| C25-01 | MEDIUM | High | CATEGORY_COLORS poor dark mode contrast (water, gas, electricity) |
| C25-02 | MEDIUM | High | cachedCoreRules never invalidated across sessions |
| C25-03 | LOW | High | DATE_PATTERNS divergence risk with date-utils.ts |
| C25-04 | LOW | Medium | buildCardResults totalSpending no negative guard |
| C25-05 | -- | -- | (Already fixed) monthDiff === 0 handled correctly |
| C25-06 | MEDIUM | High | pdf.ts bare catch {} in tryStructuredParse |
| C25-07 | -- | -- | (Style) clearStorage() SSR guard redundant but intentional |
| C25-08 | LOW | High | build-stats.ts fallback values will drift |
| C25-09 | MEDIUM | Medium | CardDetail performance tier header dark mode contrast |
| C25-10 | LOW | Medium | pdf.ts regex constants divergence with date-utils.ts |
| C25-11 | LOW | High | TransactionReview changeCategory O(n) copy |
| C25-12 | -- | -- | (Theoretical) cachedCoreRules concurrent access safety |

**Actionable new findings:** C25-01, C25-02, C25-06, C25-09 (MEDIUM), C25-03, C25-04, C25-08, C25-10, C25-11 (LOW)
