# Plan 77 — Cycle 2 Publication Identity and Contributor Documentation

**Findings:** C2-016, C2-017, C2-018, C2-019, C2-020, C2-024
**Deploy mode:** none
**Status:** completed
**Archived:** 2026-07-23 after Cycle 2 closure

## Outcome

Publish one identifiable catalog generation and make every contributor/user
instruction describe the executable contract.

## Tasks

- [x] Compute one deterministic source/content hash for a publication. Make it
  mandatory in summary, optimizer, every detail shard, and categories.
- [x] Update loaders/caches to verify generation identity across artifacts and
  fail closed or invalidate/retry on mismatch. Add mixed-generation fixtures.
- [x] Update upload help and analyzer comments to describe exact
  previous-calendar-month selection and the 0-won assumption when absent.
- [x] Replace the README YAML block with a minimal canonical rule fixture and
  make `docs:check` parse the fenced example.
- [x] Rewrite `.claude/AGENTS.md` examples from the canonical schema:
  parent/subcategory pairs, required reward selection/cap/support fields, and
  `card.discontinued`.
- [x] Replace manual artifact copying with `bun run data:build` followed by
  `bun run data:check`, listing generated outputs.
- [x] Render inclusive performance maxima as `이하` and test both the exact
  maximum and next-tier minimum.

## Acceptance

- [x] Mixed-generation catalog responses are rejected before use.
- [x] Identical source produces identical publication hashes and bytes.
- [x] README and agent-guide examples pass canonical validation.
- [x] Product copy matches calendar and inclusive-tier semantics.
- [x] `data:build`, `data:check`, `docs:check`, web tests, and build pass.

## Coverage

| Finding | Completion evidence |
|---|---|
| C2-016 | mandatory common hash and mixed-generation test |
| C2-017 | corrected help/comment contract |
| C2-018 | canonical README fixture checked by docs gate |
| C2-019 | canonical agent-guide schema/category example |
| C2-020 | current publication commands/output list |
| C2-024 | inclusive tier copy boundary test |
