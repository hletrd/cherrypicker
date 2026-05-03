# Cycle 2 — perf-reviewer pass

**Date:** 2026-05-03

## Scope

Performance, concurrency, CPU/memory/UI responsiveness.

## Findings

### C2-P01: C1-P01 fix verified — XLSX parser no longer creates TextEncoder copy

- **Severity:** N/A (verification)
- **File+line:** `apps/web/src/lib/parser/xlsx.ts:299-301`
- **Description:** The XLSX parser now uses `XLSX.read(html, { type: 'string' })` instead of `new TextEncoder().encode(html)`. Eliminates second full copy in memory. Verified in place.
- **Status:** FIXED.

### C2-P02: Build still produces chunk > 500 KB warning (re-confirmed from C1-P02)

- **Severity:** LOW
- **Confidence:** High
- **File+line:** Vite build output
- **Description:** The Astro build produces a warning about large chunks. The xlsx library is likely the primary contributor.
- **Fix:** Consider code-splitting the XLSX parser via dynamic import.

### C2-P03: `scoreCardsForTransaction` double-computes `calculateCardOutput` per card per transaction (re-confirmed from C2-R04)

- **Severity:** LOW
- **Confidence:** High
- **File+line:** `packages/core/src/optimizer/greedy.ts:136-142`
- **Description:** Each call computes `calculateCardOutput` twice per card. Practical impact limited (typical inputs: 3-5 cards, <500 transactions).
- **Fix:** Consider incremental delta computation.

## Summary

1 fix verified (C1-P01). 2 re-confirmed LOW findings. 0 net-new actionable findings.
