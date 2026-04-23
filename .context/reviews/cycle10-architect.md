# Cycle 10 — architect

## Scope
- Web app module boundaries (store, analyzer, parser, cards, formatters).
- Cross-package contracts (core + rules + web adapter types).
- Persistence layer coupling (module-level `_loadPersistWarningKind`).

## Findings

### A10-00 — No net-new architectural findings [High]
- D7-M6 (module-level mutable `_loadPersistWarningKind` in store.svelte.ts:216-220) — unchanged. Still the last singleton-scoped coupling in persistence. Requires extracting `persistToStorage` / `loadFromStorage` into a dedicated module with explicit state, paired with D7-M11 A7-02.
- D7-M11 — architectural refactors (A7-01 selector coupling, A7-02 persistence extraction, A7-03 type-package split) — unchanged. Cross-cycle items.
- The analyzer adapter functions `toRulesCategoryNodes`, `toCoreCardRuleSets`, `VALID_SOURCES`, `VALID_REWARD_TYPES` (analyzer.ts:22-71) remain the cleanest seam between web and core types. No new drift introduced.
- `invalidateAnalyzerCaches` export (analyzer.ts:77-79) still the single entry point for analyzer cache hygiene; called only from `store.reset()`. Clean.

## Confidence
High.
