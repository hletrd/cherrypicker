# Review-plan-fix Cycle 11 — architect

## Provenance and scope

- Review date: 2026-07-24.
- Reviewed revision: `5a8e636c0c66136ed3fff0396de226f77758a1bd`.
- Branch: `codex/review-plan-fix-no-deploy-20260723`.
- Lens: package and runtime boundaries, dependency direction, contract
  ownership, browser/server parity, worker and persistence interfaces,
  generator/publication flow, trust ownership, and cross-file lifecycle.
- Disposition: **pass — no genuinely new current-HEAD architecture finding**.
- Scope was review plus this report only. No source, test, plan, generated
  artifact, staging, commit, push, deployment, browser, E2E, or external-system
  state was changed.

## Inventory and coverage

The locked tree contains **2,274 tracked paths**. Its sorted manifest SHA-256
is `8b15dbfc1093940063f141c9fb28442f628d4a333579a31b71aba87b93201ac5`.
After excluding the **1,113** tracked `.context` paths, the **1,161-path**
active manifest has SHA-256
`bfa6a661e70aca250527b7efe58e91a4c655521dc861b076d6333e5af1b03b41`.
The active inventory comprises 168 web paths, 42 core paths, 86 parser paths,
734 rules paths, 14 visualization paths, 28 CLI paths, 35 scraper paths, 19
scripts, 16 E2E paths, and 19 root/config/workflow/vendor/other paths. It
includes all 683 authored card YAML files and 59 JSON artifacts.

I inventoried every package, application, tool, script, workflow, public
artifact family, test family, root manifest/configuration file, and current
and archived plan/review family before classifying candidates. The
architecture trace covered:

1. browser `File` admission and parser workers → package-owned normalization
   and categorization → framework-free analysis facts → optimizer worker →
   replacement state and persistence;
2. canonical taxonomy/card YAML → schema and semantic validation →
   deterministic catalog projections and shared publication identity →
   browser and CLI readers;
3. scraper network policy → untrusted extraction → deterministic quarantine →
   canonical schema/publication gate;
4. core optimization and calculation contracts → browser-safe rules/parser
   entry points → web, CLI, visualization, and scraper adapters; and
5. workspace manifests and dependency rules → generation checks, Astro build,
   static Pages workflow, documentation, and deployment gates.

Production dependency direction remains one-way. The web application consumes
core, parser, and rules; core consumes rules; visualization consumes core and
rules; the CLI composes core, parser, rules, scraper, and visualization; and
the scraper consumes rules and visualization. No production package imports
an application. The one active test-only import of a web catalog reader is the
parity harness for the already documented generated-artifact/browser-reader
duplication, not a production dependency.

## Result: no genuinely new architect finding

No candidate survived both a concrete current failure test and the required
historical/current-report deduplication.

Current ownership remains coherent at the main stateful boundaries:

- `apps/web/src/lib/analysis-result.ts:16-114,721-836` owns the
  framework-free analysis DTO and exhaustive coherence boundary. Analyzer,
  persistence, replacement runtime, and Svelte state depend in that direction.
  `apps/web/src/lib/analysis-replacement-runtime.ts:27-39,44-83,114-207`
  separately owns replacement epochs, abort composition, persistence order,
  and externally visible commits.
- `apps/web/src/lib/optimizer/worker-protocol.ts:7-14,151-185,195-215` treats
  worker output as an untrusted clone boundary and decodes it before the
  result reaches application state. The runner owns listener cleanup,
  settlement, termination, and cancellation; core continues to own optimizer
  semantics.
- `scripts/catalog-publication.ts:113-132,144-170,190-275` validates canonical
  card rules, deterministically projects every runtime payload, hashes the
  complete projection set, and injects one identity into summary, optimizer,
  category, and detail outputs. Browser and CLI consumers reject mixed
  identities, so partial publication fails closed.
- Parser workers and the web adapter retain `File`, progress, and worker
  ownership while shared parser kernels own byte/row interpretation.
  Scraper-produced content remains outside canonical authority until
  deterministic stamping, quarantine, schema validation, and publication.

Three plausible candidates were rejected:

- The optimizer-worker decoder and persistence validator both enumerate
  optimization result shapes. They currently agree and are already covered by
  the prior handwritten-schema/type-drift architecture finding; there is no
  new mismatch or distinct failure to relabel.
- Presentation-side reward-condition enumeration currently covers every
  canonical condition and retains an unknown-condition fallback. This is
  another instance of the same known schema-drift class, with contract tests
  demonstrating current parity.
- The non-serializable validation brand on an `AnalysisResult` proves the
  immediate analyzer-to-replacement handoff. No reachable current path mutates
  the branded object before that check, and persisted data is independently
  decoded and coherently revalidated, so no stale-validation failure was
  established.

## Current-report and historical reconciliation

`C11-CR-001` in the Cycle 11 code-review report is a confirmed parser
correctness defect: overlapping minus forms can be double-negated in
`packages/parser/src/shared/amount.ts`. Its fan-out across parser surfaces
comes from the intended single shared normalization kernel. The root repair
belongs in that canonical kernel and does not reveal a second competing owner
or browser/server parity split, so it is not duplicated here.

`RPF11-PERF-001` remains owned by the Cycle 11 performance report. Compiling
boundary metadata inside the core matcher/taxonomy construction boundary is
compatible with the existing ownership direction. The underlying
multi-pattern matcher work remains deferred as `D-C1-041`; neither item is
recast as a new architecture finding.

The pass also reconciled all prior architecture reports and relevant
aggregates/plans. Parser/application contract duplication, package tests
reaching into the web app, bank metadata duplication, analysis-result
ownership, navigation fragment ownership, catalog
availability/executability, handwritten runtime-schema drift,
replacement/persistence state machines, generator/browser schema
duplication, taxonomy fallbacks, CLI custom taxonomy/catalog pairing, matcher
architecture, and optimizer architecture already have fixed, rejected, or
deferred provenance. None was relabeled. The rejected prefixed-XLSX hypothesis
was not revived.

## Verification and final missed-issue sweep

- `bun run dependencies:check` passed.
- **253 focused contract tests** passed across analysis coherence,
  replacement, persistence, optimizer-worker, card-detail support, canonical
  optimizer artifacts, catalog validation/publication, and scraper schema
  boundaries.
- `bun run data:check` passed for all 683 cards and 24 issuers, including
  generated/public artifact parity, publication identity, and the documented
  551 optimizer-executable cards.

The closing sweep revisited package cycles, public export maps, deep and
test-only reverse imports, duplicated contracts, framework ownership, initial
analysis/reoptimization parity, worker decode/settlement/cancellation,
operation epochs, storage migrations and truncated-state coherence, catalog
projection completeness, source-hash scope, stale-shard cleanup, browser/CLI
reader parity, scraper trust promotion, generated documentation, workflow
privilege, and deploy-gate directionality. Every remaining candidate either
had no concrete current failure or deduplicated to established provenance.

Final count: **0 new architect findings**.
