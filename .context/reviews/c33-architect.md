# Cycle 33 Architecture Review — CherryPicker

**Agent:** c33-architect  
**Date:** 2026-05-06  
**Status:** Agent spawn failed; review performed by orchestrator

---

## Finding 1: Web/server parser duplication creates maintenance burden [MEDIUM / High confidence]

**Problem:** The monorepo has two parallel parser implementations (web in `apps/web/src/lib/parser/`, server in `packages/parser/src/`). Fixes must be applied twice. The C32 cycle had 5 parser-related fixes that required dual application.

**Files:** `apps/web/src/lib/parser/` vs `packages/parser/src/`

**Suggested fix:** Create a `packages/parser-shared/` package with pure TypeScript parser logic. The web and server sides import from it, providing only environment-specific I/O (file reading, encoding detection).

**Confidence:** High

---

## Finding 2: `packages/core/` purity is maintained but type adapters add coupling [LOW / Medium confidence]

**File:** `apps/web/src/lib/analyzer.ts:29-81`

**Problem:** The `toRulesCategoryNodes` and `toCoreCardRuleSets` adapters bridge web types to core types. This is necessary but adds coupling. If core types change, both the core package AND the adapter must update.

**Suggested fix:** Move the adapters to `packages/core/` as official type projection utilities, tested alongside core.

**Confidence:** Medium

---

## Finding 3: Categorizer keyword taxonomy loads entirely into memory [LOW / Medium confidence]

**File:** `packages/core/src/categorizer/keywords.ts`

**Problem:** The keyword file is ~4000 lines of object literals, loaded into memory on import. This is fine for desktop but may be heavy on low-end mobile devices.

**Suggested fix:** Lazy-load keywords by category, or use a compact trie representation.

**Confidence:** Medium

---

## Final Sweep

- No circular dependencies detected.
- Package.json dependencies are clean.
- Build pipeline (Astro + Bun) is well-structured.
- No architectural violations in core package (no DOM, no fs, no network).
