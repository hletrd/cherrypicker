# Cycle 25 — Architect (2026-05-06)

## Finding 1: Server/web HTML parser duplication continues [C25-ARCH01] — LOW

**Files:** `apps/web/src/lib/parser/html.ts`, `packages/parser/src/html/index.ts`

The two HTML parsers remain nearly identical (both use SheetJS, same column matching, same forward-fill logic, same header detection). The only meaningful difference is:
- Web uses `new TextEncoder()` + `xlsx.read(..., { type: 'array' })`
- Server uses `Buffer.from(..., 'utf-8')` + `xlsx.read(..., { type: 'buffer' })`

This duplication means fixes like C25-COR01 (forward-fill reset) and C25-SEC01 (normalizeHTML regex) must be applied in two places. Cycle 24's C24-ARCH01 already identified this as part of the larger A-ARCH-01 parser duplication refactor.

**Recommendation:** Continue deferring to A-ARCH-01. The shared `normalizeHTML` extraction was started in C100-04 (shared between HTML and XLSX), but a full HTML parser shared module requires handling the Buffer/TextEncoder difference.

## Carry-overs

- A-ARCH-01 — Server/web parser duplication (CRITICAL) — unchanged
- A-ARCH-03 — CardRuleSet inline definition in web app (HIGH) — unchanged
- T6-02 — No parity tests between server and web parsers (HIGH) — unchanged
