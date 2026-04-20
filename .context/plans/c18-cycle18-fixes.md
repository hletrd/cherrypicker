# Cycle 18 Implementation Plan

## New Findings to Address

### C18-01 [MEDIUM] — VisibilityToggle $effect directly mutates DOM without cleanup
- **File:** `apps/web/src/components/ui/VisibilityToggle.svelte:22-51`
- **Problem:** The `$effect` uses `document.getElementById` + `classList.toggle` + `textContent = ...` to manage visibility of Astro-rendered containers. This is an anti-pattern because: (1) no cleanup on store reset — if data is cleared, containers stay visible; (2) no compile-time check on element IDs — renaming an ID in the Astro template silently breaks the component; (3) runs on every store change regardless of which page is mounted.
- **Fix:** Add a cleanup function to the `$effect` that hides the data content and shows the empty state when the store is reset. Also, guard the stat-element population to only run when those elements exist (they only exist on the results page). The effect already reads `analysisStore.result?.optimization`, so the trigger is correct — we just need cleanup logic.
  - When `hasData` becomes false (store reset), toggle `dataEl` hidden and `emptyEl` visible
  - The stat-element writes are already guarded by `if (totalSpending)` etc., but we should also reset them to "—" on cleanup

### C18-02 [LOW] — Wasted DOM queries in VisibilityToggle on non-results pages
- **File:** `apps/web/src/components/ui/VisibilityToggle.svelte:36-49`
- **Problem:** `document.getElementById('stat-total-spending')` etc. are queried every time the effect runs, even on the dashboard page where these elements don't exist. The null checks prevent crashes but the queries are still wasted.
- **Fix:** Cache the element references on first lookup (or use a flag to skip stat population when the elements aren't found). Since `document.getElementById` returns `null` quickly for non-existent IDs, the performance impact is minimal, but adding an early return when no stat elements exist avoids unnecessary work. Merge with C18-01 fix.

### C18-03 [LOW] — Annual savings projection lacks nuance
- **File:** `apps/web/src/components/dashboard/SavingsComparison.svelte:207`
- **Problem:** Text says "연간 약 ... 절약 (최근 월 기준)" — simple monthly x12 projection. The qualifier is present but the projection could mislead.
- **Fix:** Change the qualifier to be more explicit: "최근 월 기준 단순 연환산" (simple annualized based on latest month). This makes it clear it's a straight multiplication, not a forecast. Minimal text change, no logic change.

### C18-04 [LOW] — isHTMLContent BOM/encoding edge case
- **File:** `apps/web/src/lib/parser/xlsx.ts:314-317`
- **Problem:** `isHTMLContent()` decodes first 512 bytes as UTF-8. A UTF-8 BOM consumes 3 bytes; EUC-KR encoded files would fail detection.
- **Fix:** Strip UTF-8 BOM before checking the content. Add `head.replace(/^\uFEFF/, '')` before the startsWith checks. EUC-KR is a known limitation but far less common for .xls exports from Korean card companies (which use UTF-8 or UTF-8 BOM). Document the EUC-KR limitation in a comment.

### C18-05 [LOW] — inferYear() triplicated across parsers
- **File:** `csv.ts:29-37`, `xlsx.ts:183-190`, `pdf.ts:144-151`
- **Problem:** Identical `inferYear()` function implemented three times. Any fix must be applied in three places.
- **Fix:** Extract `inferYear` to a shared utility in `apps/web/src/lib/parser/date-utils.ts` and import it from all three parsers. This also makes C8-08 (timezone fix) easier to implement in the future since the fix only needs to be applied once.

## Implementation Order

1. **C18-05** — Extract `inferYear` to shared utility (foundational — other date fixes depend on it)
2. **C18-01 + C18-02** — Fix VisibilityToggle cleanup and optimize DOM queries (combined, same file)
3. **C18-04** — isHTMLContent BOM handling (small targeted fix)
4. **C18-03** — Annual savings text clarification (trivial text change)

## Deferred Items

All prior deferred items from `00-deferred-items.md` remain unchanged. No new deferrals this cycle.
