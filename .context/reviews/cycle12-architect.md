# Review-plan-fix Cycle 12 — architect

## Provenance and disposition

- Review date: 2026-07-24.
- Reviewed revision:
  `e72a4c69f7c0eab7053c61a587c2d040760c236c`.
- Branch: `codex/review-plan-fix-no-deploy-20260723`.
- Lens: package layering, dependency direction, domain and contract ownership,
  state/worker/persistence boundaries, parser and catalog publication flow,
  CLI/scraper composition, and cross-file lifecycle risks.
- Disposition: **pass — 0 genuinely new architect findings**.
- Scope: review and this report only. This role made no source, test, plan,
  generated-data, staging, commit, push, server, browser/E2E, deployment, or
  external-system change.

## Finding count and required fields

**Final count: 0 new architect findings.**

There is no architect finding row to which an original severity, confidence,
confirmed/likely/manual status, concrete failure, or remediation can honestly
be assigned. Current Cycle 12 findings owned by other reports are reconciled
below rather than duplicated under new architect IDs.

## Locked inventory and review coverage

The reviewed tree contains **2,291 tracked paths**. Its sorted tracked-path
manifest SHA-256 is
`1e63a3eb6976ea3c9026611a888d460fdc589166021f1add07987793bb2f4ff4`.
The **1,129** tracked `.context` paths were separated from **1,162** active
product, data, test, documentation, configuration, workflow, and
vendor-integrity paths; the active manifest SHA-256 is
`a36230ca2fc486313b206852fd5864f1fa3931850bfa33e6dac5e0e4ac88be1d`.

| Family | Tracked paths |
| --- | ---: |
| `apps/web` | 168 |
| `packages/core` | 43 |
| `packages/parser` | 86 |
| `packages/rules` | 734 |
| `packages/viz` | 14 |
| `tools/cli` | 28 |
| `tools/scraper` | 35 |
| `scripts` | 19 |
| `e2e` | 16 |
| Root/config/workflow/vendor/other | 19 |

The active inventory includes all package manifests and export maps, compiler
and build configuration, workflow and root scripts, 683 authored card YAML
files, generated/public catalog families, 209 non-test source paths, 174
test/E2E paths, and active documentation. Bulk catalog data was reviewed
through its complete schema, semantic validator, deterministic generator,
publication identity, runtime readers, and full-data checks rather than by
sampling.

Before candidate classification, I read or indexed all **1,139** then-current
`.context` files, including the complete archived/current finding and plan
ledger, the protected Cycle 42 artifacts, and the Cycle 12 code, performance,
security, and design reports that existed before this report was written.

## Architecture trace

The production workspace graph remains one-way and acyclic. Arrows below point
from each consumer to its dependency:

```text
web     → core, parser, rules
core    → rules
viz     → core, rules
CLI     → core, parser, rules, scraper, viz
scraper → rules, viz
```

More exactly, web consumes core/parser/rules; core consumes rules;
visualization consumes core/rules; CLI composes core/parser/rules/scraper/viz;
and scraper consumes rules/viz. No production package imports an application.
A strict relative-import graph over production source also had no strongly
connected component. The remaining test-only CLI-to-web reader import is the
known generated-artifact parity harness, not production dependency
inversion.

The principal runtime flows preserve their intended owners:

1. Browser admission owns `File`, count, and byte limits. Parser runners own
   worker construction, transfer, abort settlement, listener cleanup, and
   termination (`apps/web/src/lib/parser/worker-runner.ts:37-132`), while the
   browser-safe parser entry owns pure byte/row interpretation
   (`packages/parser/src/browser.ts:1-148`).
2. The analyzer composes parsing, taxonomy matching, analysis context, and the
   optimizer worker (`apps/web/src/lib/analyzer.ts:143-283,286-456`).
   Framework-free result construction/coherence remains in
   `apps/web/src/lib/analysis-result.ts`; Svelte state depends on that boundary
   rather than defining it.
3. Replacement epochs and caller abort ownership remain isolated in
   `apps/web/src/lib/analysis-replacement-runtime.ts:44-83,114-207`.
   Persistence separately owns projection, schema migration, exhaustive decode,
   and financial coherence
   (`apps/web/src/lib/persistence.ts:46-166,170-201,624-825`).
4. Rules YAML and taxonomy data pass one schema/semantic authority before
   deterministic projection. The generator hashes the complete identity-free
   summary, optimizer, category, and detail payload set and injects one source
   identity everywhere
   (`scripts/catalog-publication.ts:93-133,195-325`). Browser loaders pin that
   identity before caching independently fetched artifacts
   (`apps/web/src/lib/cards.ts:93-141,308-428`).
5. CLI default optimization consumes the compiled web optimizer artifact;
   authoring cards and categories must be supplied and validated as a pair
   (`tools/cli/src/card-catalog.ts:13-90`). Scraper output remains untrusted:
   network retrieval, LLM extraction, deterministic provenance/quarantine,
   canonical validation, and guarded writing stay in separate boundaries
   under `tools/scraper/src`.

