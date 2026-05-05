# Architecture Review — cherrypicker (Cycle 19)

**Reviewer:** architect
**Scope:** Design risks, coupling, layering, duplication, cache invalidation
**Date:** 2026-05-06

---

## Summary

Cycle 18 addressed the `MIGRATIONS` type and persistence callbacks. Cycle 19 review finds the `toCoreCardRuleSets` cache invalidation gap remains, and the server/web parser duplication (a long-standing critical issue) now spans three additional formats (JSON, OFX, HTML).

---

## New Findings

### C19-ARCH01 [MEDIUM] — `toCoreCardRuleSets` cache not keyed by cardIds filter

**File:** `apps/web/src/lib/analyzer.ts:44-72, 186-209`
**Confidence:** High

The cache stores the FULL unfiltered rule set. When `optimizeFromTransactions` is called with `options.cardIds`, the filter is applied AFTER cache retrieval:
```ts
if (options?.cardIds && options.cardIds.length > 0) {
  const idSet = new Set(options.cardIds);
  coreRules = coreRules.filter(r => idSet.has(r.card.id));
}
```

If the first call has no `cardIds` (caches all rules), and a later call has `cardIds`, the second call incorrectly receives the unfiltered cached rules. The `cachedCoreRules` variable is module-level and shared across all calls.

**Fix:** Key the cache by a hash of the `cardIds` array (or `'all'` when absent), or clear the cache when `cardIds` changes.

---

### C19-ARCH02 [MEDIUM] — Server/web parser duplication expanded to 3 new formats

**File:** `packages/parser/src/{json,ofx,html}/` vs `apps/web/src/lib/parser/{json,ofx,html}.ts`
**Confidence:** High

JSON, OFX, and HTML parsers now exist in both the server package and the web app. The code is nearly identical (verified: `normalizeHTML` is byte-for-byte identical, OFX `extractTag` differs only in comment density). Each new format doubles the maintenance burden and drift risk.

**Fix:** Extract shared parser logic to a pure-JS package consumable by both Bun and the browser, or make `@cherrypicker/parser` browser-compatible.

---

## Carry-overs from Previous Cycles

- **A-ARCH-01** — Server/web parser duplication (CRITICAL, now expanded)
- **A-ARCH-03** — CardRuleSet inline definition in web app (HIGH)

---

## Verdict

**FIX AND SHIP** — C19-ARCH01 is a correctness bug that can produce wrong optimization results when card filtering is used.
