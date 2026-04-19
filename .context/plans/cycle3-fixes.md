# Cycle 3 Implementation Plan

**Date:** 2026-04-19
**Source:** `.context/reviews/2026-04-19-cycle3-comprehensive.md`

---

## Task 1: Pass `categoryLabels` to `buildConstraints` in CLI report command

- **Finding:** C3-M01
- **Severity:** MEDIUM (incorrect output)
- **Confidence:** High
- **Files:** `tools/cli/src/commands/report.ts:136`
- **Description:** The CLI `runReport` command builds a `categoryLabels` Map at lines 91-103 and passes it to `generateHTMLReport()` and `printOptimizationResult()`, but does not pass it to `buildConstraints()`. This means the `OptimizationConstraints` object has `categoryLabels` as `undefined`, and when `greedyOptimize` calls `buildCardResults`, the `categoryLabels` parameter is also `undefined`. The `cardResults.byCategory[].categoryNameKo` values in the CLI report use `CATEGORY_NAMES_KO` static fallback instead of the taxonomy-derived labels.
- **Fix:** Add `categoryLabels` as the third argument to `buildConstraints` at `report.ts:136`:
  ```typescript
  const constraints = buildConstraints(categorized, cardPreviousSpending, categoryLabels);
  ```
- **Verification:** Run `bun test` and `bun run build` to ensure no regressions. The CLI report's card comparison section should now use taxonomy-derived Korean labels for `byCategory[].categoryNameKo`.
- **Status:** DONE

---

## Task 2: Add NaN validation for `--prev-spending` CLI argument

- **Finding:** C3-L01
- **Severity:** LOW (input validation)
- **Confidence:** High
- **Files:** `tools/cli/src/commands/report.ts:50`
- **Description:** The `--prev-spending` CLI argument is parsed with `parseInt(args[i + 1]!, 10)` without checking for NaN. If the user passes a non-numeric value, the optimizer produces 0 rewards with no error message.
- **Fix:** Add a NaN check after `parseInt` and throw an error with a clear Korean message:
  ```typescript
  prevSpending = parseInt(args[i + 1]!, 10);
  if (Number.isNaN(prevSpending) || prevSpending < 0) {
    throw new Error(`전월실적은 0 이상의 숫자여야 합니다: ${args[i + 1]}`);
  }
  ```
- **Verification:** Run `bun test` and verify that passing `--prev-spending abc` throws an error with the expected message.
- **Status:** DONE

---

## Task 3: Add shallow validation of `cardResults` entries in `loadFromStorage`

- **Finding:** C3-M02
- **Severity:** MEDIUM (correctness)
- **Confidence:** Medium
- **Files:** `apps/web/src/lib/store.svelte.ts:159-213`
- **Description:** `loadFromStorage` validates the top-level `optimization` object but does not validate `cardResults` entries. If any `cardResults` entry has malformed nested data (e.g., `byCategory` as a string instead of an array), the dashboard components will crash with an uncaught TypeError. This extends D-91 by providing the triggering scenario (malformed cardResults causes rendering errors).
- **Fix:** Add a minimal validation check for `cardResults` in `loadFromStorage`: verify it's an array and each entry has `cardId` (string), `totalReward` (number), and `byCategory` (array). If validation fails, strip the invalid entries or set `optimization` to null.
- **Verification:** Run `bun test` and `bun run build`. Manually test by corrupting `cardResults` in sessionStorage and verifying the dashboard degrades gracefully.
- **Status:** DONE

---

## Deferred Items

C3-L02 (`getCardById` O(n) scan) is deferred to `.context/plans/00-deferred-items.md` per the same class as D-09/D-51 (performance at scale). With 683 cards, the linear scan takes < 1ms and is not a bottleneck.

---

## Prior Deferred Items (carried forward)

No changes to prior deferred items (D-106, D-107, D-110, etc.). See `.context/plans/00-deferred-items.md` for the full list.
