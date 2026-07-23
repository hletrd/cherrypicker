# Plan 75 — Cycle 2 Web Lifecycle, Cancellation, and Admission

**Findings:** C2-011, C2-012, C2-013, C2-026
**Deploy mode:** none
**Status:** completed
**Archived:** 2026-07-23 after Cycle 2 closure

## Outcome

Give every asynchronous analysis one owner, stop canceled parser work, enforce
bounded upload admission, and keep keyboard navigation on the current route.

## Tasks

- [x] Replace analyze-only request ownership with one store operation epoch
  shared by analyze, reoptimize, cancel, and reset. Guard result, persistence,
  error, generation, and loading commits after every await.
- [x] Add deferred-dependency tests for reoptimize A followed by analyze B,
  reset, cancel, and reverse-order reoptimizations.
- [x] Pass `AbortSignal` through the queue, analyzer, parser dispatcher, and
  adapters. Check long loops and make active work reject with `AbortError`.
- [x] Retain PDF loading task/document handles and destroy/cleanup them in
  `finally` on success, failure, and abort. Test exactly-once cleanup.
- [x] Move upload admission into a pure helper. Enforce per-file, 50 MB
  aggregate, and explicit file-count ceilings across repeated additions while
  preserving stable accepted/rejected order and duplicate handling.
- [x] Build the skip-link target from the current pathname plus fragment rather
  than a fragment-only URL under `<base>`. Add nested-route URL and focus tests.

## Acceptance

- [x] Stale operations cannot mutate or persist newer store state.
- [x] Canceling active PDF work promptly releases every owned resource.
- [x] The upload list can never exceed byte/file ceilings.
- [x] The skip link remains on dashboard/cards/results/report routes and moves
  focus to `main-content`.
- [x] Web unit, typecheck, build, and scoped E2E tests pass with clean ownership.

## Coverage

| Finding | Completion evidence |
|---|---|
| C2-011 | operation-epoch overlap tests |
| C2-012 | adapter abort and PDF cleanup tests |
| C2-013 | pure admission boundary matrix |
| C2-026 | nested-route skip-link regression |
