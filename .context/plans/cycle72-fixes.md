# Cycle 72 Implementation Plan

**Date:** 2026-04-21
**Source review:** `.context/reviews/2026-04-21-cycle72-comprehensive.md`

---

## Task 1: Fix handleRetry() not clearing navigateTimeout (C72-01)

**Severity:** MEDIUM / HIGH
**File:** `apps/web/src/components/upload/FileDropzone.svelte:259-262`
**Description:** When user clicks retry within 1200ms of success, the pending navigation timeout is not cleared, causing unexpected dashboard navigation.
**Fix:** Add `clearTimeout(navigateTimeout)` to `handleRetry()`.

## Task 2: Guard cachedCoreRules against empty array from AbortError (C72-02)

**Severity:** MEDIUM / HIGH
**File:** `apps/web/src/lib/analyzer.ts:181-184`
**Description:** `cachedCoreRules` is permanently poisoned with `[]` when `getAllCardRules()` returns empty on AbortError. All subsequent optimizations produce 0 rewards.
**Fix:** Before caching, check if `allCardRules.length === 0`. If so, set `cachedCoreRules = null` instead of `[]` so the next call retries.

## Task 3: Guard getCategoryLabels() against empty categories from AbortError (C72-03)

**Severity:** LOW / MEDIUM
**File:** `apps/web/src/lib/store.svelte.ts:332-337`
**Description:** `getCategoryLabels()` caches an empty Map when `loadCategories()` returns `[]` on AbortError, causing Korean labels to be replaced with English keys permanently.
**Fix:** Only cache the result if `nodes.length > 0`.

## Task 4: Show all error categories simultaneously in addFiles() (C72-04)

**Severity:** LOW / HIGH
**File:** `apps/web/src/components/upload/FileDropzone.svelte:160-169`
**Description:** `addFiles()` shows only the first error type when multiple occur (oversized, invalid format, duplicate). User must retry multiple times.
**Fix:** Collect all error messages and display them together.

## Task 5: Fix loadCategories() AbortController race (C72-05)

**Severity:** LOW / MEDIUM
**File:** `apps/web/src/lib/cards.ts:193-233, 235-268`
**Description:** When an in-flight fetch is aborted and a new one starts, the second caller awaiting the old promise receives `[]` instead of the new fetch result.
**Fix:** After resetting the cache on abort, return the NEW `categoriesPromise`/`cardsPromise` instead of the one captured at the start of the function. Refactor to always return the latest promise reference.

---

## Deferred Findings

All previously deferred findings (D-01 through D-111) remain unchanged from prior cycles. No new findings are deferred this cycle -- all 5 findings are scheduled for implementation above.

---

## Progress Tracking

| Task | Status | Commit |
|---|---|---|
| 1: handleRetry clearTimeout | PENDING | |
| 2: cachedCoreRules empty guard | PENDING | |
| 3: getCategoryLabels empty guard | PENDING | |
| 4: addFiles combined errors | PENDING | |
| 5: AbortController race fix | PENDING | |
