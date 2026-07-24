# Plan 109 — Cycle 8 Analysis DTO and Persistence Coherence

**Findings:** C8-001 (Medium/High), C8-008 (Medium/High)
**Status:** archived (completed, including Cycle 20 C20-B-001)
**Deploy mode:** none

The Cycle 8 closure below remains historical evidence. Cycle 20 reproduced one
missed monthly-bucket invariant inside that exact contract, so this plan is
active again until the new completion section is satisfied.

## Evidence

- `AnalysisResult` and related execution types live in `store.svelte.ts`, so
  analyzer and persistence code import a framework-owned state module while
  the store imports those same services.
- `deserializeAnalysis()` validates shapes, individual transactions, and
  bounds but accepts cross-field contradictions. Mutating totals, counts,
  rates, assignments, card summaries, or monthly breakdowns in an otherwise
  valid serialized result restores successfully.

## Outcome

The analysis result is a framework-free domain DTO with one-way dependencies,
and persisted snapshots restore only when all stored derivations form one
coherent analysis.

## Implementation

1. Create a framework-free `analysis-result.ts` module for categorized
   transactions, analysis options/execution metadata, and `AnalysisResult`.
   Make analyzer, persistence, transaction validation, and store import that
   module directly; retain intentional type re-exports only at public
   compatibility boundaries.
2. Add a semantic coherence validator after structural/sanitization checks.
   Validate unique identifiers/references, transaction and current-period
   counts, statement periods, monthly count/spending summaries, assignment and
   card-result totals, rewards, rates, cap references, best-single-card
   comparison, and savings arithmetic using the same checked Won/rate rules as
   production.
3. Account explicitly for intentional `_truncatedTxCount` snapshots and the
   optimizer's recorded unassigned spending/count contract from Plan 110.
   Never infer absent raw rows from a legitimately disclosed truncated
   snapshot.
4. On any semantic mismatch, reject atomically with the existing removal/error
   path. Do not silently repair one field while retaining derivations produced
   by a different snapshot.

## Tests

- Dependency tests prove the domain DTO imports no Svelte/store module and
  analyzer/persistence do not depend on `store.svelte.ts`.
- Start from one real valid serialized analysis, mutate each count, sum,
  reward, effective rate, assignment/card reference, monthly bucket,
  best-single result, and savings field independently, and require atomic
  rejection.
- Valid empty, partial-warning, exact-cap, unassigned-spending, migrated, and
  intentionally transaction-truncated snapshots still round trip.
- Runtime store/dashboard tests prove a rejected snapshot cannot render stale
  financial totals.

## Acceptance

- [x] Analysis domain types have a one-way, framework-free dependency graph.
- [x] Every stored derived field agrees with the snapshot that produced it.
- [x] Disclosed transaction truncation remains restorable without false
      reconstruction.
- [x] Semantic corruption is rejected atomically and removed from storage.

## Completion evidence

- `analysis-result.ts` now owns the framework-free DTO and semantic validator;
  analyzer, persistence, runtime, transaction validation, and Svelte state
  depend on it in one direction.
- Persistence reconciles periods, monthly buckets, checked totals/rates,
  assignments, per-card/category results, best-single savings, selected cards,
  exact all-unassigned counts, and explicit positive truncation provenance.
- Initial analysis and reoptimization normalize replacement card selections
  and revalidate before commit/persist. Legacy snapshots migrate only when
  fully assigned semantics are provable; ambiguous mixed/truncated v2 data
  fails closed.
- The bounded coherence suite passed 192 tests, final web tests passed 741,
  and web lint/typecheck reported zero errors, warnings, or hints.

## Execution note

`ralph` is unavailable. Prompt 3 will use a manual mutation-matrix loop,
checked arithmetic helpers, and focused runtime round-trip tests.

## Cycle 20 reopen — zero-count monthly bucket

**Review obligation:** C20-B-001
**Severity / confidence:** Low / High
**Novelty:** historical Plan 109 completion gap; not a new Cycle 20 root
**Status:** completed

### Current evidence

- `packages/core/src/analysis/context.ts:157-175,189-205` creates a monthly
  bucket only while processing a transaction and increments that bucket's
  count on the same path. A represented bucket therefore always contains at
  least one transaction.
- `apps/web/src/lib/analysis-result.ts:926-984` accepts a truncated monthly
  entry whose safe-integer `transactionCount` is zero.
- The previous-month callback in the same validator treats that zero-count
  bucket as absent, so a `missing-calendar-month` basis can coexist with its
  positive spending.
- `apps/web/src/lib/persistence.ts:822-844,867-925` admits and restores the
  same current-version payload.
- `apps/web/src/components/dashboard/SpendingSummary.svelte:31-37,105-108`
  sums the restored bucket, making the impossible amount user-visible.
- Independent Cycle 20 probes observed pure coherence `true`, successful
  truncated restoration, and an all-month total of 787,777 won from a
  777,777-won zero-count prior bucket plus one valid 10,000-won row.

Fresh analyzer output cannot construct this state. It requires corrupted,
tampered, or incompatible persisted data, so the original Low severity is
preserved. This is a correctness/integrity obligation and is not deferred.

