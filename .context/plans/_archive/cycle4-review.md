# Cycle 4 Plan -- 2026-04-22

## Review Summary

Cycle 4 comprehensive review re-read all source files, performed grep sweeps for security/quality patterns, and verified all prior cycle fixes. Two previously-open LOW findings (C92-01, C94-01) are now confirmed FIXED via the centralized `formatSavingsValue()` helper.

**New findings this cycle:** 1 LOW (C4-01: bare catch blocks in expected-failure contexts)

**No new HIGH or MEDIUM findings. No implementation work required this cycle.**

---

## New Findings Addressed

None. No actionable fixes required this cycle.

---

## Verification of Prior Fixes

| Finding | Status |
|---|---|
| C92-01 (savings sign-prefix triplication) | **FIXED** -- `formatSavingsValue()` centralized in formatters.ts |
| C94-01 (conditional vs unconditional Math.abs) | **FIXED** -- `formatSavingsValue()` uses unconditional `Math.abs()` |

---

## New Finding: Deferred

### C4-01: 7 bare `catch {}` blocks across codebase (LOW, LOW confidence)

**Files:** `store.svelte.ts:318`, `FileDropzone.svelte:257`, `SpendingSummary.svelte:37`, `CardDetail.svelte:32,286`, `TransactionReview.svelte:104`, `parser/index.ts:41`

**Problem:** Bare `catch {}` silently swallows errors. However, all 7 instances are in expected-failure contexts (sessionStorage access in SSR/sandboxed environments, Astro navigation fallbacks, parser format probing). This is a deliberate pattern in the codebase, not a bug.

**Reason for deferral:** All instances handle expected DOMException/SecurityError in SSR or sandboxed environments where the failure is acceptable. Adding explicit error guards would add complexity without catching real bugs. The pattern is consistent and well-understood across 90+ review cycles.

**Exit criterion:** A bare catch causes a user-visible bug (e.g., a real error is silently swallowed, causing incorrect behavior rather than a graceful fallback).

---

## All Prior Deferred Items (Unchanged)

All deferred items from cycle 94 remain deferred with the same severity and exit criteria:

| Finding | Severity | Exit Criterion |
|---|---|---|
| MerchantMatcher O(n) scan (C33-01) | MEDIUM | Performance bottleneck becomes measurable in profiling; user-reported latency |
| cachedCategoryLabels staleness (C21-02) | MEDIUM | User reports stale labels after redeployment |
| Greedy optimizer O(m*n*k) (C67-01) | MEDIUM | User-reported timeout with large card sets |
| No integration test for multi-file upload (C86-16) | MEDIUM | Manual QA failure or regression in multi-file path |
| loadCategories empty on AbortError (C41-05) | MEDIUM | User reports empty dropdowns after navigation |
| BANK_SIGNATURES duplication (C7-07) | LOW | New bank added and only one location updated |
| CATEGORY_NAMES_KO drift (C64-03) | LOW | YAML taxonomy update breaks CLI display |
| VisibilityToggle DOM mutation (C18-01) | LOW | Svelte 5 deprecates direct DOM manipulation in effects |
| Annual savings *12 projection (C77-02) | LOW | User reports misleading projection (transparently labeled) |
| Mobile menu focus trap (C86-13) | LOW | Accessibility audit finding |
| KakaoBank badge contrast (C90-02) | LOW | Accessibility audit finding |
| All other LOW items from aggregate | LOW | Per-item exit criteria in aggregate |
| C4-01: bare catch blocks | LOW | A bare catch causes a user-visible bug |

---

## Archived Plans (Fully Implemented)

All prior cycle plans through C94 have been fully implemented. C92-01 and C94-01 were the last implemented items. The codebase is stable with no regressions.
