# Cycle 19 debugger review

## Result

One genuinely new defect was retained at
`fcc89801451d1c1a31bb9881d213e117fc4ca923`:

- **C19-DBG-001 — Low / High confidence:** `0000-01` is admitted into
  truncated persisted facts, but its deliberate predecessor exception escapes
  the coherence/deserialization boundary.

This is the same root independently reported as `C19-VR-001`; it should be
deduplicated to one Cycle 19 finding.

## Inventory and debugging method

The debugger inventory covered every active production, test, configuration,
generated-data, and workflow family in the 2,409 tracked-path baseline, with
focused inspection of the 66 changed Cycle 18 paths. The final sweep traced:

- date/month construction, sorting, predecessor derivation, and persistence;
- malformed/current/legacy/truncated storage inputs and error classification;
- parser diagnostics, swallowed catches, partial success, and resource bounds;
- async operation ownership, cancellation, worker cleanup, and navigation;
- CLI/scraper file, network, report, and publication failure paths;
- dependency/generator failure modes introduced by `.mts`/`.cts` and
  supplemental publication identities.

History was used to reject already fixed, deferred, or accepted roots. No
browser, E2E, deployment, or source edit was performed.

## C19-DBG-001 — truncated lower-bound month turns validation into an exception

- Severity: **Low**
- Confidence: **High**
- Status: **confirmed**
- Public domain and deliberate exception:
  `packages/core/src/analysis/context.ts:60-114`
- Unconditional truncated predecessor:
  `apps/web/src/lib/analysis-result.ts:922-981`
- Basis-specific logic that is reached too late:
  `apps/web/src/lib/analysis-result.ts:893-920`
- Structural persistence admission:
  `apps/web/src/lib/persistence.ts:522-547,677-708,822-865`
- Escaping coherence call:
  `apps/web/src/lib/persistence.ts:867-915`
- Outer recovery:
  `apps/web/src/lib/store.svelte.ts:117-148`

### Failure trace

1. The public month grammar accepts `0000-01`, while
   `previousCalendarMonth()` deliberately raises a `RangeError` for that one
   value because its predecessor is outside the four-digit domain.
2. A current-version truncated snapshot is allowed to carry no transactions.
   Its monthly facts are validated with `isYearMonth()`, so `0000-01` passes.
3. `hasCoherentTruncatedFacts()` selects the latest breakdown entry and calls
   `previousCalendarMonth(latest.month)` unconditionally.
4. The call occurs even when `previousSpendingBasis.kind === "user-total"`,
   where no calendar predecessor is needed. It also occurs before the
   statement/missing basis can be rejected normally.
5. `deserializeAnalysis()` does not catch exceptions from
   `isAnalysisResultCoherent()`, so the pure validation API throws.
6. The store's outer catch removes the entry and reports a storage-access
   problem. This prevents a persistent route crash but loses the intended
   corrupted-payload classification.

An otherwise balanced one-month truncated snapshot reproduced the exact
`RangeError` through both `isAnalysisResultCoherent()` and
`deserializeAnalysis()`. Repeating the coherence probe with an explicit
`user-total` basis raised the same error, confirming that the unconditional
predecessor computation is the immediate cause.

### Concrete impact

A malformed, manually constructed, or future-imported current-version
truncated snapshot with latest month `0000-01` cannot be evaluated as ordinary
invalid state. The store deletes it and shows the wrong generic restore
message; a direct deserializer caller receives an exception. Ordinary uploaded
statements remain restricted to modern parser dates, and the store recovers,
so severity is Low.

This is not a security escalation: writing the application's origin-scoped
storage already requires same-origin code or manual tooling. It is a
reliability and fail-closed contract defect.

### Root fix and regression coverage

Preserve the public helper's exact range error, but make validation total:

1. Move predecessor derivation behind the basis-kind decision so `user-total`
   never requests it.
2. For statement/missing bases, convert the non-representable predecessor into
   `false` coherence rather than an exception.
3. Add a direct lower-bound truncated coherence test for user-total and
   calendar-derived bases.
4. Add a current-version persistence mutation proving `deserializeAnalysis()`
   returns the ordinary corrupted result and never throws.
5. Keep the successful `0000-02 -> 0000-01` and public
   `0000-01` helper-error contracts distinct.

### Novelty

Cycle 18 intentionally introduced the `0000-01` exception in `9cb5bfe`.
Historical review asked for a deliberate typed failure and a minimum-boundary
persistence round trip, but the implemented plan tested only the helper throw
and the January-1000 context. Before that commit, the helper produced a
malformed string and coherence returned false; the exception escaping
validation is therefore new to the current baseline.

## Rejected adjacent candidates

- Full transaction-backed analysis cannot reach this exception through normal
  inputs: `yearMonthOfDate()` rejects invalid ISO dates and the parser policy is
  narrower. The defect is confined to truncated/refined facts.
- Same-year and ordinary January predecessor paths remain closed and pass their
  runtime/type tests.
- Supplemental catalog hash canonicalization, metadata injection, and version
  separation produced no error-path regression; current drift and mutation
  tests pass.
- `.mts`/`.cts` discovery reaches the existing TypeScript AST classifier and
  produces deterministic diagnostics; no manifest or lock regression was
  found.

## Verification and final missed-issue sweep

Focused suites passed 77 tests and 185 expectations; dependency and data drift
gates passed; core/web type checks passed. The closing pass revisited every
changed throw/catch, parser and persistence validation exit, generator
publication phase, dependency-discovery branch, worker/cancellation owner, and
filesystem/network cleanup site. No second new debugger root survived.

Confirmed findings: **1**; likely findings: **0**; manual-only risks promoted:
**0**.
