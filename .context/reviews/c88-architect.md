# Architect — Cycle 88

## Summary
Architectural/design review focusing on coupling, layering, and structural risks.

## Findings

### No NEW architectural findings this cycle

### Verified Architectural Patterns
1. **Monorepo structure**: Clean separation between packages (core, parser, rules, viz) and apps (web). Tools (cli, scraper) are isolated.
2. **Type adapter pattern**: `analyzer.ts` uses adapter functions (`toRulesCategoryNodes`, `toCoreCardRuleSets`) to safely bridge web types to core/rules types without `as unknown as`. Good practice.
3. **Cache management**: Store has `invalidateAnalyzerCaches()` for reset. `cachedCoreRules` guards against empty arrays from AbortError (C72-02).
4. **Error handling**: Parser chain has try/catch with fallback to generic parser. Store catches and surfaces errors to UI.

### Carried-Forward Architectural Risks
- **Bank data duplication** (C7-07/C66-10/C70-05/C86-10): BANK_SIGNATURES exists in both packages/parser and apps/web. ALL_BANKS in FileDropzone is a 5th copy. The D-01 architectural refactor (shared module between Bun and browser) would resolve this but requires environment-agnostic module design.
- **MerchantMatcher O(n) scan** (C33-01/C66-02/C86-12): Linear scan per transaction. Aho-Corasick or trie-based matching would be O(m) per transaction but requires build-time precomputation.
- **cachedCategoryLabels staleness** (C21-02/C33-02/C86-11): Cache is not invalidated on Astro View Transitions or redeployments. The cache lives in the store module scope and survives page transitions.
