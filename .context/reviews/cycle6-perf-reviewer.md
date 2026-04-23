# Cycle 6 — perf-reviewer

## New findings this cycle

1. **(MEDIUM, High) C6UI-37 — SavingsComparison count-up rAF loop for 600ms per re-target.**
   `apps/web/src/components/dashboard/SavingsComparison.svelte:51-89` schedules up to 36 rAF frames, each writing two `$state` values. On low-end devices INP can spike >200ms during rapid reoptimize. Mitigation: 50ms debounce before starting the animation; cancel on `visibilitychange` hidden.

2. **(LOW, Medium) C6UI-36 — Home-page Stats bar inline `animation-fill-mode` + `opacity:0` hurts layout-stability profiling.**
   `index.astro:30-44`. Move starting opacity to a CSS class; add `contain: layout paint` to isolate LCP.

3. **(LOW, Low) CategoryBreakdown `$derived.by()` over assignments is complex.**
   `CategoryBreakdown.svelte:110-160` — Svelte 5 should not re-run this on `hoveredIndex` changes, but keep an eye on profiling.

4. **(LOW, Low) TransactionReview displayTxs re-derivation on every edit.**
   `TransactionReview.svelte:141-163`. Under 100+ transactions, ~5ms/edit filter+search. Deferred; only optimize if profiling shows regression.

## Confirmed already-fine
- `packages/core/src/optimizer/greedy.ts:127-149` — the push+pop avoidance (C68-02) is correctly applied, no regression.
