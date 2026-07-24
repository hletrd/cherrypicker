# Plan 146: Cycle 17 Legacy Reward Comparison Groups

**Finding:** C17-003 (Low/High)
**Status:** completed
**Deploy mode:** none

## Evidence

- Canonical publication distinguishes percentage, fixed transaction,
  fixed-day, mileage-per-spend, and fuel-per-liter values at
  `scripts/catalog-publication.ts:179-187`.
- Legacy tier selection, category ordering, and compact truncation in
  `scripts/build-json.ts:79-86,248-271,373-404` compare raw numeric amounts
  across those distinct kinds and units.
- Current derived artifacts contain mixed comparison groups; some compact
  lists reach the five-entry truncation boundary.
- The active browser optimizer uses a separate validated artifact, which
  bounds the defect to legacy/public derived indexes.

## Implementation

1. Introduce a pure projection for a canonical comparison-group key composed
   from the exact reward value kind and normalized unit.
2. Select and order tiers only within the same comparison group; preserve the
   existing deterministic tie behavior.
3. Represent each reward's relevant homogeneous projections explicitly
   instead of selecting one raw-number winner across unlike values.
4. Group category index entries by comparison key and sort amounts only
   inside each group.
5. Build compact top rewards per comparison group and apply any size limit
   independently, so an entry in one group cannot displace or truncate an
   entry in another.
6. Retain the fields required by existing legacy consumers and add the exact
   kind/group metadata necessary to interpret the order without guessing.
7. Add pure fixtures for all five canonical kinds, repeated units, distinct
   units, negative/zero/equal amounts, multiple tiers, stable ties, and more
   than five entries in multiple groups.
8. Regenerate every affected checked-in legacy/public JSON artifact through
   the canonical data build.

## Acceptance

- [x] No raw amount comparison crosses an exact kind-and-unit boundary.
- [x] All five canonical value kinds receive explicit regression coverage.
- [x] Within-group best-tier selection and ordering are deterministic.
- [x] A size limit in one group never removes an entry from another group.
- [x] Legacy/public artifacts expose enough metadata to interpret every
      homogeneous group.
- [x] The active optimizer artifact and calculator behavior remain
      semantically unchanged.

## Completion evidence

The requested `ralph` capability was unavailable, so Prompt 3 used the
approved disciplined manual fallback. The legacy projections now use exact
canonical kind plus normalized unit as their comparison key, preserve the
first tier on equal amounts, sort group keys lexically, and sort amounts only
inside each group. Compact limits apply independently at five entries per
group.

Pure regressions cover all five value kinds, both mileage units, zero,
negative generic-sort values, equal-value stability, multiple tiers, and
independent group limits. A generated-artifact invariant scan confirmed 1,460
category entries and 1,441 compact reward entries with correct group-local
order and a maximum group size of five. The bundle budget passed with the
compact catalog at 26.8% of the full legacy catalog. Summary, optimizer,
category, detail-shard, and source-identity artifacts remained unchanged.

## Verification

Run the new pure projection tests, `bun run data:build`, and
`bun run data:check`. Inspect the generated diff for deterministic,
group-local ordering, then run:

- `bun run lint`
- `bun run typecheck`
- `bun run build`
- `bun run test`
- `bun run test:bun`
- `bunx vitest run`
- `bun run test:e2e`

Use the repository E2E ownership preflight and postflight checks. Do not
deploy.
