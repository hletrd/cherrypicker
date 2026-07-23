# Plan 113 — Cycle 8 Scraper Operating Contract

**Findings:** C8-012 (Medium/High)
**Status:** archived (completed)
**Deploy mode:** none

## Evidence

- README names the Claude-powered scraper but gives no complete operating
  sequence.
- Direct/root scraper help shows runnable network examples but omits required
  `ANTHROPIC_API_KEY` and optional `ANTHROPIC_MODEL`.
- Credential construction happens after target-page fetch and cleanup, so a
  missing key fails only after remote work.

## Outcome

Scraper users know the credential, model, network, overwrite, review, and
publication contract before starting, and missing configuration fails before
any fetch or filesystem mutation.

## Implementation

1. Add a side-effect-free scraper configuration preflight before page
   validation/fetch. Require a sanitized, plausibly shaped
   `ANTHROPIC_API_KEY`; surface the resolved/default `ANTHROPIC_MODEL` without
   ever printing the secret.
2. Put credential/model prerequisites in the shared help formatter used by
   direct and root CLI entry points. Explain official-host defaults,
   repeatable `--allow-host`, default output, and `--force` overwrite risk.
3. Add a concise README scraper section with safe secret injection, the
   canonical supported-issuer list, a runnable command, manual generated-YAML
   review, and required `data:build`/`data:check` follow-up.
4. Bind README/help/preflight wording to executable tests so the API variable,
   model override, issuer source, and authoring sequence cannot drift.

## Tests

- Missing/malformed key fails before any fetch, extractor construction, or
  write; valid stubbed configuration reaches the existing fake-network path.
- Root and direct help contain identical key/model and overwrite/network
  disclosures without a credential value.
- README contract localizes the scrape command with its prerequisite and
  review/build/check sequence. No test performs a real network request.

## Acceptance

- [x] Missing scraper credentials fail before remote or filesystem work.
- [x] Direct and root help disclose the same key/model contract.
- [x] README documents safe execution through validated publication.
- [x] Secrets are neither accepted from argv nor printed in errors/help.

## Completion evidence

- A side-effect-free runtime preflight validates the API key and model before
  issuer loading, network access, extractor construction, or file writes.
- Root/direct help share key, model, host, output, and overwrite disclosures;
  argv never accepts a credential and errors never echo one.
- README now documents private key injection, supported issuers, official-host
  defaults, manual YAML review, and the `data:build`/`data:check` sequence.
- Scraper and contract-focused tests passed without network access; final
  `test:bun`, root tests, and full Vitest gates all passed.

## Execution note

`ralph` is unavailable. Prompt 3 will use a stubbed preflight/order loop and
localized documentation-contract tests.
