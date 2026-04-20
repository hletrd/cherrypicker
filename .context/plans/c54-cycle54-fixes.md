# Cycle 54 Implementation Plan

**Date:** 2026-04-21
**Source reviews:** `.context/reviews/2026-04-21-cycle54-comprehensive.md`, `.context/reviews/_aggregate.md`

---

## Findings to Address

### C54-01 (LOW, HIGH): Remove split-brain visibility toggle from `results.js`

**File:** `apps/web/public/scripts/results.js:1-22`
**Problem:** The `results.js` inline script reads from `sessionStorage` and toggles visibility of `results-data-content` and `results-empty-state`. This is redundant with `VisibilityToggle.svelte` which reads from the reactive store. After a store reset + browser back navigation, the inline script may briefly show data content while the store has no data.
**Fix:** Remove the entire visibility toggle logic from `results.js`. The `VisibilityToggle.svelte` component already handles both visibility and stat population from the reactive store. After removing the inline script's visibility code, `results.js` becomes empty and should be deleted entirely (since it no longer serves any purpose).
**Steps:**
1. Delete `apps/web/public/scripts/results.js` entirely
2. Verify `results.astro` does not reference `results.js` (it should not -- the page uses VisibilityToggle.svelte)
3. Run all gates to confirm no regressions
4. Commit with message: `fix(web): 🐛 remove split-brain visibility toggle from results.js`

### C54-02: CLOSED (False Positive)

No `dashboard.js` exists in `public/scripts/`. The finding was based on incorrect assumptions about the file structure. No action needed.

### C54-03: Already Fixed

`OptimalCardMap.svelte:37-44` already uses the immutable Set pattern. No action needed.

---

## Deferred Findings (no action this cycle)

All prior deferred findings from the aggregate remain deferred. See `.context/reviews/_aggregate.md` for the complete list. No new findings are deferred this cycle beyond the existing backlog.

---

## Verification Plan

After implementing C54-01:
1. Run `bun run lint` -- expect 0 errors
2. Run `bun run typecheck` -- expect 0 errors
3. Run `bun test` -- expect all pass
4. Run `npx vitest run` -- expect all pass
5. Verify `results.astro` does not reference `results.js` via grep
