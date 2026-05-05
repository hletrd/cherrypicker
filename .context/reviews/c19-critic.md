# Critic Review — cherrypicker (Cycle 19)

**Reviewer:** critic
**Scope:** Multi-perspective critique of design decisions, trade-offs, maintainability
**Date:** 2026-05-06

---

## Summary

The codebase continues to improve incrementally. Cycle 18 cleaned up residual type safety issues. Cycle 19 surfaces a design inconsistency in spending calculation and raises concerns about the sustainability of the server/web parser duplication strategy.

---

## Findings

### C19-CRIT01 [MEDIUM] — Conflicting conventions for 전월실적 calculation

**Files:** `apps/web/src/lib/analyzer.ts:327-332`, `apps/web/src/lib/store.svelte.ts:498-519`
**Confidence:** High

Two functions that compute the same metric (monthly spending for 전월실적) use opposite conventions and both cite the same design note (C1-01). This suggests the convention was changed in one place and not the other, or the design note is ambiguous.

The broader concern: without a single source of truth for "how is monthly spending calculated?", future refactors will continue to introduce inconsistencies.

**Fix:** Extract a shared `calculateMonthlySpending(transactions, convention)` utility used by both paths.

---

### C19-CRIT02 [MEDIUM] — The "parity copy" strategy is not scaling

**Files:** `apps/web/src/lib/parser/{csv,json,ofx,html,xlsx,pdf}.ts`
**Confidence:** High

With 6 parser formats now duplicated between server and web, the "copy and keep in sync" strategy is producing noticeable drift:
- `normalizeHTML` exists in both `csv/shared.ts` and `html.ts`
- `parseOFXAmount` lacks full-width normalization that `parseAmountString` has
- The web PDF parser is a partial port with its own comment trail

The comments ("parity with server-side", "C97-01", etc.) are a smell — they indicate the code SHOULD be shared but isn't. Each cycle adds more duplication.

**Fix:** Prioritize A-ARCH-01 (server/web parser unification) in the next architectural cycle.

---

### C19-CRIT03 [LOW] — `esc()` double-encoding reflects a deeper pattern

**File:** `packages/viz/src/report/generator.ts:31-42`
**Confidence:** Medium

Rolling your own HTML escaping is a classic anti-pattern. The `esc()` function is already the third iteration (backslash escaping was removed in cycle 18). Each iteration fixes one bug and risks introducing another.

**Fix:** Replace `esc()` with a well-tested library like `he` or DOMPurify for the report generation context.

---

## Verdict

**FIX AND SHIP** — Address C19-CRIT01 (the spending inconsistency) as it affects user-visible data.
