# Cycle 2 — document-specialist pass

**Date:** 2026-05-03

## Scope

Doc/code mismatches against authoritative sources.

## Findings

### C2-DOC01: README still says MIT while LICENSE is Apache 2.0 (re-confirmed from C1-DOC01/D-02)

- **Severity:** MEDIUM (legal metadata)
- **Confidence:** High
- **File+line:** `README.md:169-171` vs `LICENSE:1-15`
- **Status:** Deferred (D-02), unchanged.

### C2-DOC02: `ilpOptimize` JSDoc — `@deprecated` tag now present (FIXED from C1-DOC02)

- **Severity:** N/A (fixed)
- **File+line:** `packages/core/src/optimizer/ilp.ts:41-44`
- **Description:** The `@deprecated` tag was added to `ilpOptimize` since cycle 1. JSDoc now correctly states "Not yet implemented. Currently delegates to `greedyOptimize`." Verified.
- **Status:** FIXED.

## Summary

0 net-new doc findings. 1 fix verified (C2-DOC02). 1 re-confirmed deferred item (D-02).
