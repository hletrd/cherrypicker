# Plan 92 — Cycle 5 Scraper Provenance and Issuer Documentation

**Findings:** C5-010, C5-011, C5-018
**Status:** complete
**Deploy mode:** none

## Outcome

Forced scraper replacement is failure-atomic, catalog freshness comes only
from a trusted real date, and issuer documentation cannot pass its gate while
contradicting canonical YAML.

## Implementation

1. Replace in-place `O_TRUNC` writes with an exclusive sibling temporary file:
   complete write, file sync, destination revalidation, atomic rename, parent
   directory sync where supported, and cleanup on every failure. Preserve
   containment and no-follow checks.
2. Parse `lastUpdated` as a real ISO calendar date and reject future values in
   the canonical semantic boundary. At scraper ingestion, use one injected
   trusted clock for YAML provenance and the extraction header rather than
   trusting model-authored freshness.
3. Keep publication `generatedAt` derived only from validated canonical data.
4. Remove or generate the 18 duplicate manual issuer update dates, remove the
   stale DGB “data unavailable” prose, and extend `docs:check` so recognized
   manual freshness claims cannot disagree with canonical maxima.

## Tests and evidence

- Fault injection before/within write, on sync, and before rename proving old
  canonical bytes survive and temporary files are removed.
- Invalid-day, leap-day, future-date, clock-injection, YAML/header/publication
  consistency tests.
- Full 683-card data generation/check and all 24 issuer README checks.
- Scraper, rules, scripts, docs, lint, type, test, and build gates.

## Acceptance

- [x] No authorized overwrite truncates the destination before commit.
- [x] Impossible/future dates fail before publication.
- [x] One trusted clock value owns scraper freshness metadata.
- [x] `docs:check` rejects stale recognized manual metadata.
- [x] DGB prose matches its canonical rule data.

## Evidence

- `bun run --cwd tools/scraper test` — 73 passed, 0 failed.
- Focused rules/publication/README tests — 80 passed, 0 failed.
- `bun run --cwd packages/rules typecheck` and
  `bun run --cwd tools/scraper typecheck` — passed.
- `bun run data:check` — 683 cards across 24 issuers, passed.
- `bun run docs:check` and `git diff --check` — passed.
