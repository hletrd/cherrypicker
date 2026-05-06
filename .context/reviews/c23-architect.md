# Architecture Review — cherrypicker (Cycle 23)

**Reviewer:** architect
**Scope:** System boundaries, data flow, long-term maintainability
**Date:** 2026-05-05

---

## Summary

Cycle 22 fixed immediate issues but left structural debt untouched. Cycle 23 finds that the normalizeHTML duplication (reported since cycle 2) has now caused a security regression. The cost of deferring the architectural fix has materialized.

---

## New Findings

### [C23-ARCH01-MEDIUM] normalizeHTML duplication caused security regression

**Files:** `apps/web/src/lib/parser/html.ts:29-44` vs `packages/parser/src/csv/shared.ts:181-196`
**Confidence:** High

The `normalizeHTML` function is defined in two places with slightly different implementations. The server-side version correctly handles event handler attributes with spaces in quoted values. The web-side version (added for C20-SEC02/C22-SEC01) introduced a buggy regex that fails on spaces.

This is the predicted outcome of A-ARCH-01 (server/web parser duplication): every fix must be applied twice, and any divergence creates bugs.

**Fix:** Import `normalizeHTML` from the shared module (`packages/parser/src/csv/shared.ts`) in the web-side HTML parser. The function is already exported there. Remove the duplicate from `apps/web/src/lib/parser/html.ts`.

---

## Previously Reported — Status

| ID | Description | Severity | Status |
|----|-------------|----------|--------|
| A-ARCH-01 | Server/web parser duplication | CRITICAL | **OPEN** — now 6 formats, caused C23-SEC01 |
| A-ARCH-03 | Card rules type duplicated in web app | HIGH | **OPEN** |
| C20-ARCH01 | Analyzer cache not keyed by cardIds | MEDIUM | **OPEN** |

---

## Verdict

**FIX AND SHIP** for C23-ARCH01. The architectural debt has produced a concrete bug. Schedule a dedicated refactoring sprint for A-ARCH-01 or close it as "won't fix."
