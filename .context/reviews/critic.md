# Current critic review — Cycle 19

## Review identity

- Date: 2026-07-24
- Revision: `fcc89801451d1c1a31bb9881d213e117fc4ca923`
- Role: adversarial multi-perspective critique
- Disposition: one genuinely new Low-severity, High-confidence finding
- Detailed immutable report:
  `.context/reviews/2026-07-24-cycle19-critic.md`

## Complete inventory

All 2,409 tracked paths were inventoried before review: 362 source/test paths,
739 rule and publication-data paths, 1,237 historical review/plan paths, and
71 remaining manifests, configs, docs, workflow files, fixtures, and assets.
The pass challenged the end-to-end parser, analysis, optimizer, persistence,
catalog, dependency, state, output, scraper, and deployment boundaries rather
than treating tests or earlier reviews as proof.

## C19-CT-001 — the lower-bound calendar error breaks validator totality

- Severity: Low
- Confidence: High
- Domain helper: `packages/core/src/analysis/context.ts:96-109`
- Truncated coherence:
  `apps/web/src/lib/analysis-result.ts:893-981,988-1095`
- Persistence boundary:
  `apps/web/src/lib/persistence.ts:677-708,720-742,822-915`
- Store recovery: `apps/web/src/lib/store.svelte.ts:117-148`

Cycle 18 correctly made
`previousCalendarMonth(parseYearMonth("0000-01"))` throw a `RangeError`:
the four-digit calendar domain has no predecessor. The boolean coherence and
deserialization boundaries still assume that operation is total.

A structurally valid current-v4 truncated snapshot can contain no transaction
array, `_truncatedTxCount: 1`, one coherent positive category/month/optimizer
witness, and latest/basis month `0000-01`. The shape parsers accept that
`YearMonth`; `hasCoherentTruncatedFacts()` then calls the partial predecessor
helper and throws before returning `false`. `deserializeAnalysis()` invokes
coherence outside its parsing/migration catches and throws as well.

Direct reproduction produced:

```text
coherence THREW RangeError YearMonth 0000-01 has no representable previous month
deserialize THREW RangeError YearMonth 0000-01 has no representable previous month
```

The production store's outer catch prevents a route crash and removes the
payload, but misclassifies deterministic corrupt data as a storage-access
failure. Direct callers receive the exception. Real statement parsers restrict
years to 1900–2100, so only constructed, tampered, or stale persisted data can
reach the case; severity is therefore Low.

The root fix should preserve the direct helper's `RangeError`, make coherence
return `false` when the latest month has no representable predecessor, and
defensively turn validation exceptions in `deserializeAnalysis()` into its
corrupted/invalid result. Tests should cover all three contracts.

Plan 148 owns the deliberate direct-helper underflow but does not own this
exception crossing the older fail-closed validation boundary. No prior active,
completed, deferred, or rejected finding covers the interaction.

## Verification and disposition

Dependency ownership, workspace type checking, workspace/script tests, the
full Vitest matrix, and bundle/request budgets passed. No E2E, browser,
Chrome, deployment, product-source, plan, or generated-data mutation occurred.
The final adversarial sweep found no second novel root.

Final new critic finding count: **1**.
