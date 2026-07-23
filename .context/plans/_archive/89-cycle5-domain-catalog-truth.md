# Plan 89 — Cycle 5 Domain and Catalog Truth

**Findings:** C5-001, C5-007, C5-008, C5-013
**Status:** complete
**Deploy mode:** none

## Outcome

Performance qualification fails closed for untrusted categories, custom
catalog recommendations are deterministic, every recommendation is truthful
about eligibility and annual-fee scope, discontinued cards cannot enter a new
recommendation, and unsupported annual-cap semantics cannot be authored as
supported executable rules.

## Implementation

1. Extend the performance-spending fact boundary with categorization trust.
   Preserve compatibility for trusted direct callers, but return `unknown`
   when a category exclusion depends on `uncategorized` or confidence-zero
   data. Carry the fact through web and CLI producers and preserve confidence
   `1` for user-confirmed edits.
2. Sort recursive authoring inputs and add an explicit ASCII `cardId`
   tie-breaker everywhere equal optimizer scores or best-single choices are
   resolved.
3. Exclude `discontinued` rules from default/recommendation optimizer
   universes and preserve availability metadata in summary projections.
   Replace “net savings” language with a shared, explicit contract:
   gross monthly rewards before annual fees, assuming access to every included
   card. Apply the same wording to web, CLI, terminal, standalone report, and
   generated/public catalog surfaces.
4. Reject positive `annualCap` on any rule marked supported until the runtime
   accepts trusted year-to-date usage. Ensure custom CLI catalogs and scraper
   validation run the same semantic validator. Preserve the tracked explicitly
   unsupported annual-cap rule.

## Tests and evidence

- Core performance regressions for confidence-zero unknowns crossing a tier,
  trusted/user-confirmed categories, and direct-call compatibility.
- Web and CLI end-to-end analysis fixtures for the same performance boundary.
- Reverse-order nested custom catalog and equal-benefit optimizer tests.
- Discontinued-card exclusion plus gross/annual-fee/access disclosure tests in
  every public output.
- Schema → semantic validator → CLI/scraper → calculator contract tests for
  supported and explicitly unsupported annual caps.
- Catalog generation, data, dependency, unit, type, lint, build, and browser
  gates.

## Acceptance

- [x] Unknown category facts cannot unlock a category-excluded tier.
- [x] Equal recommendations are deterministic across input/filesystem order.
- [x] No discontinued card enters a default recommendation or appears
  available without a label.
- [x] No public output calls gross rewards net savings or omits the annual-fee
  and access assumption.
- [x] A supported positive annual cap fails at every authoring boundary.

## Evidence

- Focused domain/rules runs passed 183 tests plus 12 authoring-boundary
  regressions.
- Generated catalog checks passed with 683 summary cards, 683 detail cards,
  and 682 optimizer-eligible cards; the discontinued card remains visible
  with its status but is excluded from recommendations.
- Core, rules, CLI, and web typechecks passed, along with catalog data checks
  and the production build.
