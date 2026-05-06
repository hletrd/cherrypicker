# Cycle 34 — Architect Findings

**Date:** 2026-05-06
**Scope:** Architecture, coupling, layering

---

## Still Not Fixed

### F7: Parser Duplication Between Web and Server [MEDIUM]
- **Files:** `apps/web/src/lib/parser/` (12 files) vs `packages/parser/src/` (19 files)
- **Status:** Unchanged. Two complete parser implementations maintained separately.
- **Risk:** Feature parity bugs (e.g., C100-01 forward-fill for HTML was added to both sides with explicit parity comments). Any fix must be applied twice.
- **Mitigation:** Already acknowledged. Extracting shared logic into a pure-TS package would require significant refactoring due to browser vs. Node APIs (e.g., `fetch` vs. file system, `TextEncoder` vs. `Buffer`).

---

## Structural Observations

### Web/Core Type Adapter Coupling
- **File:** `apps/web/src/lib/analyzer.ts:60-81`
- The `toCoreCardRuleSets` function bridges web `CardRuleSet` to core `CardRuleSet` with runtime narrowing. This is the correct pattern, but the silent fallbacks (N1, N2 in code-reviewer) mean the adapter is also a data-quality gate that fails open.
- **Recommendation:** Make the adapter fail-closed (throw on unknown values) so schema mismatches surface immediately.

### Cache Invalidation
- **File:** `apps/web/src/lib/analyzer.ts:58`
- `cachedCoreRules` is keyed globally, not by `cardIds`. Comment acknowledges this is safe for current calling patterns but fragile if patterns change.
- **Risk:** If a future feature calls `analyze()` with different `cardIds` filters in alternation, the cache would return stale data.

---

## No New Architectural Issues

The overall layering (web → core → rules → parser) remains sound. No new coupling introduced this cycle.
