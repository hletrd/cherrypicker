# Plan 123 — Cycle 10 Card Detail and Worker Contracts

**Findings:** C10-007 (Medium/High), C10-008 (Low/High)
**Status:** completed
**Deploy mode:** none

## Evidence

- Published supported rewards retain IDs, labels, and structured conditions,
  but `CardDetail` projects each tier to only category and numeric tier data.
  LOCA LIKIT Eat's restaurant, delivery-app, and cafe rules render as three
  indistinguishable dining 60% rows with their merchant scopes missing.
- The grid presents a distinct-category count under copy that calls it a
  benefit count.
- The optimizer worker message handler trusts a TypeScript-only response union.
  A cloneable `null` ordinary message throws before common settlement, leaving
  the promise pending, listeners installed, and the worker alive.

## Outcome

Card details identify each supported benefit and disclose every eligibility
condition in usable language, while every optimizer worker message either
decodes successfully or settles and cleans up exactly once.

## Implementation

1. Carry reward ID, label, category, and conditions through the supported
   detail-row model rather than reducing rows to category/tier alone.
2. Render the authored reward label as the primary benefit identity, category
   as secondary context, and structured conditions through a pure,
   exhaustively tested Korean formatter.
3. Cover merchant scope, transaction min/max, weekday, channel, payment type,
   occurrence limits, and a conservative explicit fallback for an unknown
   condition.
4. Rename category-count grid copy/sort to `혜택 분야` so it does not claim a
   supported-rule count.
5. Add a production-shaped LOCA LIKIT Eat regression proving the three 60%
   rows remain distinct and show their merchant scopes.
6. Receive optimizer messages as `MessageEvent<unknown>`, runtime-decode both
   response arms and the success-result shape, and route every exception or
   invalid payload through the common sanitized failure/cleanup path.
7. Extend the fake worker to emit unknown values. Assert `null`, `undefined`,
   missing/invalid discriminants, malformed result objects, and malformed
   error messages each cause one rejection, listener removal, and one
   termination.

## Acceptance

- [x] Supported detail rows preserve stable reward identity and authored label.
- [x] Every supported structured condition is visible or triggers an explicit
      additional-conditions disclosure.
- [x] LOCA LIKIT Eat's restaurant, delivery-app, and cafe benefits are
      distinguishable without consulting source YAML.
- [x] Grid count/sort copy accurately describes distinct benefit categories.
- [x] All ordinary optimizer messages are runtime decoded from `unknown`.
- [x] Every malformed payload settles once and releases listeners and worker.

## Execution note

`ralph` is unavailable. Prompt 3 will use pure formatter/component-contract
tests and fake-worker settlement tests before full web and repository gates.

## Completion evidence

- Supported reward presentations now retain the stable reward ID, authored
  label, category, and formatted conditions through every performance-tier
  row. Card detail renders the label as the benefit identity, category as
  secondary context, and each eligibility condition beneath it.
- The pure Korean formatter covers merchant scope, minimum and maximum
  transaction amounts, all weekday values, both channel and payment-type
  values, daily/monthly occurrence limits, notes, and one explicit
  issuer-description fallback for unknown or malformed conditions.
- A regression reads the published Lotte detail shard and proves all three
  LOCA LIKIT Eat dining rules retain distinct labels and exact merchant scopes.
  Grid count and sort copy now names the underlying distinct count as
  `혜택 분야`.
- Ordinary optimizer messages enter as `MessageEvent<unknown>`. Both response
  arms and the complete nested optimization-result shape are decoded before
  use; invalid payloads take one sanitized rejection path that removes every
  terminal listener and terminates the owned worker exactly once.
- `bun test apps/web/__tests__/card-detail-support.test.ts
  apps/web/__tests__/card-grid-state.test.ts
  apps/web/__tests__/optimizer-worker.test.ts` passed with 31 tests and zero
  failures. The integrated shared-tree
  `bun run --cwd apps/web typecheck` rerun passed with zero errors, warnings,
  or hints after the concurrent Plan 121 and Plan 124 changes were finalized.
