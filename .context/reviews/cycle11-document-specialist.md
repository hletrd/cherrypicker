# Cycle 11 — Document-Specialist Findings

**Date:** 2026-05-05
**Reviewer:** document-specialist (simulated)
**Scope:** Doc/code mismatches against authoritative sources

## Summary

No doc/code mismatches found. Comments accurately describe behavior. TODO comments match implementation state.

---

## Findings

### C11-DS01 — [LOW] Stale TODO comment in reward calculator

**File:** `packages/core/src/calculator/reward.ts:78`

A TODO comment about "implement cash back calculation" exists, but the function below it is fully implemented. This was P3-LOW in cycle 10.

**Fix:** Remove the TODO comment.

**Confidence:** High

---

### C11-DS02 — [LOW] README license mismatch still deferred

**File:** `README.md:169-171` vs `LICENSE:1-15`

README states MIT, LICENSE is Apache 2.0. This was deferred in D-02.

**Status:** DEFERRED pending project owner confirmation.

---

### C11-DS03 — CSP migration TODO accurate

**File:** `apps/web/src/layouts/Layout.astro:38-48`

The TODO comment correctly describes the current state (`unsafe-inline` required) and the desired future state (hash-based CSP). No mismatch.

**Status:** CORRECT

---

### C11-DS04 — Parser comments match implementation

**File:** `packages/parser/src/csv/shared.ts:126-139`

The JSDoc for `parseAmountString` accurately lists all supported formats. Verified against implementation lines 140-163.

**Status:** CORRECT

---

## Verdict

**COMMENT** — One stale TODO comment. No material doc/code mismatches.
