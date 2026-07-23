# Plan 82 — Cycle 3 Web Cancellation and State Transitions

**Findings:** C3-022, C3-023, C3-024
**Deploy mode:** none
**Status:** completed

## Outcome

Stop all work owned by a canceled analysis, keep persistent and in-memory
results atomic across replacement failures, and prevent an old success timer
from navigating over a new file selection.

## Tasks

- [x] Thread the current operation signal through caller-scoped
  `loadCategories` and `loadOptimizerCatalog` waits. Check current/aborted state
  after every await and immediately before result/persistence work without
  canceling shared cache fills needed by another live caller.
- [x] Move browser optimizer execution behind a cancellable boundary (worker or
  equivalently yielding chunks) and add cooperative abort checks inside its
  long loops. A canceled caller must settle promptly and must not run the
  remaining 683-card work. The worker implementation uses preemptive
  `terminate()` on abort, so canceled loops stop without waiting for an inner
  cooperative checkpoint.
- [x] Add two-caller deferred-loader and optimizer tests proving one aborted
  caller does not poison shared caches or commit stale state while the live
  caller succeeds.
- [x] Adopt explicit replacement semantics: beginning a new analysis clears the
  prior in-memory result and its persisted record together. Non-abort failure
  leaves both empty; abort and reset follow a documented consistent policy.
- [x] Add real store/runtime coverage for success A → failure B → reload/direct
  route, including result, error, generation, persistence warning, and storage
  bytes.
- [x] Centralize pending-navigation cancellation. Any admitted file mutation
  after success must clear the old timeout, invalidate its run ownership, and
  guard the timeout callback before navigation.
- [x] Replace fixed timer waits with fake-timer/component state assertions and
  add one real-browser drop during the success countdown.

## Acceptance

- [x] Cancellation during categories, optimizer artifact validation, or
  optimization promptly settles the caller and performs no stale commit.
- [x] A failed replacement cannot resurrect the prior result after reload or
  direct-route navigation.
- [x] A newly dropped file remains selected and the old success timer cannot
  navigate to the previous dashboard.
- [x] Web unit, typecheck, build, and scoped E2E pass; owned browser and preview
  processes are clean after every run.

## Coverage

| Finding | Completion evidence |
|---|---|
| C3-022 | signal-aware loaders and cancellable optimizer tests |
| C3-023 | atomic replacement/storage/reload regression |
| C3-024 | countdown mutation ownership and real-browser drop test |

## Completion evidence

- `bun test apps/web/__tests__` — 320 passed, 0 failed.
- `bun run --cwd apps/web typecheck` — 0 errors, warnings, or hints.
- `bun run --cwd apps/web build` — 5 static routes built successfully.
- `bun run test:e2e` — 90 passed, including the real drop-during-countdown
  regression and controlled-clock timer ownership assertions.
- Preflight and post-run ownership audits found no repository-owned stale
  browser/preview process and port 4173 was free.
- `git diff --check` — clean for all Plan 82-owned files.
- No deployment was performed.
