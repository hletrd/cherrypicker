# Cycle 2 — architect pass

**Date:** 2026-05-03

## Scope

Architectural/design risks, coupling, layering, dependency direction.

## Findings

### C2-A01: Parser return-type contract leak — `parseDateStringToISO` returns `string` unconditionally (re-confirmed from C1-R01/A01)

- **Severity:** MEDIUM (architectural)
- **Confidence:** High
- **File+line:** `apps/web/src/lib/parser/date-utils.ts:61-143`, `packages/parser/src/date-utils.ts:50-124`
- **Description:** Both copies of `parseDateStringToISO` return `string` unconditionally, making it impossible for callers to distinguish valid ISO dates from garbage at the type level. The `isValidISODate()` helper exists but is only used for error reporting, not for type narrowing. The root-cause fix (return `{ iso: string | null; raw: string }`) remains deferred.
- **Exit criterion:** Refactor `parseDateStringToISO` to return a discriminated union or tagged result type and update all callers.

### C2-A02: Web-vs-packages parser duplication — two copies of date-utils.ts, detect.ts, and BANK_SIGNATURES (re-confirmed from D-01)

- **Severity:** MEDIUM (drift risk)
- **Confidence:** High
- **File+line:** `apps/web/src/lib/parser/date-utils.ts` vs `packages/parser/src/date-utils.ts`, `apps/web/src/lib/parser/detect.ts` vs `packages/parser/src/detect.ts`
- **Description:** The web app and the packages/parser library contain near-identical copies of date parsing, bank detection, and bank signature data. This is a DRY violation that creates drift risk. Any fix to one copy must be applied to the other.
- **Exit criterion:** Refactor to a shared parser core importable by both Bun and browser runtimes, or generate the web copy from the packages source at build time.

### C2-A03: CATEGORY_NAMES_KO hard-coded duplicate of YAML taxonomy (re-confirmed from C1-A03)

- **Severity:** MEDIUM (drift risk)
- **Confidence:** High
- **File+line:** `packages/core/src/optimizer/greedy.ts:7-90`
- **Description:** Known deferred item (TODO C64-03). The hard-coded map can silently drift from YAML taxonomy. Web path partially mitigated. CLI callers still rely on hard-coded map.
- **Status:** Unchanged.

## Architectural observations

- **C1-P01 fix verified.** XLSX parser at `xlsx.ts:299-301` now uses `XLSX.read(html, { type: 'string' })`. Good fix.
- **Layering.** `packages/core` is platform-agnostic. `apps/web/src/lib/*` depends on `@cherrypicker/core`. No inverse dependencies.
- **Cache discipline.** Three caches invalidated on `analysisStore.reset()`. Good.
- **Store pattern.** Snapshot pattern (C81-01) in `reoptimize` correctly implemented.

## Summary

0 net-new architecture findings. 3 re-confirmations of known deferred items (A01, A02, A03).
