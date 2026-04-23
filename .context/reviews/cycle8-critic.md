# Cycle 8 — critic

## Inventory

All project docs + plans:
- `.context/plans/00-deferred-items.md` (1023 lines)
- `.context/plans/cycle7-orch-plan.md`
- `.context/plans/cycle6-orch-plan.md`
- `.context/reviews/_aggregate.md` (cycle 7)
- `.context/reviews/cycle7-*.md` (per-agent)
- `CLAUDE.md`, `AGENTS.md`, `apps/web/CLAUDE.md`

## Criticisms

### CR8-01 — Archive overdue (MEDIUM / High)

Cycle 6 finished cleanly (74/74 e2e), and cycle 7 closed D6-01 + D6-02. Neither `cycle6-orch-plan.md` nor `cycle6-review.md` nor `cycle6r-fixes.md` have been archived. The plans directory has 60+ files and discoverability suffers.

- Fix: move `cycle6-orch-plan.md`, `cycle6-review.md`, `cycle6-ingested.md` (if present), and any cycle-6 fix docs that are fully implemented into `.context/plans/_archive/`. Preserve history via `git mv`.
- Orchestrator prompt 2 explicitly asks for this.

### CR8-02 — Deferred-fix hygiene: D7-M2 `setResult` should be DELETED not deferred indefinitely (LOW / Medium)

The `setResult` method at `store.svelte.ts:452-459` has zero callers in apps/e2e/tests. Its "footgun" nature is that it bypasses `analyze()`'s merge-back logic. Since there is no caller, the right fix is deletion, not indefinite deferral.

- Fix: delete `setResult` in this cycle (safe removal; no import breakage). Update D7-M2 exit criterion or mark RESOLVED.

### CR8-03 — D7-M1 cleanup is cheap enough to land (LOW / High)

Lines 601-602 of `store.svelte.ts` reset module-level `_loadPersistWarningKind` and `_loadTruncatedTxCount` in `reset()`. These are already zeroed at line 379-380 in `createAnalysisStore()` and never re-assigned except during `loadFromStorage()`. `reset()` is called while the store instance is live, so those assignments are no-ops.

- Fix: delete the two lines. 2-line diff, zero risk.

### CR8-04 — D7-M4 `-0` edge case fix is one line (LOW / Medium)

`parsePreviousSpending` currently returns `-0` for input `-0`. While `-0 === 0` is true, string concat (`"" + -0`) and `Object.is(n, -0)` behave differently. Low risk but asymmetric: fixing is literally `return Math.max(n, 0) ... ` or `n === 0 ? 0 : n`.

- Fix: land in this cycle.

### CR8-05 — D7-M10 `aria-busy` fix is trivial and resolves a real a11y gap (LOW / Medium)

The spinner at FileDropzone.svelte:490-505 indicates busy state visually, but screen readers don't get the state. Adding `aria-busy={uploadStatus === 'uploading'}` on the form wrapper is a 1-line fix.

- Fix: land.

### CR8-06 — D7-M3 `clearTimeout` defense costs 1 line (MEDIUM / Medium)

At FileDropzone.svelte:276, assigning `navigateTimeout = setTimeout(...)` without first clearing any prior pending timeout risks stacking handlers if `handleUpload()` is entered twice within 1.2s. UI disables the button during 'uploading'|'success' so it's physically improbable, but defensive `clearTimeout(navigateTimeout)` is cheap.

- Fix: land.

### CR8-07 — Cycle 7 plan's archive-sweep instruction never executed (MEDIUM / High)

The cycle 7 orchestrator plan explicitly states:
> "Cycle-6 `cycle6-orch-plan.md` items P1-01 through P1-15 are all implemented (see cycle 6 commits). Archive the plan to `.context/plans/archive/` once the cycle-7 commits land."

Cycle 7 landed and this step was missed. Cycle 8 should execute.

## Cross-cycle observations

- Cycles 5–98 ran, converged, then cycle 5 (UI/UX) + cycle 6 re-opened with 40+ findings + cycle 7 closed 7 HIGH items. Cycle 8 is pure cleanup; fresh fan-out should produce zero NEW HIGH findings if previous work was sound.
- The `bun run verify` gate is stable. `bun run test:e2e` 74/74 passing is the invariant. Any cycle 8 fix that touches components must be verified to not regress it.

## Risks & watch-list

- Touching `store.svelte.ts` near `reset()` without running the full gate can corrupt sessionStorage warning signaling. Run `bun run verify` after each change.
- Touching `FileDropzone.svelte` risks e2e regression. Run the affected e2e spec subset after each change.
