# Plan 79 — Cycle 3 Domain and Parser Correctness

**Findings:** C3-001, C3-002, C3-003, C3-004, C3-005, C3-006, C3-007
**Deploy mode:** none
**Status:** completed

## Outcome

Keep parsed transaction facts and generated taxonomy data inside validated
domain bounds, make partial JSON parsing explicit, apply occurrence limits only
to executable rewards, and give JSON/result contracts one owner.

## Tasks

- [x] Define one browser-safe fuel-volume validator and documented consumer
  transaction bound. Use it in server/browser JSON fact extraction and every
  public fact handoff. Independently reject non-finite or unrepresentable
  calculated rewards/totals instead of allowing `Infinity`.
- [x] Add parser, core, optimizer, and persistence regressions for the maximum
  accepted volume, the next value, `1e308`, non-finite products, and a normal
  fractional-liter transaction.
- [x] Parse `categories.json` through the canonical recursive category schema
  before accepting its publication hash or populating caches. Return normalized
  nodes, validate children/keywords/labels/duplicate IDs, and remove the lossy
  local `label` adapter.
- [x] Extract the duplicated server/browser JSON grammar into a browser-safe
  parser kernel. Keep only environment-specific `ParseError`/result adapters at
  the two public entrypoints.
- [x] Once a direct/wrapped transaction array is selected, emit a bounded
  row-level diagnostic for every non-object entry and every object missing a
  required date or amount. Preserve input-row identity and server/web parity.
- [x] Move occurrence accounting after tier lookup and reward-shape/fact
  validation. An unsupported candidate must not consume `maxUses`; a valid
  application must still count consistently when later clipped by a cap.
- [x] Classify an unknown-extension payload beginning with a JSON container
  token as JSON without requiring a complete document inside a fixed prefix;
  leave full syntax validation to the JSON parser. Add long/mismatched-extension
  and malformed-leading-token tests.
- [x] Replace the six copied web result interfaces with type-only imports or
  aliases from `@cherrypicker/core`, retaining only web-owned analysis state.

## Acceptance

- [x] Every reward and aggregate total returned by core is finite and safely
  representable; oversized fuel facts fail closed with a disclosed issue.
- [x] A malformed category root or child never reaches `MerchantMatcher` or a
  persistent cache, and a later corrected fetch can retry.
- [x] For selected JSON arrays, accepted rows plus explicit rejected rows equal
  the input row count in both server and browser paths.
- [x] Missing fuel facts followed by a valid transaction under `maxUses: 1`
  rewards the valid transaction.
- [x] A valid JSON statement larger than 2 KiB is detected as JSON under an
  unknown or mismatched extension.
- [x] Parser, core, rules, and web unit/type gates pass.

## Coverage

| Finding | Completion evidence |
|---|---|
| C3-001 | bounded fact validator plus finite core/optimizer tests |
| C3-002 | canonical recursive category reader and cache-retry tests |
| C3-003 | explicit rejected-row diagnostics and count invariant |
| C3-004 | occurrence-after-executability regression |
| C3-005 | long JSON detection regression |
| C3-006 | shared JSON kernel and dual-entry conformance table |
| C3-007 | core-owned result types consumed by the store |

## Verification

- `bun test --dots packages/parser`: 1,605 pass, 0 fail.
- `bun test --dots packages/core`: 141 pass, 0 fail.
- `bun test --dots packages/rules`: 84 pass, 0 fail.
- `bun test --dots apps/web/__tests__`: 312 pass, 0 fail.
- Parser, core, rules, and web package typechecks passed with zero diagnostics.
- Focused JSON parity/detection, category retry, persistence, occurrence, cap,
  and finite-number regressions passed.
- `git diff --check` passed for the Plan 79 implementation paths.

No browser, E2E, deploy, commit, push, package-manifest, or lockfile operation
was performed for this plan.
