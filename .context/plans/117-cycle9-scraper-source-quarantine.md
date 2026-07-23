# Plan 117 — Cycle 9 Scraper Source Quarantine

**Finding:** C9-008 (Medium/Medium, manual validation)
**Status:** completed
**Deploy mode:** none

## Evidence

- Fetched page text is interpolated into the same LLM message as extraction
  instructions without an explicit untrusted-data boundary.
- Tool and Zod validation constrain shape, not source truth. A compromised or
  explicitly allowed host can induce structurally valid `supported` rewards.
- Manual review is documented, but generated supported rules can reach
  publication and optimizer scoring if that step is skipped.

## Outcome

LLM-extracted facts are treated as untrusted evidence, never executable reward
rules, until an explicit human source review promotes them.

## Implementation

1. Mark fetched content as untrusted in the system prompt and place it inside
   an unambiguous data delimiter whose contents must never be followed as
   instructions.
2. At the deterministic response boundary, downgrade every model-authored
   `supported` reward to a clear pending-source-review unsupported state.
   Preserve already-unsupported reasons.
3. Keep issuer, trusted extraction date, and source provenance stamped outside
   model authority. Ensure prompt injection cannot override quarantine through
   tool fields.
4. Update direct/root help and README publication steps: authors must compare
   facts with the source and explicitly promote each reviewed reward before
   `data:build`; generated output is catalog-only until then.
5. Add adversarial response/page fixtures that request instruction override
   and emit supported rewards. Assert the written rule remains non-executable
   and no secret or page instruction enters trusted metadata.

## Acceptance

- [x] Untrusted page instructions cannot directly create optimizer-executable
      rewards.
- [x] Generated YAML visibly records pending source review.
- [x] Explicit reviewed promotion remains possible through the normal authored
      YAML contract.
- [x] Help, README, extractor tests, and calculator integration agree.

## Execution note

Security findings are not deferred. With no registered `ralph` skill, Prompt 3
will use adversarial fixtures and a deterministic extraction/publication
boundary loop.

## Completion evidence

- Page content is JSON-delimited as untrusted data, and issuer, source, and
  extraction date are stamped outside model authority.
- Model-supported rewards are deterministically downgraded to
  `pending_source_review` until an author promotes reviewed YAML. Adversarial
  extractor, writer, help, and calculator tests passed with the full gates.
