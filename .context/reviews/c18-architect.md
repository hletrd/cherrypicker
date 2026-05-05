# Architecture Review — cherrypicker (Cycle 18)

**Reviewer:** architect
**Scope:** System boundaries, data flow, long-term maintainability, coupling
**Date:** 2026-05-06

---

## Summary

Cycles 16-17 resolved CATEGORY_NAMES_KO hardcoding, MIGRATIONS type safety, and several parser parity bugs. The fundamental server/web parser duplication (A-ARCH-01) remains the dominant architectural risk. One new LOW finding relates to cache keying in the analyzer adapter.

---

## New Findings

### C18-ARCH01 [LOW] — `toCoreCardRuleSets` cache is keyed by existence, not by data identity

**File:** `apps/web/src/lib/analyzer.ts:44-72`
**Confidence:** Medium

```ts
let cachedCoreRules: CoreCardRuleSet[] | null = null;

function toCoreCardRuleSets(rules: CardRuleSet[]): CoreCardRuleSet[] {
  if (cachedCoreRules) return cachedCoreRules; // Returns same array forever
  // ...transform and cache...
}
```

The cache is invalidated only via `invalidateAnalyzerCaches()` (called on store reset). If `getAllCardRules()` ever returns different data during a session (e.g., after a hot reload in dev, or if cards.json is dynamically reloaded), the cache returns stale transformed rules. The comment acknowledges this is safe "within a session" but provides no guard against the dev-mode scenario.

**Fix:** Add a lightweight cache key based on rules array length or a content hash. Alternatively, skip caching in dev mode via `import.meta.env.DEV`.

---

## Verified Fixed

| Finding | Commit | Evidence |
|---------|--------|----------|
| A-ARCH-02: CATEGORY_NAMES_KO | `e8351ee` | `categoryLabels` required parameter; no hardcoded labels |
| A6-01: categoryLabels duplication | earlier | `buildCategoryLabelMap` imported from `@cherrypicker/rules` |
| C17-ARCH03: MIGRATIONS any | `4cdb832` | `unknown` input/output types |

---

## Still Open from Prior Cycles

| ID | Description | Severity | Status |
|----|-------------|----------|--------|
| A-ARCH-01 | Server/web parser duplication | CRITICAL | **OPEN** — No structural fix after 18 cycles |
| A-ARCH-03 | Card rules type duplicated in web app | HIGH | **OPEN** — `apps/web/src/lib/cards.ts:14-52` still defines `CardRuleSet` inline |
| A-ARCH-05 | No workspace boundary enforcement | MEDIUM | **OPEN** |
| F-CRI-03 | Deferred-fix tracking fragmented | MEDIUM | **OPEN** |

---

## Verdict

**STRUCTURAL DEBT ACCUMULATING** — A-ARCH-01 remains the single largest risk. C18-ARCH01 is a minor dev-mode sharp edge. Recommend scheduling A-ARCH-01 for a dedicated architecture sprint.
