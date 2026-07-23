# Plan 135 — Cycle 12 Scraper Provenance Wording

**Finding:** C12-007 (`RPF12-DOC-002`, Low/High)
**Status:** completed
**Deploy mode:** none

## Evidence

- The system prompt says `url` is recorded at the trusted scraper boundary.
- Runtime deliberately deletes model-authored `url` and stamps issuer,
  `lastUpdated`, and `source`.
- The schema-contract test names and preserves the false official-URL claim.

## Outcome

Prompt, comments, and tests describe the actual trust boundary: the model
cannot author a published URL, and deterministic code stamps only trusted
issuer/source/time metadata.

## Implementation

1. Add/update a red contract assertion for the exact trusted metadata set.
2. Remove the false `url`-stamping statement and any official-URL wording from
   prompt comments and test names.
3. Keep runtime URL deletion and supported-reward quarantine unchanged.
4. Verify the generated extraction request and malicious-URL response fixture.

## Acceptance

- [x] Prompt and tests no longer claim that the scraper records a URL.
- [x] Model-authored URLs remain absent from parsed output.
- [x] Issuer, source, and extraction date remain deterministically stamped.
- [x] Quarantine and prompt-injection boundaries remain green.

## Execution note

The requested `ralph` skill is unavailable. Prompt 3 will use the approved
manual contract-test fallback. No deployment or external LLM request is
permitted.

## Completion evidence

- Red: the truthful metadata contract failed against the old official-URL
  wording.
- Green: all 102 scraper tests pass; model-authored URLs are deleted and only
  issuer, source, and extraction date are stamped by trusted code.
- Commit:
  `3a22cbef8267c481dda8e5a6a392935df292c5f1`
  (`🐛 fix(scraper): require meaningful source content`).
