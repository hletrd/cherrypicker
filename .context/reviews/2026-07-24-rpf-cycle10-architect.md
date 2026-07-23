# Review-plan-fix Cycle 10 — architect

## Provenance and scope

- Review date: 2026-07-24.
- Reviewed revision: `56c0f1fcd5b670b20cd972556199f37e3f382d8d`.
- Branch: `codex/review-plan-fix-no-deploy-20260723`.
- Lens: layering, ownership, dependency direction, canonical schemas, state
  and data flow, worker/runtime contracts, generation pipelines, and
  cross-file failure containment.
- Tracked inventory: 2,252 paths; sorted manifest SHA-256
  `9bc49df85b00827a14ffb7916e5a964abc7d4d72c921359803418ec264538598`.
- Active inventory after excluding historical `.context` bodies: 1,156 paths;
  manifest SHA-256
  `1c030d6f0f2323e7dd779d02655cbf942528de24c66dd0de4d3e95cec252bf06`.

## Architecture coverage

The pass mapped the complete active repository into these ownership and data
flows:

1. Browser/file input → format detection and parser workers → normalized
   transaction facts → categorization → calendar analysis context.
2. Canonical card/category YAML → Zod and semantic validation → deterministic
   publication projections and identity → browser and CLI catalog readers.
3. Categorized transactions and card rules → optimizer worker → framework-free
   `AnalysisResult` → replacement/reoptimization runtime → persistence and
   Svelte presentation state.
4. Scraper network policy → untrusted model extraction → source-review
   quarantine → canonical rule writer and publication gate.
5. Workspace manifests and browser-safe entry points → root verification,
   Astro build, Playwright boundary, and Pages workflow.

Direct inspection covered all package/application/tool entry points and
manifests, public exports, cross-package imports, analysis/persistence/runtime
contracts, parser and optimizer worker protocols, catalog builders/readers,
scraper validation/writing boundaries, generation scripts, workflow/config
files, and the tests that enforce those boundaries. The 683 declarative card
files and generated artifacts were assessed through their owning canonical
schema, semantic-validation, publication, identity, and parity contracts.

## Result: no genuinely new architect finding

No current architectural defect survived both concrete-failure validation and
the required historical/current-report deduplication.

The strongest current risks are already owned elsewhere:

- Short ASCII taxonomy aliases, unsorted optimizer counterfactuals, and missing
  current-version previous-spending provenance are the three Cycle 10 code
  reviewer findings.
- Duplicate post-worker analysis coherence scans are the Cycle 10 performance
  finding.
- Model-owned card URLs crossing into published “official” links are the
  Cycle 10 security finding.
- Parser/application contract duplication, parser-to-application test
  direction, bank metadata duplication, handwritten schema/type drift,
  catalog executability, analysis-domain ownership, fragment-state ownership,
  replacement/persistence state machines, and generated-artifact boundary
  duplication all have prior review or deferred-item provenance and were not
  relabeled as new.

Current dependency direction remains deliberate: browser surfaces use
browser-safe parser/rules exports; core owns calculation and optimizer
semantics; rules owns canonical catalog contracts; application adapters own
`File`, worker, storage, and Svelte concerns. The split catalog projections
share deterministic publication identity and fail closed on cross-generation
mixing. Scraper output is quarantined before optimizer execution, and the
checked publication path performs canonical structural and semantic
validation.

## Final missed-issue sweep

The closing sweep revisited package cycles, app-to-package and test-only
reverse imports, duplicate runtime schemas, option/provenance ownership,
initial-analysis versus reoptimization parity, worker settlement and
cancellation, storage migrations and truncation, catalog partial publication,
stale shard cleanup, source-hash scope, CLI/web artifact parity, scraper trust
promotion, generated documentation, and deploy-gate directionality. Every
plausible candidate was either behaviorally contained, lacked a concrete
current failure, or deduplicated to existing history/current Cycle 10 work.

No source, test, plan, generated artifact, browser/E2E state, commit, push, or
deployment was changed by this pass.

Final count: **0 new architect findings**.
