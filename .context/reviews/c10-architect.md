# Cycle 10 — Architect

Date: 2026-04-24

## Inventory of reviewed files

All source files, with focus on cross-module interactions, coupling, and layering.

## Findings

### C10-A01: Hardcoded taxonomy duplicates — systemic pattern (7+ instances)
- **File+line:** Multiple (see aggregate for full list)
- **Description:** Same as C7-01, C7-02, C8-01, C9-01 through C9-05. All 7+ instances share the same root cause and fix: build-time generation from YAML/JSON source data. The critic has flagged this as a recurring concern across 6+ consecutive cycles.
- **Confidence:** High
- **Status:** ALREADY TRACKED

### C10-A02: Web-side parser duplicates packages/parser
- **File+line:** `apps/web/src/lib/parser/*` vs `packages/parser/src/*`
- **Description:** Same as D-01/D-57. The architectural split (browser vs Bun runtime) is documented. The web parser uses SheetJS and browser APIs; the packages parser uses Bun APIs.
- **Confidence:** High
- **Status:** ALREADY TRACKED (D-01/D-57)

### C10-A03: `cachedCoreRules` never cleared on store reset but `cachedCategoryLabels` is
- **File+line:** `apps/web/src/lib/analyzer.ts:48` vs `apps/web/src/lib/store.svelte.ts:600`
- **Description:** Same as D-76. The `invalidateAnalyzerCaches()` function is called from `reset()` (line 601), which clears `cachedCoreRules`. This was fixed in a previous cycle — `invalidateAnalyzerCaches` is now exported and called. Re-confirming the fix is intact.
- **Confidence:** High
- **Status:** RESOLVED (invalidateAnalyzerCaches added)

## Sweep for commonly missed issues

1. **Layer boundaries:** `packages/core/` is pure TypeScript with no runtime-specific APIs. `packages/rules/` uses Zod for schema validation and is also pure TS. `packages/parser/` runs on Bun. `apps/web/` runs in the browser on Node (Astro). Layer boundaries are respected.

2. **Dependency direction:** `apps/web/` imports from `@cherrypicker/core`, `@cherrypicker/rules`, and its own `lib/` modules. No circular dependencies detected. The `toCoreCardRuleSets` adapter properly bridges the web CardRuleSet type to the core CardRuleSet type.

3. **Store architecture:** The Svelte 5 runes-based store (`store.svelte.ts`) is a singleton. The `createAnalysisStore()` factory pattern is clean. The `generation` counter provides a simple but effective change-detection mechanism.

4. **Error boundary:** `analysisStore.analyze()` catches errors internally, setting `error` and `result=null`. This prevents unhandled promise rejections from propagating to the UI. The `FileDropzone` component checks `analysisStore.error` after `analyze()` completes.

## Conclusion

Zero net-new architectural findings. All known architectural concerns (parser duplication, hardcoded taxonomy maps) are tracked in deferred items. The `invalidateAnalyzerCaches` fix from a previous cycle is confirmed intact.
