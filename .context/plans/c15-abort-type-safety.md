# Cycle 15 Implementation Plan

**Date:** 2026-04-20
**Cycle:** 15 of 100
**Status:** In Progress

---

## New Findings This Cycle

### C15-01: `undefined as unknown as CardsJson` type escape in AbortError path (LOW, Medium)

**File:** `apps/web/src/lib/cards.ts:201,234`
**Problem:** After an AbortError, `loadCardsData` and `loadCategories` return `undefined as unknown as CardsJson` (or `{ categories: CategoryNode[] }`). This is a type-safety code smell: TypeScript callers assume they get a valid `CardsJson`, but at runtime they get `undefined`. Downstream callers (`getAllCardRules`, `getCardList`, `getCardById`) have `if (!data)` guards that handle this, but new callers added in the future might miss the null check.
**Fix:** Replace the `undefined as unknown as` cast with a proper typed approach:
1. Add a `AbortResult<T>` type that wraps `{ aborted: true } | { data: T }`
2. Or more simply: add a JSDoc comment on `loadCardsData`/`loadCategories` documenting that the return value can be `undefined` after an abort, and change the return type to `Promise<CardsJson | undefined>`
3. Update downstream callers to handle the `undefined` case explicitly (they already do with `if (!data)` checks)

**Preferred approach:** Change the return type to include `undefined` and remove the `as unknown as` cast. This is the lightest-weight fix that eliminates the type escape while keeping the existing null-guard pattern.

#### Implementation Steps

1. Change `loadCardsData` return type from `Promise<CardsJson>` to `Promise<CardsJson | undefined>`
2. Change the AbortError catch to `return undefined` (no cast needed)
3. Change `loadCategories` return type from `Promise<CategoryNode[]>` to `Promise<CategoryNode[] | undefined>`
4. Change the AbortError catch to `return undefined` (no cast needed)
5. Update `loadCategories` line 243: `if (!data) return []` already handles undefined, no change needed
6. Verify `getAllCardRules`, `getCardList`, `getCardById` all handle undefined (they already do with `if (!data)` checks)
7. Run gates (lint, typecheck, test, build)

---

## Deferred Findings (carried forward, not implemented this cycle)

| Finding | Severity | Reason for deferral | Exit criterion |
|---|---|---|---|
| C4-06/C52-03 | LOW | Label change requires UX discussion | Product decision on projection disclaimer |
| C4-09/C8-05 | LOW | Color system needs design review | Design tokens defined |
| C4-10 | MEDIUM | E2E tests need CI infrastructure | CI pipeline set up |
| C4-11 | MEDIUM | Fuzzy match testing needs corpus data | Test data available |
| C4-13/C9-08 | LOW | Bar visibility needs design review | Min-width threshold decided |
| C4-14/C8-07 | LOW | Build-time fallback is acceptable for now | Automated stats update in CI |
| C7-04 | LOW | $effect re-sync is functional; fragile but works | Svelte 5 best practices stabilize |
| C7-06 | LOW | Design decision needed on multi-month optimization | Product decision on scope |
| C7-07 | LOW | Code duplication across packages; no runtime impact | Monorepo refactor planned |
| C7-10 | LOW | Percentage rounding is cosmetic | Largest-remainder method implementation |
| C7-11 | LOW | Warning message is acceptable for now | UX review |
| C8-01 | MEDIUM | Dead code is isolated; removal blocked on AI runtime | Self-hosted AI runtime ready |
| C8-06/C7-12 | LOW | Full page reload is functional; SPA navigation is enhancement | Astro View Transitions integration |
| C8-08 | LOW | Timezone edge case affects <0.01% of users | UTC-based date handling |
| C8-09 | LOW | Test duplication is maintenance burden, not correctness | Test refactor sprint |
| C8-10 | LOW | Implicit NaN filter works correctly | Explicit NaN check added |
| C8-11 | LOW | Regex false positive is extremely rare | Stricter regex pattern |
| C9R-03 | LOW | Negative amount handling needs product decision | Refund display decision |
| D-106 | LOW | Bare catch is intentional (non-critical fallback) | Structured error logging |
| D-110 | LOW | Multi-month editing UX needs product decision | Multi-month optimization decision |
| D-66 | LOW | Issuer filter edge case is cosmetic | Filter logic redesign |
| C11-02 | LOW | BASE_URL trailing slash works in current deployment | Config normalization |
| C53-02 | LOW | Code duplication in Astro pages; no runtime impact | Shared component extraction |
| C53-03 | LOW | Dark mode contrast needs design review | Design tokens defined |
| C14-03 | LOW | EUC-KR HTML-as-XLS is very rare | Multi-encoding detection |
| C15-01 | LOW | Type escape is guarded by downstream null checks | Being fixed this cycle |

---

## Progress

- [x] C15-01: Fix `as unknown as` type escape in cards.ts AbortError path
