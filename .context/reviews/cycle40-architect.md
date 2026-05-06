# Architecture Review — CherryPicker Cycle 40

**Reviewer:** architect
**Scope:** Architectural/design risks, coupling, layering
**Date:** 2026-05-06

---

## Summary

One minor architectural concern: the `parseAmountString` function has grown to a complexity threshold where sequential replacement ordering is fragile. No new structural issues. Parser duplication remains the dominant architectural debt.

| Category | Count | Severity |
|---|---|---|
| New Findings | 1 | Low |
| Carryover | 2 | — |

---

## NEW FINDINGS

### ARCH-40-01: `parseAmountString` Replacement Ordering Is Fragile
**File:** `packages/parser/src/csv/shared.ts:148-184`
**Severity:** Low | **Confidence:** Medium

The `parseAmountString` function applies 10+ sequential string replacements. The order matters:
1. `^\+` strip happens BEFORE full-width `＋` conversion
2. `\s*원$` replacement happens BEFORE parenthesis stripping
3. Parenthesis stripping happens AFTER `마이너스` prefix check

A future edit that reorders these replacements could introduce subtle regressions. The function has no unit tests verifying replacement ordering invariants.

**Fix:** Document the ordering invariants in comments, or decompose into a pipeline of discrete transformations with explicit intermediate types.

---

## CARRYOVER

| ID | Severity | File | Description |
|----|----------|------|-------------|
| ARCH-39-01 | Low | `apps/web/src/lib/parser/*.ts` | Parser duplication ~1500+ lines |
| CR-07/CR-17 | Medium | Various | Type unification + parser dedup (deferred) |
