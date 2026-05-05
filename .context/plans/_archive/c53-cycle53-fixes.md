# Plan: Cycle 53 Fixes

**Date:** 2026-04-21
**Source reviews:** `.context/reviews/2026-04-21-cycle53-comprehensive.md`, `.context/reviews/_aggregate.md`

---

## Tasks

### 1. [MEDIUM] Fix OptimalCardMap expandedRows Set mutation for reliable Svelte 5 reactivity (C54-03)

**File:** `apps/web/src/components/dashboard/OptimalCardMap.svelte:37-43`
**Problem:** The `toggleRow` function directly mutates a `$state` Set via `.add()` and `.delete()`. While Svelte 5's proxy-based reactivity can track some Set mutations, this is fragile and may not reliably trigger re-renders in all code paths. The immutable Set pattern is more robust.
**Fix:** Replace with immutable Set pattern:
```ts
function toggleRow(category: string) {
  expandedRows = expandedRows.has(category)
    ? new Set([...expandedRows].filter(c => c !== category))
    : new Set([...expandedRows, category]);
}
```
**Status:** DONE

### 2. [LOW] Remove duplicate stat population from results.js (C54-01)

**File:** `apps/web/public/scripts/results.js:1-38`
**Problem:** `results.js` duplicates stat population logic that `VisibilityToggle.svelte` already handles from the reactive store. The inline script reads from `sessionStorage` while the Svelte island reads from the store, creating a split-brain that can briefly show stale data after reoptimize + page reload.
**Fix:** Remove the stat-population code from `results.js`, keeping only the visibility toggle logic (matching the pattern in `dashboard.js`). The `VisibilityToggle` Svelte island handles both visibility and stat population from the store:
```js
document.addEventListener('DOMContentLoaded', () => {
  try {
    const raw = sessionStorage.getItem('cherrypicker:analysis');
    if (raw) {
      const data = JSON.parse(raw);
      if (data.optimization) {
        const emptyState = document.getElementById('results-empty-state');
        const dataContent = document.getElementById('results-data-content');
        if (emptyState) emptyState.classList.add('hidden');
        if (dataContent) dataContent.classList.remove('hidden');
      }
    }
  } catch {
    // Ignore malformed persisted state.
  }
});
```
**Status:** DONE

### 3. [LOW] Remove duplicate visibility toggle from dashboard.js (C54-02)

**File:** `apps/web/public/scripts/dashboard.js:1-16`
**Problem:** `dashboard.js` visibility toggle races with `VisibilityToggle.svelte`. Both toggle `hidden` class on the same elements. The inline script reads from `sessionStorage`, the Svelte island reads from the store. After a store reset + browser back navigation, the inline script may briefly show data content before VisibilityToggle hydrates.
**Fix:** Remove `dashboard.js` entirely since `VisibilityToggle.svelte` on the dashboard page handles both visibility and stat population. The inline script is redundant. This also eliminates the `dashboard.js` script tag from `dashboard.astro` (if it exists) or makes it a no-op.

Wait -- checking: `dashboard.astro` does not have a `<script is:inline src="...dashboard.js">` tag. The `dashboard.js` file is loaded globally via a mechanism I need to verify. Let me check if there's a reference in Layout.astro or another layout file.

Actually, reviewing the codebase, `dashboard.js` is in `public/scripts/` but is NOT referenced from any `.astro` page. It was likely left over from an earlier architecture. It's dead code. The fix is simply to delete `dashboard.js`.
**Status:** DONE

---

## Deferred Items (not implemented this cycle)

| Finding | Reason for deferral | Exit criterion |
|---|---|---|
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
| D-106 | LOW severity; bare catch now logs diagnostic console.warn; further narrowing is defensive improvement | PDF parser error handling refactor |
| D-110 | LOW severity; by design -- optimization only applies to latest month | Multi-month optimization feature |
| C18-01/C50-08 | LOW severity; VisibilityToggle DOM mutation works correctly; Svelte island lifecycle is self-managing | Svelte architecture change (portals/teleports) |
| C18-02 | LOW severity; stat element queries are cached; performance impact is negligible | VisibilityToggle refactor to Svelte-only rendering |
| C18-03 | LOW severity; "약" and "최근 월 기준 단순 연환산" caveats are present | UX review recommends different label |
| C18-04 | LOW severity; 512 bytes is sufficient for all known HTML-as-XLS exports | XLSX parser refactor |
| C19-04 | LOW severity; full page reload works correctly with sessionStorage | Astro client-side navigation integration |
| C19-05 | LOW severity; same as C19-04 | Same as C19-04 |
| C21-02 | LOW severity; theoretical race; JavaScript single-threading makes it extremely unlikely | If stale data loading is reported |
| C21-04/C23-02/C25-02/C26-03 | LOW->MEDIUM severity; caches are correct within a session; stale only across redeployments in long-lived tabs | Dynamic cache invalidation |
| C22-04 | LOW severity; generic CSV parser handles most formats; dedicated adapters require real samples | Bank adapter sprint |
| C33-01 | MEDIUM severity; partially addressed; full optimization requires trie-based prefix index | If categorization latency becomes noticeable |
| C33-02 | MEDIUM severity; same as C21-04 | Same as C21-04 |
| C34-04 | LOW severity; server-side PDF is a separate code path | Server-side parser rewrite |
| C41-05/C42-04 | LOW severity; returning empty array is correct behavior for aborted requests | If users report missing categories after abort |
| C49-01 | LOW severity; dead code; removal requires verifying no callers | Code cleanup sprint |
| C7-04 | LOW severity; $effect re-sync works in practice; fragile if generation counter is not properly incremented | If re-sync bugs are reported |
| C7-06 | LOW severity; by design; optimization only applies to latest month | Multi-month optimization feature |
| C7-07 | LOW severity; same as D-01/D-57; requires architectural refactor | Shared parser module |
| C7-11 | LOW severity; persistWarning messages are functional; clarity improvement is UX | If users report confusion about warning messages |
| C8-05/C4-09 | LOW severity; same as C52-05/C4-09 | Same as C52-05 |
| C8-07/C4-14 | LOW severity; same as C52-04/C4-14 | Same as C52-04 |
| C8-08 | LOW severity; timezone-dependent; affects only minutes around midnight on Dec 31 | If date parsing errors are reported near year boundary |
| C8-09 | LOW severity; test duplication is a code quality concern, not a correctness issue | Test architecture refactor |
