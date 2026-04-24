# Cycle 3 — Performance Reviewer

**Date:** 2026-04-24
**Reviewer:** perf-reviewer
**Scope:** Full repository

---

## C3-P01: `ALL_KEYWORDS` spread merge re-creates object on every module load — negligible but documented

- **Severity:** LOW
- **Confidence:** High
- **File+line:** `packages/core/src/categorizer/matcher.ts:8-13`
- **Description:** The `ALL_KEYWORDS` record is created by spreading four large keyword maps (~9000 entries in MERCHANT_KEYWORDS, ~1800 in ENGLISH_KEYWORDS, ~1000+ in LOCATION_KEYWORDS, ~500+ in NICHE_KEYWORDS). This happens once at module load time and is not a runtime concern. The `SUBSTRING_SAFE_ENTRIES` pre-computation at line 18 also filters and converts once. No performance issue in practice.
- **Failure scenario:** N/A — one-time initialization cost.
- **Fix:** No fix needed. Documenting for completeness.

## C3-P02: `calculateRewards` iterates `performanceTiers` per-card without early termination

- **Severity:** LOW
- **Confidence:** Low
- **File+line:** `packages/core/src/calculator/reward.ts:12-22`
- **Description:** `selectTier` filters all performance tiers to find qualifying ones, then reduces to find the highest. If tiers are sorted by minSpending descending, the filter could break early on the first qualifying tier. With typical tier counts (2-5), this is negligible. The `reduce` at line 21 also scans all qualifying tiers. Both are O(n) where n is typically < 5.
- **Failure scenario:** N/A — negligible cost.
- **Fix:** No fix needed at current scale. If tiers grow to > 100, consider sorting and early break.

---

## Final Sweep

All performance-sensitive paths (optimizer greedy loop, keyword matching, CSV/XLSX parsing) have been previously optimized (C68-02 push/pop, C33-01 precomputed entries, C1-02 line limit). No new performance regressions found.

No HIGH or MEDIUM performance findings this cycle.
