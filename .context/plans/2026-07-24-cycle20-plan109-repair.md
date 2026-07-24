# Cycle 20 dated plan — Plan 109 monthly-bucket completion

**Canonical plan:** `.context/plans/109-cycle8-analysis-coherence.md`
**Review obligation:** C20-B-001
**Severity / confidence:** Low / High
**Novelty:** historical Plan 109 completion gap; not a new Cycle 20 root
**Status:** planned
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

- [ ] Require `transactionCount > 0` in truncated semantic coherence.
- [ ] Require the same positive safe-integer count in persistence admission.
- [ ] Add pure and deserializer rejection tests for a positive-spending,
      zero-count prior bucket.
- [ ] Add a valid zero-spending, positive-count previous-month control.
- [ ] Preserve ordinary truncated round-trip and full month-map coverage.
- [ ] Run focused analysis/persistence tests and all configured gates.
- [ ] Run one exact-owned E2E attempt and prove session/profile/tree/port
      cleanup while preserving interactive Chrome PID/PGID `1368/1368`.
- [ ] Record manual fallback for unavailable `ralph`, exact gate evidence, and
      no deployment.
- [ ] Mark both plans complete and archive them after all acceptance criteria
      pass.

## Acceptance

- Direct coherence and deserialization reject every zero-count monthly bucket.
- Zero-spending buckets remain valid when their count is positive.
- The malformed state cannot reach the dashboard.
- All configured gates pass, browser cleanup is exact, and deployment remains
  disabled.
