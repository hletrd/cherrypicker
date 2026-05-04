# Cycle 84 Implementation Plan

**Date:** 2026-05-05
**Status:** In Progress

---

## Task 1: Add full-width digit amount patterns to CSV column inference [MEDIUM]

**Finding:** F84-01
**Files:** `packages/parser/src/csv/generic.ts`, `apps/web/src/lib/parser/csv.ts`

**Problem:** `AMOUNT_PATTERNS` used by `isAmountLike()` for data-inference column detection
does NOT include patterns for full-width digit amounts. While `parseCSVAmount()` handles
them at parse time, the generic CSV parser cannot identify the amount column when headers
are absent and data contains full-width amounts like `１，２３４` or `１２３４５`.

**Fix:** Add full-width digit amount patterns to `AMOUNT_PATTERNS` in both server and
web generic CSV parsers:
- `^[０-９][０-９，]*，[０-９][０-９，]*$` for comma-separated full-width amounts
- `^[０-９]{5,}$` for bare 5+ digit full-width integers

Add end-to-end test in `packages/parser/__tests__/csv.test.ts`.

---

## Task 2: Add explicit empty-string guard to web CSV parseAmount [LOW]

**Finding:** F84-02
**File:** `apps/web/src/lib/parser/csv.ts`

**Problem:** Server-side `parseCSVAmount` has `if (!raw.trim()) return null;` but web-side
`parseAmount` does not. Both produce correct results but explicit guard is clearer.

**Fix:** Add `if (!raw.trim()) return null;` to web-side `parseAmount`.

---

## Task 3: Run quality gates

**Requirement:** All gates must pass: lint, typecheck, turbo build, vitest, bun test.

---

## Progress

- [ ] Task 1: Full-width digit amount patterns in CSV column inference
- [ ] Task 2: Web CSV parseAmount empty-string guard
- [ ] Task 3: Quality gates pass