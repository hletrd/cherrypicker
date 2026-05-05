# Cycle 7 Performance Review

**Date:** 2026-05-05
**Scope:** CPU, memory, I/O efficiency in parser and core
**Reviewer:** perf-reviewer

---

## Summary

No new performance regressions in Cycle 6 fixes. LRU cache for MerchantMatcher (Cycle 5) remains effective. One minor inefficiency identified in web-side HTML parser.

---

## LOW

### P7-PERF-01: Web-side HTML parser forward-fill creates many intermediate strings

**File:** `apps/web/src/lib/parser/html.ts:151-202`
**Confidence:** Low

Each row iteration creates multiple intermediate strings via `String(rawXxxValue)` and `String(...).trim()`. For large HTML statements (1000+ rows), this creates unnecessary GC pressure. The server-side equivalent has the same pattern.

**Impact:** Minor — only affects very large statements.

**Fix:** Cache `String(value)` results or use a single-pass string builder.

### P7-PERF-02: `FALLBACK_CATEGORY_LABELS` eagerly constructs 78-entry Map at module load

**File:** `apps/web/src/lib/category-labels.ts:25-103`
**Confidence:** Low

The fallback Map is constructed at module evaluation time even though it's rarely used (only when categories.json fetch fails). This adds ~1-2ms to initial bundle evaluation.

**Fix:** Use a lazy initialization pattern or generate at build time.

---

## Verified Improvements

| Improvement | Commit | Impact |
|-------------|--------|--------|
| MerchantMatcher LRU cache | `f7adfe8` | O(n*m) → O(1) average lookup |
| Eliminated double file read | `3f27b9d` | Reduced I/O for CSV detection |
| Hoisted keyword Sets | `cedeb07` | Reduced per-call allocation |
