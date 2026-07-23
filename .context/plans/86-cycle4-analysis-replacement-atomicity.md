# Plan 86 - Cycle 4 Analysis Replacement Atomicity

**Findings:** C4-011, C4-012
**Status:** complete
**Deploy mode:** none

## Outcome

Require live caller ownership and successful persisted-state deletion before a
replacement can mutate committed analysis.

## Tasks

- [x] Reject an aborted or non-current caller before
  `OperationEpoch.begin()`, dependency calls, loading changes, storage changes,
  memory changes, generation increments, or owned-operation invalidation.
- [x] Recheck composed caller/operation ownership after every await and
  immediately before each state or persistence mutation.
- [x] Treat `clearPersistedAnalysis().kind === 'error'` as a terminal
  replacement precondition failure. Preserve committed result A and its
  generation, stop before analyzer loading or B persistence, end loading, and
  expose a specific clear failure through the existing error/warning channels.
- [x] Document the resulting state transition for success A, stale B, clear
  failure B, analysis failure B, abort, and reset.
- [x] Add dependency-spy tests that prove stale entry and clear failure perform
  no downstream work and cannot disturb a current owned operation.
- [x] Add clear-error plus reload coverage proving in-memory and persisted A
  remain consistent and no failed B bytes are written.

## Acceptance

- [x] A stale or already-aborted run is a complete no-op across dependencies,
  loading, result, error, warning, generation, storage, and operation ownership.
- [x] A storage-clear error preserves A in both memory and storage, preserves
  generation, makes no analyzer/persist call, and leaves loading false with a
  specific actionable error/warning.
- [x] A current replacement with a successful clear retains the established
  atomic success, failure, and abort behavior.
- [x] Runtime, store, persistence, web type, and unit gates pass.

## Implemented state transitions

| Event | In-memory result | Persisted result | Generation and visible state |
|---|---|---|---|
| Successful A | A | A | generation advances when A commits; loading ends |
| Stale or pre-aborted B | A | A | complete no-op, including the current operation owner |
| Clear failure for B | A | A | generation preserved; loading ends with the specific clear error and `error` persistence warning |
| Analysis failure for B after a successful clear | empty | empty | advances once when A is removed; exposes the analysis error |
| Abort B after a successful clear | empty | empty | advances once when A is removed; suppresses an abort error |
| Idle cancel | A | A | generation and committed state preserved |
| Reset | empty | empty when storage deletion succeeds | active ownership invalidated; error, loading, and persistence warnings cleared |

## Verification progress

- `bun test apps/web/__tests__/analysis-replacement-runtime.test.ts`:
  5 passed, 0 failed.
- Focused runtime/epoch/persistence gate:
  21 passed, 0 failed.
- `bun run --cwd apps/web typecheck`: passed with 0 errors, warnings, or hints.

## Coverage

| Finding | Required evidence |
|---|---|
| C4-011 | already-stale and already-aborted entry no-op tests |
| C4-012 | failed-clear terminal precondition and reload consistency tests |

## Expected implementation surface

- `apps/web/src/lib/analysis-replacement-runtime.ts`
- `apps/web/__tests__/analysis-replacement-runtime.test.ts`
- adjacent store/persistence tests only if the public state contract requires
  them
- this plan for completion evidence

No parser, optimizer, card UI, E2E, deploy, commit, or push work belongs to this
plan.
