# Cycle 1 (fresh) — architect pass

**Date:** 2026-05-03

## Scope

Architectural/design risks, coupling, layering, dependency direction.

## Findings

### C1-A01: Parser return-type contract leak is the root cause of multiple downstream patches

- **Severity:** MEDIUM (architectural)
- **Confidence:** High
- **File+line:** `apps/web/src/lib/parser/date-utils.ts:61-142` (parseDateStringToISO), `apps/web/src/lib/parser/types.ts:11` (RawTransaction.date: string)
- **Description:** This is a restatement of the known D-01/D-26 deferred item with updated evidence. `parseDateStringToISO` returns `string` unconditionally, making it impossible for callers to distinguish valid ISO dates from garbage at the type level. This has produced at least 3 downstream symptom fixes: C96-01 (empty months crash), C97-01 (period bounds pollution), and the test-engineer's noted C97-01 regression test gap. The proper fix remains deferred.
- **Cross-agent agreement:** code-reviewer (C1-R01), tracer (cycle 98 trace 1), test-engineer (cycle 98 micro-improvement note).
- **Exit criterion:** Refactor `parseDateStringToISO` to return `{ iso: string | null; raw: string }` and update all callers. Alternatively, implement the D-01 shared parser core refactor.

### C1-A02: `packages/core` re-exports ILP stub that misleads consumers

- **Severity:** LOW
- **Confidence:** High
- **File+line:** `packages/core/src/optimizer/index.ts` (exports ilpOptimize), `packages/core/src/optimizer/ilp.ts:43-49`
- **Description:** The `ilpOptimize` function is exported from `@cherrypicker/core` but is a dead stub that just calls `greedyOptimize` with a console message. Any consumer who selects `ilpOptimize` expecting optimal results gets greedy-quality results with no type-level warning.
- **Fix:** Either remove the export and stub entirely, or add a `@deprecated` JSDoc tag.

### C1-A03: CATEGORY_NAMES_KO hard-coded duplicate of YAML taxonomy (re-confirmed)

- **Severity:** MEDIUM (drift risk)
- **Confidence:** High
- **File+line:** `packages/core/src/optimizer/greedy.ts:7-90`
- **Description:** Known deferred item (TODO C64-03). The hard-coded map can silently drift from YAML taxonomy. Web path partially mitigated. CLI callers still rely on hard-coded map. No new symptoms this cycle.

## Summary

3 findings (2 MEDIUM, 1 LOW). All are re-confirmations of known deferred items.
