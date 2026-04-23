# Cycle 8 orchestrator plan — resolve low-hanging D7-M deferrals + archive sweep

Scope: promote 4 of 14 cycle-7 deferrals to in-scope resolution, execute the overdue archive sweep, keep e2e 74/74 green.

## In-scope (implement this cycle)

### C8-01 — Delete dead `_loadPersistWarningKind` / `_loadTruncatedTxCount` reset in `store.reset()` [LOW, resolves D7-M1]

- File: `apps/web/src/lib/store.svelte.ts:601-602`.
- Action: remove the two lines. Module-level vars are already nullified at construction (:379-380) and there is a singleton store, so the `reset()` path is dead.
- Verify: `bun run verify` (typecheck + lint + unit). No behavior change expected.
- Status: DONE

### C8-02 — Coerce `-0` to `+0` in `parsePreviousSpending` [LOW, resolves D7-M4]

- File: `apps/web/src/components/upload/FileDropzone.svelte:228-244`.
- Action: ensure `parsePreviousSpending` never returns `-0`. Use `n === 0 ? 0 : n` or `n || 0` at the final `return` paths (both number and string branches).
- Verify: `bun run verify`. Consider adding a unit test guarding `Object.is(parsePreviousSpending(-0), 0)`.
- Status: DONE

### C8-03 — Add `aria-busy` to upload form wrapper [LOW, resolves D7-M10]

- File: `apps/web/src/components/upload/FileDropzone.svelte` — outer `<div class="flex flex-col gap-5">` at line 306.
- Action: bind `aria-busy={uploadStatus === 'uploading'}` on the wrapper.
- Verify: DOM static inspection + `bun run verify` + `bun run build`.
- Status: DONE

### C8-04 — Defensive `clearTimeout(navigateTimeout)` before reassignment [MEDIUM, resolves D7-M3]

- File: `apps/web/src/components/upload/FileDropzone.svelte:276`.
- Action: insert `if (navigateTimeout) { clearTimeout(navigateTimeout); navigateTimeout = null; }` immediately before `navigateTimeout = setTimeout(...)`.
- Verify: `bun run verify`. No e2e regression expected.
- Status: DONE

### C8-05 — Archive fully-implemented cycle plans [MEDIUM, executes cycle-7 plan's archive instruction]

- Files under `.context/plans/`:
  - `cycle6-orch-plan.md` — fully resolved (C7 closes its tail deferrals).
  - `cycle6-review.md` — resolved.
  - `cycle6r-fixes.md` — cycle 6 re-review fixes, all landed.
  - `cycle7-orch-plan.md` — cycle 7 closed; D7-M deferrals tracked in `00-deferred-items.md`.
  - `cycle7-re-review-fixes.md` — resolved.
- Action: create `.context/plans/_archive/` (via `git mv`). Use `git mv` to preserve history.
- Verify: `ls .context/plans/` shows fewer files; `ls .context/plans/_archive/` shows archived plans.
- Status: DONE

### C8-06 — Refresh `00-deferred-items.md` with cycle-8 resolutions [MEDIUM]

- File: `.context/plans/00-deferred-items.md`.
- Action: append a cycle-8 section marking D7-M1, D7-M3, D7-M4, D7-M10 as RESOLVED (citing the respective C8-0x commits). Keep D7-M2, D7-M5, D7-M6, D7-M7, D7-M8, D7-M9, D7-M11, D7-M12, D7-M13, D7-M14 deferred with unchanged severity/exit-criterion.
- Status: DONE

## Deferred items (strict)

All other D7-M items remain deferred. Re-documented severity/confidence/reason/exit-criterion in aggregate (`.context/reviews/cycle8-aggregate.md`) and `00-deferred-items.md`. No security / correctness / data-loss finding is deferred. Repo rule compliance: CLAUDE.md + AGENTS.md observed; deferred MEDIUM/LOW items not classified as blocking.

Specifically preserved deferrals:
- D7-M2 `setResult` footgun — keep deferred this cycle; candidate for deletion next cycle (zero callers confirmed).
- D7-M5 malformed-date row drop — keep deferred per C6-01 documented convention.
- D7-M6 module-level mutable persistence state — keep deferred, tied to A7-02.
- D7-M7 `reuseExistingServer` — keep deferred, awaits CI pipeline.
- D7-M8 axe-core gate — keep deferred, a11y cycle gate.
- D7-M9 screenshots spec — intentional smoke harness.
- D7-M11 arch refactors — dedicated cycle.
- D7-M12 card-rules refetch — negligible at scale.
- D7-M13 CSP `unsafe-inline` — Astro nonce upstream gate.
- D7-M14 test-selector polish — future test-engineer cycle.
- C6UI-04, C6UI-05 — MEDIUM, axe-core cycle.
- C6UI-23 — LOW, AAA 44×44 upgrade.

## Verification plan

1. `bun run verify` after each source change — lint + typecheck + unit tests.
2. `bun run build` — at least once after all source changes.
3. `bun run test:e2e` — run full suite once all source changes landed; must remain 74/74.

## Commit protocol

- One commit per C8-0x task. GPG-sign (`-S`). Conventional + gitmoji. No Co-Authored-By. `git pull --rebase` before push.

## Exit criteria

- 4 D7-M deferrals resolved; remaining 10 deferrals re-documented with preserved severity.
- Gates: verify + build + e2e all green.
- Plans archived; `.context/plans/` is leaner.
- `00-deferred-items.md` updated.

## Cycle 8 result

- D7-M1 RESOLVED via C8-01 (dead-code cleanup in `store.reset()`).
- D7-M3 RESOLVED via C8-04 (defensive `clearTimeout` before navigateTimeout reassignment).
- D7-M4 RESOLVED via C8-02 (`parsePreviousSpending` normalizes `-0` → `+0`).
- D7-M10 RESOLVED via C8-03 (`aria-busy` on upload form during uploading).
- Archive sweep (C8-05) moved 5 cycle-6/7 plan files to `.context/plans/_archive/` via `git mv` (history preserved).
- `00-deferred-items.md` (C8-06) appended with cycle-8 resolutions and re-affirmed deferrals.
- Remaining 10 D7-M items + C6UI carry-overs kept deferred with severity/exit-criterion unchanged.
- No security / correctness / data-loss finding deferred.
- Gates green: `bun run verify` exit 0; `bun run build` exit 0. e2e run pending final commit batch.
