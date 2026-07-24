# Current causal trace review — Cycle 19

## Review identity

- Date: 2026-07-24
- Revision: `fcc89801451d1c1a31bb9881d213e117fc4ca923`
- Role: execution, state, data, error, and persistence tracing
- Disposition: one genuinely new Low-severity, High-confidence finding
- Detailed immutable report:
  `.context/reviews/2026-07-24-cycle19-tracer.md`

## Complete inventory

The trace began with all 2,409 tracked paths: 362 source/test paths, 739 rule
and generated-publication paths, 1,237 historical review/plan paths, and 71
manifests, configs, docs, workflow files, fixtures, and other assets.
End-to-end traces covered input admission, browser/server parsing, analysis,
optimization, rendering, persistence and restore; card YAML, generators,
publication identity and readers; dependency discovery and ownership; and
worker/cache/cancellation lifecycles.

## C19-TR-001 — a valid domain-boundary throw crosses two fail-closed callers

- Severity: Low
- Confidence: High
- Source operation: `packages/core/src/analysis/context.ts:96-109`
- Coherence consumer:
  `apps/web/src/lib/analysis-result.ts:893-981,988-1095`
- Deserialization consumer:
  `apps/web/src/lib/persistence.ts:677-708,720-742,822-915`
- Store-level catch: `apps/web/src/lib/store.svelte.ts:117-148`

The failing causal sequence is:

1. Current-v4 persisted data supplies a structurally valid truncated analysis
   whose latest and basis month is `0000-01`.
2. Shape validation accepts `0000-01` because it is a valid four-digit
   `YearMonth`.
3. Truncated coherence asks for the latest month's predecessor.
4. `previousCalendarMonth()` correctly throws because no predecessor is
   representable.
5. `isAnalysisResultCoherent()` therefore throws instead of returning
   `false`.
6. `deserializeAnalysis()` calls coherence outside its existing catches and
   throws instead of returning a corrupted result.
7. The production store catches the exception, removes the payload, and
   reports it through the storage-access path; exported direct callers do not
   have that final recovery layer.

The sequence was reproduced directly for both coherence and deserialization.
Real parsed statements use years 1900–2100, so reachability is limited to
constructed, tampered, or stale persistence and severity remains Low.

The coherent fix is to preserve the direct predecessor exception, absorb the
unrepresentable predecessor at the boolean coherence boundary as `false`, and
make deserialization defensively translate any validation exception to its
existing invalid/corrupted result. Regression tests should lock each boundary.

Plan 148 owns the direct calendar underflow, but historical reconciliation
found no owner for the exception propagation through these older total
validation APIs.

## Verification and disposition

The dependency gate, all workspace type checks, workspace/script tests, 128
Vitest files / 3,137 tests, and publication budget checks passed. No browser,
Chrome, Playwright, E2E, deployment, source edit, plan edit, or generated-data
write was performed. The final flow sweep found no second novel causal root.

Final new tracer finding count: **1**.
