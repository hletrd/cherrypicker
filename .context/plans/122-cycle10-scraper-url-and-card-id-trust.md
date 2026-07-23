# Plan 122 — Cycle 10 Scraper URL and Card-ID Trust

**Findings:** C10-006 (Medium/High), C10-009 (Medium/High)
**Status:** completed
**Deploy mode:** none

## Evidence

- The scraper model can author `card.url`; deterministic quarantine stamps
  issuer/date/source and reward support but leaves the URL intact. Publication
  and the web UI then present an off-policy HTTPS value as the official card
  page.
- The canonical card-ID grammar permits dot-separated segments and publishes
  eight such cards. Web navigation duplicates the grammar with a hyphen-only
  regex, so affected list selections throw and direct links resolve to null.

## Outcome

Only trusted fetch/reviewer provenance can create an official card URL, and
every browser navigation path consumes the canonical browser-safe card-ID
contract.

## Implementation

1. Remove `card.url` from the model-owned extraction tool schema and prompt
   contract.
2. Carry the exact policy-validated fetched/final URL through the trusted
   scraper boundary, or deliberately omit the URL until a reviewer supplies
   one. Never accept a model-provided replacement.
3. Make publication fail closed for LLM-scraped official URLs without trusted
   provenance while keeping manually authored canonical URLs valid.
4. Add adversarial extraction/publication tests for a safe-scheme
   attacker-host URL and prove the final detail link cannot retain it.
5. Replace the navigation helper's private card-ID regex with the browser-safe
   canonical predicate/schema, including its length and separator rules.
6. Add explicit dotted-ID parse/build/resolve tests and a corpus regression
   proving every published summary ID round-trips through navigation.
7. Retain rejection tests for traversal, duplicate parameters, uppercase,
   leading/trailing separators, consecutive separators, and overlength input.

## Acceptance

- [x] No model field can select the destination labeled as an official card
      page.
- [x] Scraped URLs are either exact trusted fetch provenance or absent pending
      explicit review.
- [x] Publication and UI tests reject an off-policy HTTPS phishing URL.
- [x] All 683 published IDs, including the eight dotted IDs, pass the one
      canonical browser navigation grammar.
- [x] Clicking and deep-linking a dotted card open the same catalog detail.
- [x] Malformed external query input still fails closed without a lookup.

## Execution note

The `ralph` skill is not registered. Prompt 3 will use adversarial
scraper/publication tests and navigation corpus tests as the manual fallback.
No deployment or external scrape is part of this plan.

## Completion evidence

- The extraction tool schema and system prompt no longer expose `card.url`.
  The deterministic extraction boundary deletes any adversarial URL before
  canonical validation, so new `llm-scrape` output deliberately has no
  official destination until explicit review changes its provenance.
- `cardMetaSchema` rejects every non-empty official URL paired with
  `source: llm-scrape`. The same canonical parser now makes both catalog
  publication and browser detail-shard loading fail closed for
  `https://attacker.example/phish`, while `manual` and `web` records retain
  reviewed HTTP(S) URLs.
- Card query parsing, construction, resolution, and history now use the
  browser-safe canonical `cardIdSchema`. The production-summary corpus test
  round-trips all 683 IDs, including all eight dotted IDs, and the dotted
  selection/direct-query regression resolves the same card.
- Test-first execution initially produced the expected 18 failures across the
  URL-trust and card-navigation boundaries. The completed focused command
  passed 304 tests with 0 failures:

  ```text
  bun test tools/scraper packages/rules \
    apps/web/__tests__/card-navigation-state.test.ts \
    apps/web/__tests__/cards-loader.test.ts \
    scripts/__tests__/catalog-publication.test.ts
  ```

- `packages/rules`, `tools/scraper`, and `apps/web` typechecks passed with zero
  diagnostics. `bun run web:build:check` built all five static routes and
  passed the browser bundle budget, confirming the canonical rules import
  remains browser-safe.
- No browser/E2E run, external scrape, deployment, staging, commit, or push
  was performed.
