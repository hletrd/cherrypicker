# Critic Review — CherryPicker Cycle 40

**Reviewer:** critic
**Scope:** Multi-perspective critique of change surface
**Date:** 2026-05-06

---

## Summary

Cycle 40 is a low-velocity maintenance cycle with 3 minor findings. The dominant pattern is "validation at one layer but not another" — the C39 NaN guard in `calculateRewards` is correct, but the store layer above it doesn't prevent NaN from reaching that guard, producing poor UX.

| Category | Count | Severity |
|---|---|---|
| New Findings | 2 | 1 Medium, 1 Low |
| Carryover | 3 | — |

---

## NEW FINDINGS

### C40-CRIT01: Layered Validation Gap — Store Accepts NaN That Core Rejects
**Files:** `apps/web/src/lib/store.svelte.ts:490-492`, `packages/core/src/calculator/reward.ts:190-193`
**Severity:** Medium | **Confidence:** High

The C39 fix added a NaN guard in the core calculator. This is architecturally correct (validate at the core). But the store layer above it does not pre-validate, allowing NaN to flow from user input → sessionStorage → reoptimize → core throw → generic error message.

A better pattern: validate at the boundary (store.analyze) with a user-friendly message, AND keep the core guard as a safety net. Currently the boundary validation is missing, so the safety net becomes the primary error path.

**Fix:** Add boundary validation in `store.svelte.ts:analyze()` with a Korean error message. Keep the core guard.

---

### C40-CRIT02: Cycle Reference Comments Continue to Proliferate
**Severity:** Low | **Confidence:** High

Every new fix adds more `C##-` reference comments. The codebase now has 100+ such references across 40+ cycles. These comments serve as a poor substitute for a proper changelog or git history.

**Fix:** Remove cycle references older than Cycle 20 from inline comments. The information is preserved in git history and the `.context/reviews/` directory.

---

## CARRYOVER

| ID | Description | File |
|----|-------------|------|
| C37-CRIT02 | Silent data loss systemic pattern | All parsers |
| C39-CRIT02 | "Parity" comments acknowledge duplication | `apps/web/src/lib/parser/*.ts` |
| ARCH-39-01 | Parser duplication ~1500+ lines | `apps/web/src/lib/parser/*.ts` |
