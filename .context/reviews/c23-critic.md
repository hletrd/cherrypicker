# Critic — cherrypicker (Cycle 23)

**Reviewer:** critic
**Scope:** Full repository — design, maintainability, deferred-fix tracking
**Date:** 2026-05-05

---

## Summary

Cycle 22's C22-SEC01 fix was a quick patch that solved the immediate problem (event handler attributes not being stripped) but introduced a new bug (attributes with spaces are only partially stripped). This is a textbook example of "fix fast, fix wrong" — the pressure to close review findings in a single cycle led to insufficient testing of the fix.

---

## New Findings

### [C23-CRIT01-MEDIUM] C22-SEC01 fix was inadequately tested

**Files:** `apps/web/src/lib/parser/html.ts:40`, `apps/web/__tests__/parser-html.test.ts`
**Confidence:** High

The C22-SEC01 fix added tests for:
- `onclick="alert(1)"`
- `onclick=alert(1)`
- `onclick=`

But did NOT test:
- Values with spaces: `onclick="alert(1); console.log(2)"`
- Multi-line values
- Values with special characters

The test engineer review in cycle 22 should have caught this gap. The fact that it didn't suggests the review process itself is under pressure to move quickly.

**Fix:** Require that security-related fixes include edge-case tests for the failure mode they address. A fix for "event handlers not stripped" must test multiple event handler syntaxes.

---

### [C23-CRIT02-LOW] Deferred architectural debt produced concrete bug

**Files:** `.context/reviews/`, `.omc/plans/`
**Confidence:** High

A-ARCH-01 (server/web parser duplication) has been deferred for 20+ cycles with the rationale "requires significant refactoring." In cycle 23, this debt produced C23-SEC01: a security regression caused by two divergent implementations of the same function.

**Fix:** Either schedule the refactoring or close the issue. Indefinite deferral is technical debt with compounding interest.

---

## Verdict

**FIX AND SHIP** for C23-SEC01. **REDESIGN REQUIRED** for the review process — security fixes need more rigorous test coverage.
