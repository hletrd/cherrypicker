# Plan 109 — Cycle 8 Analysis DTO and Persistence Coherence

**Findings:** C8-001 (Medium/High), C8-008 (Medium/High)
**Status:** archived (completed)
**Deploy mode:** none

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
