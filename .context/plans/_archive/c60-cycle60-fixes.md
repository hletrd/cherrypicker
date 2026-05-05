# Cycle 60 Implementation Plan

**Date:** 2026-04-21
**Source reviews:** `.context/reviews/2026-04-21-cycle60-comprehensive.md`, `.context/reviews/_aggregate.md`

---

## Findings to Address

### C60-01 (LOW, MEDIUM): `CardGrid.svelte` availableIssuers derived from filteredCards creates reactive dependency cycle

**File:** `apps/web/src/components/cards/CardGrid.svelte:22,27-31`
**Problem:** `availableIssuers` at line 22 is derived from `filteredCards`, but `filteredCards` depends on `issuerFilter`. The `$effect` at line 27 resets `issuerFilter` when the selected issuer is no longer in `availableIssuers` after a type filter change. This creates a reactive cycle: typeFilter change -> filteredCards recompute -> availableIssuers recompute -> $effect may reset issuerFilter -> filteredCards recompute again. The double computation is wasteful and the ordering dependency is fragile.

**Fix:** Derive `availableIssuers` from the raw `cards` array filtered by type only (not by issuer or search), so it doesn't depend on `filteredCards`:

```ts
let availableIssuers = $derived.by(() => {
  let filtered = cards.slice();
  if (typeFilter === 'credit') filtered = filtered.filter(c => c.type === 'credit');
  else if (typeFilter === 'check') filtered = filtered.filter(c => c.type === 'check');
  else if (typeFilter === 'prepaid') filtered = filtered.filter(c => c.type === 'prepaid');
  return [...new Set(filtered.map(c => c.issuer))].sort();
});
```

**Steps:**
1. ~~Update `CardGrid.svelte` to derive `availableIssuers` from type-filtered cards only~~ DONE
2. ~~Run all gates to confirm no regressions~~ DONE (tsc PASS, vitest 189 pass, bun test 57 pass)
3. ~~Commit with message: `fix(cards): 🐛 break reactive cycle between availableIssuers and filteredCards`~~ DONE (commit 0000000f)

---

## Deferred Findings (no action this cycle)

| Finding | Severity | Confidence | Reason for deferral |
|---|---|---|---|
| C60-02 | LOW | LOW | Print stylesheet dark-mode inline style reset is a minor visual polish issue. The forced `background: #fff` and `color: #000` already ensures basic print readability. The edge case (issuer badge colors in print) is cosmetic and rarely noticed by users. |
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
