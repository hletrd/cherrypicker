# Cycle 34 — Code Reviewer Findings

**Date:** 2026-05-06
**Scope:** Full repo re-review focusing on previously unfixed items + new issues

---

## Verified Fixed (since C33)

- **C33-F5** `getCalcFn` default: Now throws `Error` for unknown types (`reward.ts:110`). Test at `calculator.test.ts:775` confirms.
- **C33-F6** Type assertions in `store.svelte.ts`: All `as Record<string, unknown>` casts replaced with `isPlainObject()` runtime guards.
- **C33-F10** `previousMonthSpending` negative: `parsePreviousSpending()` in `FileDropzone.svelte:292-313` rejects negative values and coerces -0.
- **C33-F12** Missing calc default test: Covered at `calculator.test.ts:775`.

---

## New Finding: N1 — Silent Reward Type Fallback (MEDIUM / High confidence)

- **File:** `apps/web/src/lib/analyzer.ts:71-73`
- **Code:**
  ```ts
  type: VALID_REWARD_TYPES.has(r.type)
    ? (r.type as 'discount' | 'points' | 'cashback' | 'mileage')
    : 'discount' as const,
  ```
- **Problem:** Unrecognized reward types (e.g., from a schema evolution or typo in YAML) are silently coerced to `'discount'` instead of throwing or warning. Since discount, points, cashback, and mileage all use different calculation functions (`calculateDiscount`, `calculatePoints`, `calculateCashback`), silently falling back to discount produces incorrect reward amounts.
- **Scenario:** A card rule is added with `type: 'mileage_v2'` (typo or new schema). The web analyzer silently treats it as discount. The user sees understated rewards and may choose the wrong card.
- **Fix:** Throw an error or at minimum `console.warn` when `VALID_REWARD_TYPES.has(r.type)` is false.

---

## New Finding: N2 — Silent Card Source Fallback (LOW / Medium confidence)

- **File:** `apps/web/src/lib/analyzer.ts:65-67`
- **Problem:** Unknown `card.source` values silently mapped to `'web'`. Less critical than N1 but obscures data quality issues.
- **Fix:** Warn on unknown source.

---

## Style / Maintainability Notes

- `store.svelte.ts:349` has a lingering `as AnalysisResult` cast after extensive runtime validation. The cast is now safe but could be removed by refining return type annotations.
- No other new type-assertion issues found.
