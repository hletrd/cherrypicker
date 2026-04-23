# Cycle 9 Orchestration Plan

## Goal

Close the single actionable cycle-9 finding (C9-01 / D7-M2 promotion) without regressing cycles 6/7/8 fixes. Keep 74/74 e2e. Update deferred-items ledger.

## Scope

1. Delete `setResult` method from `apps/web/src/lib/store.svelte.ts` (lines 452-459). Zero callers across entire repo (confirmed by grep). Co-resolves C8CR-01 (cache-invalidation footgun).
2. Refresh `.context/plans/00-deferred-items.md` with cycle-9 section: mark D7-M2 RESOLVED, C8CR-01 RESOLVED (subsumed), re-confirm remaining deferrals.
3. Run verify + build + test:e2e gates. All green.

## Task list

### Task 1 — Delete `setResult` (C9-01, resolves D7-M2, co-resolves C8CR-01)

- **File:** `apps/web/src/lib/store.svelte.ts`
- **Change:** remove lines 452-459 (`setResult(r: AnalysisResult): void { ... }`) and the surrounding blank lines if orphaned.
- **Verification:** `rg 'setResult' apps/ e2e/ packages/ tools/` returns zero matches post-change.
- **Commit:** `refactor(web): 🔥 remove dead setResult method from analysisStore (C9-01, resolves D7-M2, co-resolves C8CR-01)`
- **Status:** IMPLEMENTED (verify + build pending)

### Task 2 — Update deferred-items ledger

- **File:** `.context/plans/00-deferred-items.md`
- **Change:** add "Cycle 9 resolutions and status re-affirmation" section.
  - RESOLVED: D7-M2 (by C9-01), C8CR-01 (subsumed).
  - Re-affirm remaining deferrals with severity preserved.
- **Commit:** `docs(plans): 📝 cycle 9 refresh — D7-M2 resolved, C8CR-01 subsumed`
- **Status:** IMPLEMENTED

### Task 3 — Run gates

- `bun run verify` — lint + typecheck + vitest/bun tests. Must stay green.
- `bun run build` — turbo. Must stay green.
- `bun run test:e2e` — Playwright. Must stay 74/74.
- **Status:** PENDING (runs after Task 1)

## Completion criteria

- Task 1 committed and pushed.
- Task 2 committed and pushed.
- Gates all green (0 regressions).
- Deferred-items ledger reflects cycle-9 state.

## Out of scope

- D7-M5, D7-M6, D7-M7, D7-M8, D7-M9, D7-M11, D7-M12, D7-M13, D7-M14 (exit criteria unchanged, see aggregate).
- C8-04..C8-10, C8-12, C8-13 (LOW; still deferred).
- C6UI-04, C6UI-05, C6UI-23 (tied to axe-core gate cycle).
- D8-01, D8-02 (a11y cycle).
