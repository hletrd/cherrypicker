# Cycle 19 document-specialist review

## Result

No independently new documentation/code mismatch survived repository-wide
comparison. The fail-closed wording of the current coherence and persistence
APIs supports `C19-CR-001`; it is corroborating contract evidence, not a
second finding. Final document-specialist-new finding count: **0**.

Review target: `fcc89801451d1c1a31bb9881d213e117fc4ca923`.

## Inventory and comparison

The review covered the root `README.md`, `.claude/CLAUDE.md`,
`.claude/AGENTS.md`, `.context/reviews/instructions.md`, all 24 generated
issuer README files, `vendor/README.md`, every root/workspace manifest, the
CLI and scraper help-contract sources, public package exports, generated-file
headers, catalog metadata, workflow/toolchain declarations, and all authored
Cycle 18 source/test deltas.

Repository-owned authority was sufficient; no external source was needed.
The following checks agreed with the written contracts:

- `bun run toolchain:check` confirmed Bun 1.3.12;
- `bun run docs:check` confirmed 683 cards, 551 optimizer-executable cards,
  and 24 issuers;
- `bun run data:check` confirmed all authored and generated catalog
  projections;
- `bun run dependencies:check` confirmed manifests, imports, peer contracts,
  and vendored archives; and
- `bun run migrations:check` confirmed the documented domain migration.

The README's supported upload formats, local-browser processing statement,
remote PDF consent boundary, build/check commands, scraper quarantine
workflow, catalog counts, and toolchain version match implementation.
Cycle 18's branded `YearMonth`, four-digit grammar, explicit lower-bound
throw, unified publication identity, legacy `2.0.0` version, and module
TypeScript dependency admission also match their plan and source comments.

## Contract evidence merged into C19-CR-001

- Severity: Low
- Confidence: High
- Coherence contract:
  `apps/web/src/lib/analysis-result.ts:922-981,983-992,1098-1104`
- Persistence result contract:
  `apps/web/src/lib/persistence.ts:709-742,822-845,860-923`
- Lower-bound helper contract:
  `packages/core/src/analysis/context.ts:96-113`

`isAnalysisResultCoherent()` is documented and typed as a boolean
reconciliation boundary; `validateAnalysisResult()` maps a false result to
`null`. `deserializeAnalysis()` maps malformed structures and migration
failures to `invalidResult()`. For an otherwise valid truncated current
payload whose latest month is `0000-01`, both paths can instead expose the
intentional predecessor `RangeError`.

That is a real contract mismatch, but its mechanism and fix are identical to
`C19-CR-001`. Documentation does not need a new public feature or wording
change: the implementation should preserve the public helper throw while
making validators fail closed, then tests should pin the existing return
contracts.

## Final missed-issue sweep

The sweep rechecked stale counts and paths, copyable commands, package
versions and exports, generated ownership comments, date grammar, hash and
schema-version terminology, privacy/consent claims, supported issuers and
formats, warning language, and current/archive ownership. No second current
documentation mismatch remained.

The six protected Cycle 42 paths were excluded from inspection and writes.
