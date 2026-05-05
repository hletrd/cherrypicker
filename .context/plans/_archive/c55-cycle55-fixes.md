# Cycle 55 Implementation Plan

**Date:** 2026-04-21
**Source reviews:** `.context/reviews/2026-04-21-cycle55-comprehensive.md`, `.context/reviews/_aggregate.md`

---

## Findings to Address

### C55-02 (LOW, MEDIUM): `CardDetail.svelte` `rateColorClass` lacks dark mode contrast overrides

**File:** `apps/web/src/components/cards/CardDetail.svelte:30-35`
**Problem:** The `rateColorClass` function returns `text-green-600` and `text-blue-600` without dark mode overrides. In dark mode, these colors have poor contrast against dark backgrounds. Other parts of the same component have `dark:` variants (card type badges at lines 125-128, tier header at line 217), but the rate color classes are missing them.
**Fix:** Add `dark:text-green-400` and `dark:text-blue-400` to the rate color classes.
**Steps:**
1. Update `rateColorClass` function in `CardDetail.svelte` to add dark mode classes
2. Run all gates to confirm no regressions
3. Commit with message: `fix(web): 🐛 add dark mode contrast to CardDetail rate colors`

**Status:** COMPLETED -- commit 0000000b07a05584b16cce4fa44804b83c8c0ad2

### C55-05 (MEDIUM, HIGH): `SavingsComparison.svelte` count-up animation flickers "+0원" during sign transitions

**File:** `apps/web/src/components/dashboard/SavingsComparison.svelte:45-76,215`
**Problem:** When the savings target changes from positive to negative (or vice versa), the 600ms count-up animation passes through zero. At that moment, the sign prefix `displayedSavings >= 0 ? '+' : ''` shows "+0원", which is immediately replaced as the animation continues. This creates a brief visual flicker of "+0원" before settling on the correct value.
**Fix:** Suppress the '+' prefix when the value is exactly 0 during an animation that crosses zero. The simplest approach: change the sign prefix condition to skip '+' when `displayedSavings === 0` and the target is non-zero (animation in progress).
**Steps:**
1. Update the sign prefix logic at line 215 in `SavingsComparison.svelte` to not show '+' when `displayedSavings === 0`
2. Run all gates to confirm no regressions
3. Commit with message: `fix(web): 🐛 suppress +0원 flicker during SavingsComparison sign transitions`

**Status:** COMPLETED -- commit 000000012b9c40f54cfbb33b06f68bf5047d851a

---

## Deferred Findings (no action this cycle)

All prior deferred findings from the aggregate remain deferred. See `.context/reviews/_aggregate.md` for the complete list. No new findings are deferred this cycle beyond the existing backlog.

---

## Verification Plan

After implementing both fixes:
1. Run `bun run lint` -- expect 0 errors
2. Run `bun run typecheck` -- expect 0 errors
3. Run `bun test` -- expect all pass
4. Run `npx vitest run` -- expect all pass