### Domain decision

1. Every represented `monthlyBreakdown` entry has a positive safe-integer
   `transactionCount`.
2. `spending` remains a nonnegative safe integer and may be zero when one or
   more represented rows are refunds or zero-value transactions.
3. Both the pure semantic validator and persistence shape boundary enforce the
   same domain. The semantic check remains authoritative even when direct
   callers bypass persistence.
4. Malformed persisted state continues to use the existing atomic
   corrupted/removal result. The dashboard does not filter or repair it.
5. Full transaction-backed validation and honest truncated round trips retain
   their existing behavior.

### Implementation

- [x] Change the per-entry count condition in
      `hasCoherentTruncatedFacts()` to require a positive safe integer.
- [x] Change persistence monthly-breakdown admission to require the same
      positive safe-integer count.
- [x] Keep zero spending valid for a positive count.
- [x] Avoid a new helper unless it eliminates real duplicated domain logic
      without widening the patch or dependency graph.
- [x] Do not add suppressions, relax a gate, widen types, or mask the state in
      presentation code.

### Deterministic regressions

- [x] Add a pure-coherence test that inserts a positive-spending,
      zero-transaction prior bucket into an otherwise valid truncated result
      and requires `false`.
- [x] Add a current-version deserializer test for the same witness and require
      the standard corrupted/removal result.
- [x] Add a valid prior bucket with `spending: 0` and
      `transactionCount: 1`, a matching statement-month basis, and coherent
      represented/truncated totals.
- [x] Preserve an ordinary honest truncated round trip and the existing full
      transaction-backed month-map controls.
- [x] Assert the invalid payload never becomes a renderable restored result;
      no new E2E case is required unless the source repair unexpectedly
      changes the UI recovery path.

### Validation and closure

- [x] Run focused analysis-result and persistence suites.
- [x] Run `bun run lint`.
- [x] Run `bun run typecheck`.
- [x] Run `bun run build`.
- [x] Run `bun run test`.
- [x] Run `bun run test:bun`.
- [x] Run `bunx vitest run`.
- [x] Run one owned `bun run test:e2e` attempt through the repository wrapper
      with exact pre/post session, profile, PID/PGID, process-tree, and port
      cleanup proof, including cleanup after failure.
- [x] Preserve unrelated interactive Chrome PID/PGID `1368/1368` and all
      unrelated repository/browser processes.
- [x] Record disciplined manual fallback because `ralph` is unavailable.
- [x] Update both canonical and dated Cycle 20 plan provenance with exact
      completion evidence.
- [x] Archive the completed canonical and dated plan documents.
- [x] Do not deploy, release, publish, or invoke the deployment workflow.

### Cycle 20 completion evidence

- `ralph` was unavailable, so Prompt 3 used the planned disciplined manual
  fallback with two exact implementation scopes and independent focused
  verification.
- `aec765824b744149b6bafa6706860fc38633791c` enforces the positive
  monthly-count invariant in pure truncated coherence and adds the invalid
  phantom-bucket plus valid zero-spending controls.
- `774d896979627bbbf1187f40dd2b95df26139d76` enforces the same invariant at
  persistence admission and adds exact corrupted/removal and valid
  zero-spending restoration coverage.
- The focused analysis-result and persistence matrix passed 218 tests with 547
  expectations.
- `bun run lint` and `bun run typecheck` passed all seven workspaces; Astro
  reported 126 files with zero errors, warnings, or hints.
- `bun run build` passed all seven workspaces and generated all five Astro
  pages.
- `bun run test` passed all twelve Turbo tasks; the changed web suite reported
  938 tests and 4,365 expectations, and script tests reported 96 tests and
  1,032 expectations. The first full attempt had one transient 5-second
  timeout in the tracked-file product-identity scan. That exact test passed
  twice immediately afterward, and the complete gate rerun passed without a
  source or threshold change.
- `bun run test:bun` passed 1,641 tests with 3,319 expectations.
- `bunx vitest run` passed 128 files and 3,146 tests.
- The single owned E2E run
  `1784874046149-11f1e27a-a295-48de-bb7c-636e7d523654` selected port 4173
  and passed all 97 tests. Postflight checks found no owned metadata,
  profile, browser/session/process tree, or listener; ports 4173-4175 were
  free and `bun scripts/run-e2e.ts status --assert-clean` passed.
- Interactive Chrome PID/PGID `1368/1368` remained running, all six protected
  Cycle 42 artifact hashes remained exact, and no unrelated process was
  terminated.
- No gate required a corrective source change, so `GATE_FIXES = 0`.
- Deploy mode remained `none`; no deploy, release, publication, or deployment
  workflow action occurred.

### Acceptance

- A zero-count monthly bucket is rejected by direct coherence and persistence
  restoration regardless of its spending.
- Zero spending remains valid when the bucket contains at least one
  transaction.
- Valid full and truncated snapshots remain coherent and round-trip.
- Invalid persisted state cannot surface phantom spending in the dashboard.
- Every configured gate passes, owned browser state is absent afterward, and
  no deployment occurs.
