# Plan 103 — Cycle 7 Taxonomy and User-Choice Truth

**Findings:** C7-003 (High/High), C7-004 (High/High)
**Status:** completed
**Deploy mode:** none
**Archived after:** Cycle 8 review

## Evidence

- `MerchantMatcher` returns legacy static-map exact/substring matches before
  consulting `categories.yaml`; canonical keywords such as 세븐일레븐,
  교통카드, 약국, and 넷플릭스 therefore miss supported category rules.
- `collectUnmodeledRuleRestrictions()` misses phrases including
  `선택 카테고리`, `A팩 선택 시`, and `중 선택`. Thirty supported reward
  rows across twelve cards currently carry unmodeled choice restrictions.

## Outcome

Canonical taxonomy keywords are authoritative at runtime, and no reward that
depends on an unprovided user choice is published or calculated as supported.

## Implementation

1. Resolve canonical taxonomy exact/substring keywords before legacy keyword
   maps. Preserve deterministic longest-keyword behavior and raw-category
   fallback, while keeping explicit conflict resolution inside each source.
2. Add an invariant that every canonical taxonomy keyword resolves to its
   declared parent/leaf category. Update legacy snapshots that previously
   asserted divergent winners and add end-to-end supported-rule reachability.
3. Broaden the fail-closed user-choice inventory to the current Korean and
   English forms. Quarantine every current choice-bearing reward row as
   `unsupported` with a stable reason until choice groups and user state are
   modeled.
4. Regenerate the compiled catalog, shards, labels, and documentation; accept
   only output produced by `bun run data:build` followed by `data:check`.

## Tests

- Exhaustive canonical-keyword matcher invariant and concrete convenience,
  transit, pharmacy, streaming, grocery, and fuel reachability cases.
- Restriction fixtures for every current choice phrase plus near-miss prose.
- Catalog-wide assertion that no `supported` reward contains unmodeled choice
  language; `jb-1st-triple` must not award all mutually exclusive options.
- Generated-artifact/source-hash and full data validation.

## Acceptance

- [x] Every canonical keyword resolves to its authored category/leaf.
- [x] Common canonical merchants can reach their supported reward rules.
- [x] No unprovided user choice can contribute an executable reward.
- [x] All 683 authored cards and generated artifacts validate together.

## Completion evidence

- All 335 authored keywords (324 normalized unique) are invariant-tested with
  canonical exact authority and deterministic longest-match behavior.
- Thirty-five newly identified choice-bearing rows across 17 cards were
  quarantined with `unmodeled eligibility: user_choice`; no supported
  choice-bearing row remains.
- Core/rules tests passed 352/352, both package typechecks passed, and
  `data:check` validated 683 cards across 24 issuers and all generated output.

## Execution note

`ralph` is unavailable; Prompt 3 uses the manual fail-closed migration loop.
