# Cycle 9 — code-reviewer

Scope: full repo re-scan after cycle-8 resolutions (D7-M1/3/4/10).

## Verification of cycle 8 fixes (all FIXED)

- C8-01 / D7-M1 dead `_loadPersistWarningKind` reset: removed — verified in `apps/web/src/lib/store.svelte.ts` (no `reset()` reference to `_loadPersistWarningKind`).
- C8-02 / D7-M4 parsePreviousSpending `-0` coercion: verified in `apps/web/src/components/upload/FileDropzone.svelte`.
- C8-03 / D7-M10 `aria-busy` on upload form: verified.
- C8-04 / D7-M3 `clearTimeout` defense-in-depth: verified.
- C8-05: cycle-6 and cycle-7 plans archived to `_archive/`.

## New findings this cycle

### C9CR-01 — `setResult` is dead code (promoted from D7-M2)

- **Severity:** MEDIUM (footgun risk) — promotion rationale: exit criterion "first caller appears, or the method is deleted" is trivially satisfiable by deletion, and C8CR-01 (cache-invalidation omission) is co-resolved by deletion.
- **Confidence:** High.
- **File+line:** `apps/web/src/lib/store.svelte.ts:452-459`.
- **Evidence:** `rg 'setResult' -F` across `apps/`, `e2e/`, `packages/`, `tools/` returns ONLY the definition site at `apps/web/src/lib/store.svelte.ts:452`. Remaining matches are in `.context/**` (review/plan prose only).
- **Failure scenario:** A future contributor (or Claude in a future cycle) adds a caller, but the method bypasses `analyzeMultipleFiles` — so there is no analyzer-cache invalidation, no category-label cache clearing, no error reset on a stale analyze-failure. Result: silent stale-reward UI after a synthetic `setResult`.
- **Fix:** Delete the method. Zero callers → zero regressions. If a caller is later needed, it should be added with proper cache hygiene.
- **Co-resolves:** C8CR-01 (setResult skips analyzer-cache invalidation).

### C9CR-02 — no other new findings

Re-grepped the high-risk surfaces (store, analyzer, FileDropzone, parser adapters, optimizer). All cycle 6/7/8 fixes hold. No new regressions.

## Confirmed carry-overs (still deferred, exit criteria unchanged)

- D7-M5 (malformed-date drop in monthlyBreakdown) — behavioural convention, still LOW.
- D7-M6 (module-level `_loadPersistWarningKind` pattern) — tied to A7-02 persistence extraction, unchanged.
- D7-M7, D7-M8, D7-M11, D7-M12, D7-M13, D7-M14 — unchanged (all have their tooling or architectural exit criteria).
- C6UI-04, C6UI-05, C6UI-23 — unchanged (axe-core gate).

Confidence: High. No finding silently dropped.
