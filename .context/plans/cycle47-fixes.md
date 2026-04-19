# Cycle 47 Implementation Plan

**Date:** 2026-04-19
**Source:** `.context/reviews/2026-04-19-cycle47-comprehensive.md`

---

## Task 1: Add `Number.isFinite` guard and negative-zero normalization to terminal `formatWon`

- **Finding:** C47-L01
- **Severity:** LOW
- **Confidence:** High
- **Files:** `packages/viz/src/terminal/summary.ts:5-7`, `packages/viz/src/terminal/comparison.ts:4-6`
- **Description:** The terminal `formatWon` functions use `amount.toLocaleString('ko-KR')` without a `Number.isFinite` check or negative-zero normalization. The web-side (fixed in C45-L01) and report-generator (fixed in C46-L01) versions both have these guards. The terminal versions are the only remaining `formatWon` implementations without them.
- **Fix:** Add `if (!Number.isFinite(amount)) return '0원';` and `if (amount === 0) amount = 0;` at the start of both terminal `formatWon` functions, matching the report-generator implementation.
- **Status:** PENDING

---

## Task 2: Add `Number.isFinite` guard to terminal `formatRate`

- **Finding:** C47-L02
- **Severity:** LOW
- **Confidence:** High
- **Files:** `packages/viz/src/terminal/summary.ts:9-11`, `packages/viz/src/terminal/comparison.ts:8-10`
- **Description:** The terminal `formatRate` functions use `(rate * 100).toFixed(2)` without a `Number.isFinite` check. The web-side and report-generator versions both have these guards. While `toFixed()` handles NaN/Infinity without throwing, the output "NaN%" or "Infinity%" would be confusing.
- **Fix:** Add `if (!Number.isFinite(rate)) return '0.00%';` at the start of both terminal `formatRate` functions, matching the report-generator implementation.
- **Status:** PENDING
