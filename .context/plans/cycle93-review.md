# Cycle 93 Plan -- ReportContent Svelte 5 {@const} Fix

## New Findings Addressed

### C93-01: `{@const}` inside `<td>` element causes Svelte 5 build failure (HIGH, HIGH confidence)

**File:** `ReportContent.svelte:83,118`

**Problem:** Two `{@const issuer = getIssuerFromCardId(...)}` declarations were placed inside `<td>` elements. Svelte 5 (used by Astro 6) requires `{@const}` to be a direct child of `{#snippet}`, `{#if}`, `{:else if}`, `{:else}`, `{#each}`, `{:then}`, `{:catch}`, `<svelte:fragment>`, `<svelte:boundary>`, or `<Component>`. Placing it inside a regular HTML element like `<td>` causes a build failure.

**Plan:** Move both `{@const}` declarations to be direct children of their parent `{#each}` blocks, placed before the `<tr>` element.

**Status:** **IMPLEMENTED AND VERIFIED** -- Build passes, all tests pass, all gates green.

---

## Previously Implemented Items (Verified This Cycle)

- C91-01: **CONFIRMED FIXED** -- Math.abs() applied unconditionally
- C93-01: **IMPLEMENTED** -- `{@const}` moved to valid Svelte 5 positions

---

## Deferred Findings

All prior deferred findings from cycle 92 remain deferred with the same severity and exit criteria. No new findings to defer this cycle beyond C93-01 which was fixed.

---

## Archived Plans (Fully Implemented)

All prior cycle plans through C92 have been fully implemented. The codebase is stable with no regressions.