## Cycle 11 repair-boundary review

The four changes since the preceding architect baseline do not create an
additional architecture-only defect:

- Composed sign handling changed the existing canonical shared amount kernel
  (`packages/parser/src/shared/amount.ts:7-55`); it did not add another parser
  owner or browser/server branch.
- Merchant edge metadata is compiled and frozen inside core categorization
  (`packages/core/src/categorizer/normalize.ts:14-130`,
  `packages/core/src/categorizer/taxonomy.ts:42-261`). This preserves the
  prior dependency direction. The older multi-pattern/full-scan redesign
  remains deferred as `D-C1-041`.
- Plural cap telemetry now carries rule/cap-group identity through core,
  worker decode, analysis coherence, persistence, and visualization. Optional
  identity in the core DTO and identity-free persisted v4 acceptance are the
  documented backward-compatibility seam, not a new live-worker ambiguity.
- Source-link semantics changed through the existing rules URL guard and a
  web presentation helper; no catalog or security authority moved into the
  component.

## Current-report and historical reconciliation

The current Cycle 12 code report owns three confirmed failures. In particular,
`C12-CR-001` proves that `buildRuleKey()` overloads `capGroup` for monthly cap
accounting and per-rule daily occurrence state, while semantic validation
does not require one coherent cap definition for a shared group
(`packages/core/src/calculator/reward.ts:88-90,315-387,685-1022`;
`packages/rules/src/catalog-validation.ts:201-455`). That is architecturally
relevant, but it is already one current finding with executable reproductions
and a root repair. It is not assigned a second architect ID or counted again.
The report's per-transaction HTML label and whitespace-first scraper selector
issues are likewise retained only under `C12-CR-002` and `C12-CR-003`.

The Cycle 12 performance report exclusively owns `RPF12-PERF-001`: the CLI
consent-binding wrapper copies every statement-sized byte buffer before an
ordinary local parse. A byte-oriented single-snapshot entry point is also the
architectural root repair, but restating that ownership recommendation here
would inflate one defect into two findings.

The Cycle 12 design report owns the new source-host contrast and unnamed
search-glyph findings. They do not establish a second layering or contract
owner. The security report found no new issue.

Historical reconciliation excluded fixed, rejected, or deferred provenance:
parser/application implementation duplication; handwritten runtime-schema
drift; generator/browser reader duplication; replacement and persistence state
machines; analysis-result ownership; taxonomy fallback and CLI custom
taxonomy/catalog pairing; optimizer and multi-pattern matcher redesigns;
streaming/virtualization/resource work; and prior worker, publication,
navigation, scraper-trust, and package-export repairs. The rejected
leading-NUL/prefixed-XLSX inflation hypothesis was not revived.

## Rejected architect candidates

- Making rule-scoped `CapInfo` identity optional in the package type is weaker
  than a discriminated DTO, but the live worker requires both identity fields,
  persistence deliberately admits the already-deployed identity-free v4
  shape, and the broader handwritten-schema/type-drift class is already
  recorded. No separate current failure was found.
- Browser and Bun parsers still retain environment-specific adapters and some
  mirrored orchestration, but browser-safe pure kernels, parity tests, and
  package exports preserve the established boundary. This is the longstanding
  parser-ownership debt, not a new Cycle 12 finding.
- Persisted analysis snapshots do not carry publication source identity.
  Session storage restores the validated snapshot itself and does not merge
  current catalog objects into it; explicit reoptimization loads and validates
  the current catalog as a new calculation. Without a violated current
  invariant, treating snapshot age as corruption would be speculative.

## Verification and final missed-issue sweep

- `bun run dependencies:check` passed for production import declarations,
  dependency references, and vendored archive identity.
- `bun run data:check` passed for all 683 authored cards, 24 issuers, every
  generated/public projection, and 551 optimizer-executable cards.
- **243 focused tests** passed across analysis coherence, optimizer worker
  decode/ownership, persistence, browser catalog readers, CLI compiled-catalog
  parity, catalog publication, merchant boundary compilation, and exact cap
  telemetry.
- Static package and relative-import graph checks found no production cycle,
  upward application import, or new deep source dependency.

The closing sweep revisited public exports, package and test direction,
framework ownership, parser/runtime parity, state replacement and
reoptimization, worker terminal paths, storage migrations/coherence, cap
identity, catalog projection completeness and source pinning, browser/CLI
parity, scraper promotion, build/data gates, and the complete post-Cycle-11
source diff. Every surviving concrete failure belongs to an existing/current
finding; every other candidate was already fixed/deferred or lacked a
falsified current contract.

This role did not run a server, browser, or E2E suite and did not implement a
repair. The six protected Cycle 42 artifacts were preserved byte-identically.

**Final count: 0 new architect findings.**
