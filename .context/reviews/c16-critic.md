# Cycle 16 — Critic Review

**Date:** 2026-05-06
**Scope:** Multi-perspective critique

## Findings

### C16-CR01 [MEDIUM] — Refund transactions create a confusing user experience
- **File:** `apps/web/src/lib/store.svelte.ts:209` (systemic issue)
- **User perspective:** Users upload statements with refunds. They see refunds in the transaction list. They refresh the page. Refunds disappear. No error message explains why. This violates user trust.
- **Maintainer perspective:** The `isOptimizableTx` function has a misleading comment that doesn't mention negative amounts. Future maintainers might "fix" this by making it stricter, worsening the data loss.
- **Domain perspective:** Korean credit card statements regularly include refunds (cancelled transactions, returns). The app must handle them gracefully — even if they don't contribute to optimization, they should be visible.
- **Fix:** Allow negative amounts in `isOptimizableTx` (change to `amount !== 0`). The optimizer already handles them correctly by skipping non-positive amounts.
- **Confidence:** High

### C16-CR02 [LOW] — Monorepo duplication creates cognitive overhead
- **Files:** `apps/web/src/lib/parser/` vs `packages/parser/src/`
- **Maintainer perspective:** Every parser change requires mental tracking of which files need dual updates. The parity fixes in C99/C100 addressed specific bugs but the structural problem persists.
- **New contributor perspective:** It's unclear which parser is the "canonical" implementation. The web-side copies have comments referencing server-side parity, suggesting they are secondary.
- **Fix:** Consolidate parsers into `packages/parser/` and have the web app import directly. This is the stated architecture in CLAUDE.md but not fully realized.
- **Confidence:** High

## Summary
One MEDIUM UX finding and one LOW architecture finding. Both relate to long-standing issues that affect user trust and maintainability.
