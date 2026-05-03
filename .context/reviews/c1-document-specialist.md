# Cycle 1 (fresh) — document-specialist pass

**Date:** 2026-05-03

## Scope

Doc/code mismatches against authoritative sources.

## Findings

### C1-DOC01: README still says MIT while LICENSE is Apache 2.0 (unchanged)

- **Severity:** MEDIUM (legal metadata)
- **Confidence:** High
- **File+line:** `README.md:169-171` vs `LICENSE:1-15`
- **Status:** Deferred (D-02), unchanged.

### C1-DOC02: `ilpOptimize` JSDoc says "Optimal ILP optimizer" but it's a greedy fallback

- **Severity:** LOW
- **Confidence:** High
- **File+line:** `packages/core/src/optimizer/ilp.ts:43`
- **Fix:** Update JSDoc to reflect that it's a stub delegating to greedy optimizer.

## Summary

2 findings (1 MEDIUM re-confirmed, 1 LOW new).
