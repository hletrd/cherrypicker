# Cycle 8 — debugger

## Inventory

Runtime paths that have historically been flaky:
- upload → dashboard (resolved cycle 7 via C7-E01).
- TransactionReview refresh (resolved cycle 7 via C7-01).
- bank-pill 더보기 toggle (stable post-cycle 7).

## Re-audit of resolved issues

No repro of D6-01 (t.trim) after C7-E01's widened `parsePreviousSpending` signature. Verified by reading current `parsePreviousSpending`:
```
function parsePreviousSpending(raw: unknown): number | undefined {
  if (raw === undefined || raw === null || raw === '') return undefined;
  if (typeof raw === 'number') { ... }  // handles number bind
  if (typeof raw !== 'string') return undefined;
  const v = raw.trim();  // only called after string guard — safe
  ...
}
```
Correct. D6-01 resolved.

No repro of D6-02 (feature-card strict-mode collision) — testids present at `index.astro`.

## New debug findings

### DBG8-01 — potential `navigateTimeout` stacking under double-click race (D7-M3)

- File: `FileDropzone.svelte:276`
- Setup: `handleUpload` sets uploadStatus='uploading'. Button is disabled by `disabled={uploadedFiles.length === 0 || uploadStatus === 'uploading' || uploadStatus === 'success'}`. Under normal UI flow, double-click is blocked.
- Race: if `uploadedFiles.length === 0` transitions to `> 0` AND user clicks faster than the next microtask, a double-invocation is possible. Svelte 5 reactivity defers DOM updates one microtask.
- Impact: low — two timers fire, both trigger `navigate(...)`. Second `navigate` after first lands is a no-op on already-changed URL.
- Fix: add `if (navigateTimeout) { clearTimeout(navigateTimeout); navigateTimeout = null; }` before reassigning at line 276.
- Actionable this cycle. 1-line defensive.

### DBG8-02 — no repro of `generation` desync after cycle-7 fix

- `generation` initialized to 1 when loaded from sessionStorage, 0 otherwise. `TransactionReview` sync effect triggers correctly.
- Verified by reading lines 356-361. No repro.

## No new HIGH-severity debug findings.
