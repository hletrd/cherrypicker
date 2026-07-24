# Plan 149: Cycle 19 YearMonth Validation Totality

**Finding:** C19-001 (Low / High confidence)
**Status:** completed
**Deploy mode:** none

## Outcome

Keep `previousCalendarMonth()` explicitly partial at the lower edge of the
four-digit calendar domain while making the web coherence and persistence
validation APIs total and fail-closed for every structurally admitted value.

## Evidence

- `packages/core/src/analysis/context.ts:77-114` admits `0000-01` as a valid
  `YearMonth` and deliberately throws a `RangeError` when asked for its
  unrepresentable predecessor.
- `apps/web/src/lib/analysis-result.ts:893-920` computes a predecessor inside
  previous-spending-basis validation.
- `apps/web/src/lib/analysis-result.ts:922-981` computes the truncated latest
  month's predecessor before basis-kind handling.
- `apps/web/src/lib/analysis-result.ts:1031-1038` dispatches structurally
  admitted transaction-free results into that truncated path.
- `apps/web/src/lib/persistence.ts:677-708,822-845` admits `0000-01` in stored
  basis/monthly facts.
- `apps/web/src/lib/persistence.ts:860-915` invokes coherence after the JSON
  and migration catches, allowing the domain exception to escape.
- `apps/web/src/lib/store.svelte.ts:117-148` catches the exception only at the
  storage adapter, removes the snapshot, and labels it as storage access
  failure instead of corrupted data.

Supported statement parsers remain limited to years 1900–2100. The affected
state is constructed, tampered, or stale persistence, so severity stays Low.
The correctness/reliability root is not deferred.

## Domain and boundary decisions

1. `previousCalendarMonth(parseYearMonth('0000-01'))` remains a public
   `RangeError`; the shared core contract is not weakened or widened.
2. A boolean coherence predicate must return `false`, not throw, for a
   structurally admitted month whose required predecessor is unrepresentable.
3. A `user-total` basis does not depend on a calendar predecessor and must
   validate without attempting to derive one.
4. Calendar-derived statement/missing bases use one validation-local checked
   predecessor boundary. It converts only the documented lower-bound
   condition into an incoherent result; unexpected programming errors are not
   silently swallowed there.
5. The deserializer is an untrusted-data boundary and defensively maps any
   final coherence exception to its standard corrupted/removal result.
6. The full transaction-backed year-0000 path remains invalid at ISO-date
   collection before predecessor computation.

## Implementation

### 1. Make previous-spending-basis coherence basis-aware

- [x] Refactor `hasExactPreviousSpendingBasis()` so it validates
      `user-total` and its redundant option before any calendar calculation.
- [x] Pass a month-membership callback or equivalent facts collection into
      the helper instead of precomputing a boolean for one predecessor.
- [x] For statement/missing bases, derive the predecessor through a narrow
      validation helper that returns no value only for exact `0000-01`.
- [x] Remove the unconditional predecessor calculation from
      `hasCoherentTruncatedFacts()`.
- [x] Remove the duplicate unconditional predecessor calculation from the
      full transaction-backed return path.

### 2. Keep persistence fail-closed

- [x] Wrap only the final coherence admission in `deserializeAnalysis()` and
      return `invalidResult()` if validation throws.
- [x] Preserve all existing warning/truncation semantics for successfully
      validated current payloads.
- [x] Do not broaden types, suppress diagnostics, or alter the store's outer
      recovery policy to mask the root.

### 3. Add deterministic regressions

- [x] Strengthen the direct helper test to require both the `RangeError` class
      and exact lower-bound message.
- [x] Add an `isAnalysisResultCoherent()` truncated `user-total` witness at
      `0000-01`; it must not derive a predecessor and must remain coherent
      when all other facts agree.
- [x] Add truncated statement/missing basis witnesses at `0000-01`; they must
      return `false` without throwing.
- [x] Add a valid `0000-02 -> 0000-01` truncated control.
- [x] Add a full-transaction year-0000 control that returns `false` before
      predecessor derivation.
- [x] Add a current-version persistence witness proving
      `deserializeAnalysis()` returns
      `{ data: null, warningKind: 'corrupted', truncatedTxCount: null,
      shouldRemove: true }` without throwing.
- [x] Add a defensive persistence test whose coherence phase throws for an
      admitted malformed value only if it can be constructed without a test
      suppression; otherwise rely on the exact lower-bound witness.

### 4. Validate and close

- [x] Run focused web calendar, coherence, and persistence tests.
- [x] Run `bun run lint`.
- [x] Run `bun run typecheck`.
- [x] Run `bun run build`.
- [x] Run `bun run test`.
- [x] Run `bun run test:bun`.
- [x] Run `bunx vitest run`.
- [x] Run one owned `bun run test:e2e` attempt with exact pre/post process,
      profile, session, PID/PGID, and port cleanup proof.
- [x] Update this plan to completed with exact focused/full-gate evidence.
- [x] Archive this plan after closure.

## Completion evidence

- Implementation used the documented disciplined manual fallback because
  `ralph` was unavailable.
- `e1ec22db7a817e2b96d680afd79b97b67c44d547` makes the persistence boundary
  fail closed and adds the current-version `0000-01` corruption witness.
- `8bf91d2739524d9b0bdc6951938c7992a8a03c7c` makes basis validation lazy and
  total while retaining the direct helper's exact lower-bound `RangeError`.
- Focused calendar, coherence, and persistence tests passed: 234 tests and
  579 expectations. The persistence suite also passed independently with
  155 tests and 445 expectations.
- `bun run lint` passed with zero errors, warnings, or hints.
- `bun run typecheck` passed with zero errors, warnings, or hints.
- `bun run build` passed all 7 workspace tasks and built all 5 Astro pages.
- `bun run test` passed all 12 Turbo tasks; the web suite reported 935 tests
  and 4,361 expectations, and script tests reported 96 tests and 1,032
  expectations.
- `bun run test:bun` passed 1,641 tests with 3,319 expectations.
- `bunx vitest run` passed 128 files and 3,143 tests.
- The single owned E2E run
  `1784871729968-ced69b3a-d446-44d7-9c11-7767d906f138` selected port 4173
  and passed all 97 tests. Exact preflight and postflight checks found no
  owned run metadata, profiles, sessions, or process trees; ports 4173–4175
  were free afterward, and unrelated Chrome PID/PGID 1368/1368 remained
  running.
- No gate required a corrective commit, and no deployment, release,
  publication, or deploy workflow was invoked.

## Acceptance

- The public direct helper still raises the documented `RangeError`.
- Truncated `user-total` at `0000-01` does no unnecessary calendar work.
- Truncated calendar-derived bases at `0000-01` return false.
- `deserializeAnalysis()` never exposes a coherence exception from
  untrusted stored input.
- Valid predecessor, modern calendar, and persistence round-trip behavior is
  unchanged.
- All configured gates pass.
- No deployment, release, publication, or deploy workflow invocation occurs.
