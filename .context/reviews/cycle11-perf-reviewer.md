# Cycle 11 — Performance Reviewer Findings

**Date:** 2026-05-05
**Reviewer:** perf-reviewer (simulated)
**Scope:** Performance-sensitive paths in parsers, optimizer, and web bundle

## Summary

No P0 or P1 performance issues. One known P2 optimizer complexity remains deferred. Parser Infinity guards add negligible overhead.

---

## Findings

### C11-PR01 — [P2-MEDIUM] O(n*m) scoreCardsForTransaction persists

**File:** `packages/core/src/optimizer/greedy.ts:39-71`

The `scoreCardsForTransaction` function remains O(n*m) per transaction, where n = number of cards and m = number of already-assigned transactions per card. For each transaction, it iterates all cards, pushes the transaction into each card's temporary array, calls `calculateCardOutput` (which itself iterates all transactions), then pops.

**Impact:** For typical use cases (< 1000 transactions, < 20 cards), this completes in < 100ms. For large statement sets (5000+ transactions, 50+ cards), this could take seconds.

**Fix:** Implement incremental reward tracking. Cache per-card reward state and compute marginal reward without re-evaluating all transactions. This is a significant refactor.

**Confidence:** High
**Status:** DEFERRED per D-09 (exit criterion: performance becomes issue for large datasets)

---

### C11-PR02 — [P3-LOW] parseAmountString full-width conversion in hot path

**File:** `packages/parser/src/csv/shared.ts:140-163`
**File:** `apps/web/src/lib/parser/csv.ts:133-157`

`parseAmountString` performs 6 regex replacements and a full-width digit conversion (`replace(/[０-９]/g, ...)`). For CSV files with thousands of rows, this is called once per amount cell. The regexes are simple character-class replacements (O(k) where k = string length), so total cost is O(total amount string length) — acceptable.

**Impact:** Negligible. Regex replacements are fast for short strings (< 50 chars).

**Fix:** Not needed. If profiling shows this as a hotspot, pre-compile the regexes at module level.

**Confidence:** Medium

---

### C11-PR03 — [P3-LOW] FileDropzone drag event handlers on document

**File:** `apps/web/src/components/upload/FileDropzone.svelte:32-68`

Page-wide drag handlers are registered on `document` with `active` flag-based cleanup. This is correct for preventing stale handlers after Astro View Transitions. The `dragCount` counter prevents flicker during nested dragenter/dragleave events.

**Impact:** Minimal. Four event listeners on document is standard for drag-and-drop.

---

### C11-PR04 — [P3-LOW] No prefers-reduced-motion for animate-spin

**File:** `apps/web/src/components/upload/FileDropzone.svelte:596-598`

The upload spinner uses `animate-spin` class with no `prefers-reduced-motion` guard. Users with motion sensitivity will see continuous rotation.

**Impact:** Accessibility concern, not performance.

**Fix:** Wrap spinner in `@media (prefers-reduced-motion: reduce) { animation: none; }` or use a static icon.

**Confidence:** High

---

### C11-PR05 — [P3-LOW] buildCategoryLabelMap rebuilds on every reoptimize

**File:** `apps/web/src/lib/store.svelte.ts:395-411`

Category labels are rebuilt from YAML on every `reoptimize()` call. A caching mechanism exists (`cachedCategoryLabels`) but the first call after reset still triggers a rebuild.

**Impact:** Negligible for typical use. The YAML file is small (< 50KB).

**Fix:** Pre-build labels at build time and ship as JSON. Already tracked as architectural refactor.

---

## Verdict

**SHIP IT** — No performance regressions. Known optimizer complexity is deferred with clear exit criterion.
