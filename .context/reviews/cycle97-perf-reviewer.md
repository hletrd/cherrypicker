# Cycle 97 — perf-reviewer pass

**Date:** 2026-04-23

## Scope

Re-examined hot paths touched in cycle 96 plus the full optimizer loop.

## Findings

None net-new.

## Hot-path notes

- `greedyOptimize` (greedy.ts:268-353) is O(n · m) where n = transactions and m = cards. For typical inputs (<2k tx, ~80 cards) this is <200k ops. The C68-02 in-place push/pop avoids temporary-array allocations.
- `calculateRewards` (reward.ts:185-383) is O(n) per call. `findRule` does a linear scan with secondary sort — bounded by O(rules²) in worst case, but rules per card are ~5-10 so negligible.
- `analyzer.ts:369/374` sort passes are O(n log n) and are called once per analyze. Adding a filter step (for C97-01 fix) is O(n) extra and negligible.

## Summary

No performance concerns this cycle. The fix proposed for C97-01 has no measurable perf impact.
