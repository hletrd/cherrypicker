# Architecture Review — cherrypicker (Cycle 6)

**Reviewer:** architect
**Scope:** System boundaries, data flow, long-term maintainability
**Date:** 2026-05-06

---

## Summary

Cycle 6 delivered two structural improvements: removal of hardcoded CATEGORY_NAMES_KO (A-ARCH-02 fixed) and ParseError class with contextual enrichment. However, the fundamental server/web parser duplication remains unaddressed after 5 cycles, and a new duplication pattern emerged: categoryLabels Map construction is copy-pasted across 5+ call sites.

---

## Verified Fixed

| Finding | Commit | Evidence |
|---------|--------|----------|
| A-ARCH-02: CATEGORY_NAMES_KO hardcoded | e8351ee | `categoryLabels` is now a required parameter; all call sites pass dynamically built maps |
| R-TRA-01: Parser errors lack context | 87aa83a | `ParseError` class with `file`, `format`, `line`, `raw`; `enrichErrors()` backfills |

---

## New Findings (Cycle 6)

### [A6-01-HIGH] categoryLabels Map construction duplicated across CLI, viz, and web

**Files:** `tools/cli/src/commands/analyze.ts:88-97`, `tools/cli/src/commands/optimize.ts:95-104`, `tools/cli/src/commands/report.ts`, `packages/viz/src/terminal/summary.ts`, `apps/web/src/lib/analyzer.ts:242-247`
**Confidence:** High

The same logic for building `Map<string, string>` from `CategoryNode[]` is repeated in at least 5 locations. This is the same anti-pattern that led to CATEGORY_NAMES_KO hardcoding — when the taxonomy structure evolves (e.g., adding a third nesting level), every call site must be updated independently.

**Fix:** Extract `buildCategoryLabelMap(nodes: CategoryNode[]): Map<string, string>` into `packages/rules/src/category-names.ts` (which already exists and exports `CATEGORY_NAMES_KO` for backward compatibility). Re-export from there and import in all call sites. Remove inline duplication.

---

### [A6-02-MEDIUM] Web-side ParseError type diverges from server-side class

**Files:** `apps/web/src/lib/parser/types.ts:30-34` vs `packages/parser/src/types.ts:30-47`
**Confidence:** High

Web-side `ParseError` is an interface; server-side is a class extending Error. This breaks:
1. Structural typing — web-side errors lack `file` and `format` fields
2. Runtime behavior — `instanceof ParseError` fails for web-side errors
3. Enrichment — `enrichErrors()` in `parseStatement()` cannot backfill web errors

This is a direct consequence of maintaining two separate parser trees instead of sharing a single implementation.

**Fix:** Short-term: align web-side types.ts with server-side class definition. Long-term: share the types module between server and web (extract to `@cherrypicker/parser` types that both import).

---

## Still Open from Cycle 5

| ID | Description | Severity | Status |
|----|-------------|----------|--------|
| A-ARCH-01 | Server/web parser duplication | CRITICAL | **OPEN** |
| A-ARCH-03 | Card rules type duplicated in web app | HIGH | **OPEN** |
| A-ARCH-05 | No workspace boundary enforcement | MEDIUM | **OPEN** |
| A-ARCH-06 | Monorepo workspace boundaries are soft | MEDIUM | **OPEN** |
| A-ARCH-07 | Scraping pipeline has no orchestration | MEDIUM | **OPEN** |
| F-CRI-03 | Deferred-fix tracking fragmented | MEDIUM | **OPEN** |
