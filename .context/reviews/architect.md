# Architecture Review — cherrypicker (Cycle 20)

**Reviewer:** architect
**Scope:** System boundaries, data flow, long-term maintainability
**Date:** 2026-05-05

---

## Summary

Cycle 19 fixed consistency issues but the fundamental architectural debt remains: server/web parser duplication continues to expand (now 6 formats duplicated), and the analyzer cache invalidation strategy has a latent bug. No structural refactoring was attempted.

---

## New Findings

### [C20-ARCH01-MEDIUM] Analyzer cache not keyed by cardIds filter

**Files:** `apps/web/src/lib/analyzer.ts:55-86`
**Confidence:** High

The `cachedCoreRules` is a single global cache. When `optimizeFromTransactions` is called with `options.cardIds`, it filters AFTER retrieving from cache:
```ts
let coreRules: CoreCardRuleSet[] = cachedCoreRules ?? transformed ?? [];
if (options?.cardIds && options.cardIds.length > 0) {
  coreRules = coreRules.filter(r => idSet.has(r.card.id));
}
```

This means:
1. First call without cardIds: caches ALL rules
2. Second call WITH cardIds: retrieves ALL rules from cache, then filters

This is functionally correct but means filtered calls pay the cost of filtering every time instead of caching the filtered result. More importantly, if a caller alternates between filtered and unfiltered calls, the cache is constantly invalidated and rebuilt (though in practice the web app doesn't do this).

**Fix:** Key the cache by cardIds hash (or tuple), or accept that the current pattern is adequate given the web app's single-session usage pattern.

---

### [C20-ARCH02-LOW] Web-side parser duplication expanded to 6 formats

**Files:** `apps/web/src/lib/parser/` vs `packages/parser/src/`
**Confidence:** High

The server/web parser duplication now covers: CSV, XLSX, PDF, JSON, OFX, HTML. Each format has independent implementations with parity comments (e.g., "Parity with server-side packages/parser/src/ofx/index.ts (C98-01)"). This is manual synchronization — every bug fix must be applied twice.

**Fix:** Same as previous cycles. Extract isomorphic parsing logic to a shared pure-TS module. Server adds file I/O. Web adds File/blob handling. Both consume the same core logic.

---

## Previously Reported — Status

| ID | Description | Severity | Status |
|----|-------------|----------|--------|
| A-ARCH-01 | Server/web parser duplication | CRITICAL | **OPEN** — expanded to 6 formats |
| A-ARCH-03 | Card rules type duplicated in web app | HIGH | **OPEN** — `toCoreCardRuleSets` still bridges the gap |
| A-ARCH-05 | No workspace boundary enforcement | MEDIUM | **OPEN** |

---

## Verdict

**FIX AND SHIP** — C20-ARCH01 is a bounded fix. C20-ARCH02 is structural debt that requires a dedicated refactoring cycle.
