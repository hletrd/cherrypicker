# Cycle 19 Implementation Plan

## New Findings to Address

### C19-01 [MEDIUM] -- parseDateToISO triplicated across parsers
- **File:** `apps/web/src/lib/parser/csv.ts:29-101`, `xlsx.ts:184-272`, `pdf.ts:145-203`
- **Problem:** `parseDateToISO` is implemented three times with near-identical string-parsing logic. Unlike `inferYear` which was consolidated into `date-utils.ts` (C18-05 fix), `parseDateToISO` remains triplicated. The xlsx version accepts `unknown` (handles Excel serial dates as a first branch), while csv/pdf versions accept `string`. However, all string-parsing branches (YYYY-MM-DD, YYYYMMDD, YY-MM-DD, MM/DD, Korean dates) are identical across all three.
- **Fix:** Extract the string-parsing logic into a shared `parseDateStringToISO(raw: string)` function in `date-utils.ts`. Each parser keeps its own thin `parseDateToISO` wrapper:
  - `csv.ts` and `pdf.ts`: delegate directly to `parseDateStringToISO`
  - `xlsx.ts`: handle the `number` type (Excel serial date) first, then delegate string type to `parseDateStringToISO`, keep the fallback for other types
- **Risk:** Low -- pure refactoring, no behavior change. The string branches are already identical.

### C19-02 [MEDIUM] -- VisibilityToggle cleanup races with Astro client navigation
- **File:** `apps/web/src/components/ui/VisibilityToggle.svelte:26-78`
- **Problem:** The `$effect` cleanup function (lines 62-77) queries DOM elements by ID and resets them. With Astro's View Transitions or ClientRouter, the old VisibilityToggle's cleanup may run after new page elements are mounted. If the new page has elements with the same IDs (dashboard vs results), cleanup could reset the new page's elements.
- **Fix:** Guard the cleanup by checking that the elements still belong to this component instance. Use a `mounted` flag set in an `onMount` lifecycle and cleared on destroy, so cleanup only runs if the component is still mounted. Alternatively, use `AbortSignal` in the `$effect` return to detect if the component was unmounted (effect cleanup due to unmount vs re-run). The simplest approach: store references to the elements found during the effect body and only reset those exact references in cleanup, rather than re-querying by ID.
  - Replace `document.getElementById(...)` calls in cleanup with the same element references captured during the effect body
  - This ensures cleanup only affects elements that existed when the effect ran

### C19-03 [LOW] -- CardPage browser history not preserved for card detail views
- **File:** `apps/web/src/components/cards/CardPage.svelte:34,40`
- **Problem:** `goBack()` uses `history.replaceState` which strips the hash and doesn't add a history entry. The card detail view is not in browser history. User cannot use back button to return to a previously viewed card.
- **Fix:** Change `goBack()` to use `history.pushState` or simply set `window.location.hash = ''` (which does add a history entry). Also, consider using `history.back()` which is the most natural UX for "go back" semantics.
  - Replace `history.replaceState(null, '', window.location.pathname + window.location.search)` with `window.location.hash = ''`
  - This adds a history entry so the browser back button works correctly

### C19-04 + C19-05 [LOW] -- Full page reload navigation instead of client-side
- **File:** `apps/web/src/components/upload/FileDropzone.svelte:217`, `apps/web/src/components/cards/CardDetail.svelte:276`
- **Problem:** Both use `window.location.href = buildPageUrl(...)` causing full page reload. With Astro's ClientRouter, `navigate()` from `astro:transitions` would provide smoother transitions without discarding JS state.
- **Fix:** Import `navigate` from `astro:transitions/client` and use it instead of `window.location.href`. Add a fallback to `window.location.href` for when ClientRouter is not active (SSR, or if the import fails at build time). Note: `astro:transitions/client` is only available in client-side code, which is already the case for these Svelte components.
  - `FileDropzone.svelte:217`: replace `window.location.href = buildPageUrl('dashboard')` with `navigate(buildPageUrl('dashboard'))`
  - `CardDetail.svelte:276`: replace `window.location.href = buildPageUrl('cards')` with `navigate(buildPageUrl('cards'))`
  - Add try/catch fallback to `window.location.href` in case `navigate` is unavailable

### C19-06 [LOW] -- AMOUNT_PATTERNS regex misleading about decimal support
- **File:** `apps/web/src/lib/parser/csv.ts:141`
- **Problem:** `AMOUNT_PATTERNS[1]` (`/^-?[\d,]+\.?\d*원?$/`) matches decimal amounts but `parseAmount` uses `parseInt` which truncates decimals. The pattern is misleading.
- **Fix:** Tighten the regex to not match decimal amounts: change `/^-?[\d,]+\.?\d*원?$/` to `/^-?[\d,]+원?$/`. Korean Won amounts are always integers, so the decimal-matching pattern was incorrect. This also prevents false-positive amount detection for values like "3.5" which could be misidentified as amounts.

### C19-07 [LOW] -- isValidTx function name misleading
- **File:** `apps/web/src/lib/store.svelte.ts:139-150`
- **Problem:** `isValidTx` filters out zero-amount transactions (they're not valid for optimization), but the name `isValidTx` implies a general validity check. A developer might assume zero-amount entries like balance inquiries would pass.
- **Fix:** Rename to `isOptimizableTx` and add a JSDoc comment explaining that zero-amount transactions are excluded because they don't contribute to spending optimization. Update all call sites (currently only used in `loadFromStorage`).

## Implementation Order & Status

1. **C19-01** -- Extract `parseDateStringToISO` to `date-utils.ts` -- **DONE** (commit `0000000b99`)
2. **C19-02** -- Fix VisibilityToggle cleanup race -- **DONE** (commit `0000000a23`)
3. **C19-06** -- Tighten AMOUNT_PATTERNS regex -- **DONE** (commit `00000008c`)
4. **C19-03** -- Fix CardPage browser history -- **DONE** (commit `000000059f5`)
5. **C19-04 + C19-05** -- Replace window.location.href with Astro navigate -- **DEFERRED** (requires Astro ClientRouter / `<ClientRouter />` component in layout; project does not currently use View Transitions. Adding it is an architectural change beyond cycle scope.)
6. **C19-07** -- Rename isValidTx to isOptimizableTx -- **DONE** (commit `000000093de`)

## Deferred Items

- **C19-04 + C19-05**: `navigate()` from `astro:transitions/client` requires `<ClientRouter />` in the Astro layout. The project currently uses static output mode without View Transitions. Enabling ClientRouter is an architectural change that requires testing all pages for compatibility. Deferred until a dedicated cycle for View Transitions adoption.
- All prior deferred items from `00-deferred-items.md` remain unchanged.
