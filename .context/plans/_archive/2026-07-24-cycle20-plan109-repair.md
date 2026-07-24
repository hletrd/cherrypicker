# Cycle 20 dated plan — Plan 109 monthly-bucket completion

**Canonical plan:** `.context/plans/_archive/109-cycle8-analysis-coherence.md`
**Review obligation:** C20-B-001
**Severity / confidence:** Low / High
**Novelty:** historical Plan 109 completion gap; not a new Cycle 20 root
**Status:** archived (completed)
**Deploy mode:** none

## Outcome

Restore Plan 109's fail-closed persistence-coherence promise by enforcing the
producer's positive monthly transaction-count invariant at both direct
semantic validation and persisted structural admission.

## Evidence

- `packages/core/src/analysis/context.ts:157-175,189-205` can create a monthly
  bucket only while counting a transaction.
- `apps/web/src/lib/analysis-result.ts:926-984` currently accepts a
  safe-integer monthly `transactionCount` of zero.
- `apps/web/src/lib/persistence.ts:822-844,867-925` admits and restores the
  same impossible bucket.
- `apps/web/src/components/dashboard/SpendingSummary.svelte:31-37,105-108`
  includes its spending in the restored all-month total.
- Archived Plan 109 already promised coherent monthly counts/spending,
  atomic rejection of contradictory truncated snapshots, and prevention of
  stale financial totals.

## Decisions

1. A represented monthly bucket must have a positive safe-integer transaction
   count.
2. Zero spending remains valid for a bucket with a positive count.
3. The pure validator and persistence boundary enforce the same domain.
4. Malformed persisted state uses the existing corrupted/removal result; the
   UI does not filter or repair it.
5. Full snapshots and honest truncated round trips remain unchanged.

## Implementation and tests

- [x] Require `transactionCount > 0` in truncated semantic coherence.
- [x] Require the same positive safe-integer count in persistence admission.
- [x] Add pure and deserializer rejection tests for a positive-spending,
      zero-count prior bucket.
- [x] Add a valid zero-spending, positive-count previous-month control.
- [x] Preserve ordinary truncated round-trip and full month-map coverage.
- [x] Run focused analysis/persistence tests and all configured gates.
- [x] Run one exact-owned E2E attempt and prove session/profile/tree/port
      cleanup while preserving interactive Chrome PID/PGID `1368/1368`.
- [x] Record manual fallback for unavailable `ralph`, exact gate evidence, and
      no deployment.
- [x] Mark both plans complete and archive them after all acceptance criteria
      pass.

## Completion evidence

- Manual fallback was used because `ralph` was unavailable.
- Signed implementation commits `aec765824b744149b6bafa6706860fc38633791c`
  and `774d896979627bbbf1187f40dd2b95df26139d76` enforce the positive-count
  invariant at both validation layers and add the required rejection and
  valid-control coverage.
- Focused tests passed 218 tests with 547 expectations.
- Lint, typecheck, and build passed all seven workspaces with zero Astro
  diagnostics and five generated pages.
- The final `bun run test` attempt passed all twelve Turbo tasks, 938 web
  tests with 4,365 expectations, and 96 script tests with 1,032 expectations.
  One earlier product-identity scan timeout was transient: the exact test
  passed twice and the full gate passed on retry without a code or threshold
  change.
- `bun run test:bun` passed 1,641 tests with 3,319 expectations, and
  `bunx vitest run` passed 128 files with 3,146 tests.
- Owned E2E run
  `1784874046149-11f1e27a-a295-48de-bb7c-636e7d523654` passed 97 tests on
  port 4173. Postflight wrapper, metadata, profile, process, session, and port
  checks were clean; ports 4173-4175 were free and Chrome `1368/1368` was
  preserved.
- Protected artifact hashes remained exact. `GATE_FIXES = 0`.
- Deploy mode was `none`; no deployment or publication action occurred.

## Acceptance

- Direct coherence and deserialization reject every zero-count monthly bucket.
- Zero-spending buckets remain valid when their count is positive.
- The malformed state cannot reach the dashboard.
- All configured gates pass, browser cleanup is exact, and deployment remains
  disabled.
