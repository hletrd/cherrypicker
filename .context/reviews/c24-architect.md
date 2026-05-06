# Architect — cherrypicker (Cycle 24)

**Reviewer:** architect (sonnet)
**Scope:** Architectural/design risks, coupling, layering
**Date:** 2026-05-06

---

## Summary

Cycle 23 addressed immediate security and correctness regressions. No structural changes. Cycle 24 confirms the parser duplication debt continues to grow.

---

## New Findings

### [C24-ARCH01-LOW] normalizeHTML still duplicated; XLSX depends on HTML module

**Files:** `apps/web/src/lib/parser/html.ts:29-47` vs `packages/parser/src/csv/shared.ts:181-196`
**Confidence:** High

The web-side `normalizeHTML` duplicates the server-side implementation. Additionally, the XLSX parser (`apps/web/src/lib/parser/xlsx.ts:353`) imports `normalizeHTML` from the HTML module, creating a coupling where the XLSX parser depends on HTML parser internals. This is a layering violation — XLSX should not depend on HTML.

**Fix:** Extract `normalizeHTML` to a shared sanitization utility in `apps/web/src/lib/parser/shared.ts`.

---

## Carry-overs

| ID | Severity | Status |
|----|----------|--------|
| A-ARCH-01: Server/web parser duplication (6 formats) | CRITICAL | **OPEN** — normalizeHTML is the latest divergence point |
| A-ARCH-03: CardRuleSet inline definition in web app | HIGH | **OPEN** — still inline in analyzer.ts |
| C20-ARCH02: Parser duplication spans 6 formats | LOW | **OPEN** — maps to A-ARCH-01 |
