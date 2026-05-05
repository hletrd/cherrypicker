# Architect — cherrypicker (Cycle 13)

**Reviewer:** architect
**Date:** 2026-05-05

---

## Summary

Cycle 13 continues convergence. Four C12 findings are resolved. The server/web parser duplication (D-01) remains the primary architectural debt, but no new structural issues emerged. The PDF fallback pattern bug (C13-04) is a localized correctness issue, not an architectural concern.

---

## Architectural Findings

### A13-01: Server/web parser duplication remains primary tech debt

After 13 cycles, the server and web parsers remain separate codebases with significant duplication. The recent fixes (adapter-factory date validation, shared findColumn, column-matcher tests) improve the server-side but do not reduce duplication.

### A13-02: Column-matcher abstraction validated (GOOD)

The comprehensive test suite (2548 lines, 1408 tests) confirms the `findColumn()` / `normalizeHeader()` / `isValidHeaderRow()` abstraction is solid. The patterns handle Korean bank statement variations correctly.

### A13-03: Adapter factory pattern clean and now complete (GOOD)

With C12-01 and C12-06 fixed, the server-side adapter factory is fully correct. The web side should adopt this pattern to reduce D-01 duplication.

---

## Re-confirmed Recommendations

1. Build-time category data generation (exit criterion for C7-01/C7-02/C9-01)
2. Shared platform-agnostic parser module design doc (exit criterion for D-01)
3. Resolve D-02 (license mismatch) with project owner

---

## New Findings

None.

---

## Gate Evidence

- `npm run lint` — PASS
- `npm run typecheck` — PASS
- `bun run test` — PASS
- `npx vitest run` — PASS
