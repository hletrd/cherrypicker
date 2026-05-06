# Cycle 31 Architectural Review

**Scope:** Parser module boundaries, web/server duplication, store/analyzer coupling, and dependency graph.

---

## New Findings

### C31-ARCH01 | MEDIUM | High | `apps/web/src/lib/parser/*` vs `packages/parser/src/*`

**HTML, OFX, and JSON parsers add to the web/server duplication debt**

The recently added HTML, OFX, and JSON parsers follow the same pattern as CSV/XLSX/PDF: duplicated between `apps/web/src/lib/parser/` and `packages/parser/src/`. The web-side `html.ts`, `ofx.ts`, and `json.ts` files are near-identical copies of their server-side counterparts with only import path differences.

This increases maintenance burden: every bug fix in one parser must be manually ported to the other. The C98/C99 commits show this pattern in action (e.g., "web-side parity" commits).

**Fix:** Evaluate using a build-time sync or a shared pure-JS module that both sides can import. Alternatively, generate the web-side parsers from server-side templates.

### C31-ARCH02 | LOW | Medium | `packages/parser/src/amount.ts`

**`amount.ts` re-exports from `csv/shared.ts` creating a circular dependency risk**

`amount.ts` imports `parseAmountString` from `csv/shared.ts`, then re-exports it. `csv/shared.ts` could in theory import from `amount.ts` in the future, creating a circular dependency. Currently it's a one-way dependency, but the module graph is fragile.

**Fix:** Move `parseAmountString` to `amount.ts` as the canonical implementation, and have `csv/shared.ts` import from `amount.ts` instead.

### C31-ARCH03 | LOW | Medium | `apps/web/src/lib/store.svelte.ts`

**Store file exceeds 350 lines and mixes persistence, validation, and state management**

The file handles: Svelte 5 runes, sessionStorage persistence with migrations, schema validation, analysis result typing, and helper functions. While functional, this violates single-responsibility and makes testing difficult.

**Fix:** Extract persistence logic to `storage.ts`, validation to `storage-validation.ts`, and keep only Svelte-specific state in `store.svelte.ts`.

---

## Prior Open Findings Verified

| Finding | Status | Evidence |
|---|---|---|
| D-01 | OPEN (HIGH) | Web/server parser duplication still unresolved; now affects 6 parser formats |
| D-34 | OPEN (LOW) | `analyzer.ts` still mixes parsing, categorization, and optimization |
| D-35 | OPEN (LOW) | `inferYear` and `parseDateToISO` still duplicated in csv.ts and xlsx.ts |

---

## Final Sweep

1. Dependency graph is clean (no circular imports detected)
2. No new runtime dependencies added in recent commits
3. `packages/core` remains pure TypeScript (no runtime-specific APIs)
4. `packages/rules` still only defines schemas + data
