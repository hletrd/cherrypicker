# Review-plan-fix Cycle 19 — architect

## Review identity

- Date: 2026-07-24
- Reviewed revision: `fcc89801451d1c1a31bb9881d213e117fc4ca923`
- Branch: `codex/review-plan-fix-no-deploy-20260723`
- Role: architecture, package direction, boundary ownership, coupling, and
  evolution-risk review
- Disposition: **one genuinely new Low-severity architectural finding**
- Browser work: none assigned or performed
- Product/source changes: none

Cycle 18's work was assessed as an architectural delta, while completed and
deferred history was used only after current boundaries were independently
mapped.

## Inventory and architecture map

All 2,409 tracked paths were classified and covered: 362 source/test paths,
739 data/publication paths, 1,237 context-history paths, and 71 other
manifests/config/docs/workflow/fixture assets.

The current dependency direction is:

```text
rules (schema, availability, browser-safe contracts)
  ↑
core (analysis, categorization, calculation, optimization)
  ↑                    ↑
viz                  web / CLI
  ↑                    ↑
scraper              parser

scripts and CI compose source/data contracts outside runtime packages.
```

The actual edges were verified through package manifests, entrypoint exports,
source imports, dependency-policy AST scanning, Turbo tasks, browser bundle
checks, and E2E freshness checks. Node/Bun-only filesystem, network, LLM, and
generator code remains outside browser-safe exports.

Review coverage included every production and test file in `apps/web`,
`packages/{core,parser,rules,viz}`, `tools/{cli,scraper}`, and `scripts`, plus
the generated catalog, 683 authoring YAML files, documentation, configuration,
and workflow.

## Cycle 18 boundary assessment

### Calendar value object

`YearMonth` ownership stays in the neutral core analysis layer at
`packages/core/src/analysis/context.ts:3-43`. The opaque type and its runtime
constructor are exported through `packages/core/src/index.ts` and the thin web
facade `apps/web/src/lib/analysis-context.ts`; no web/store implementation
leaks back into core.

Construction, predecessor transformation, analysis context, web coherence,
and persistence now share one runtime grammar. The lower-bound error is a
valid domain decision. The older validation boundary nevertheless treats the
partial predecessor operation as total, producing the new boundary finding
below. Parser date policy remains independently narrower, as documented in
Plan 148, so no package was forced to widen its accepted external inputs.

The value-object repair is otherwise a net reduction in representational
ambiguity with no new dependency cycle or layer inversion.

## Finding

### C19-A-001 — partial calendar operation leaks through total validation APIs

- Severity: Low
- Confidence: High
- Status: confirmed by source inspection and direct runtime reproduction
- Domain operation: `packages/core/src/analysis/context.ts:96-109`
- Coherence boundary:
  `apps/web/src/lib/analysis-result.ts:893-981,988-1095`
- Persistence boundary:
  `apps/web/src/lib/persistence.ts:677-708,720-742,822-915`
- Store adapter: `apps/web/src/lib/store.svelte.ts:117-148`

The core correctly models predecessor derivation as partial at `0000-01`.
`isAnalysisResultCoherent()` is a boolean validation API, and
`deserializeAnalysis()` is a data-admission API returning a corrupted result.
Both should be total across untrusted structural input. Their existing web
layer assumes that every value admitted by `isYearMonth()` also has a
predecessor.

A structurally valid current-v4 truncated snapshot can admit `0000-01` through
both monthly-breakdown and previous-basis shape checks. With transactions
omitted, `hasCoherentTruncatedFacts()` derives the predecessor and propagates
the core `RangeError`; the deserializer calls coherence outside its parsing
and migration catches and propagates it again. Direct probes confirmed both
throws.

The store contains the exception only through a broad outer catch, which
conflates deterministic corrupted data with storage API failure. This is a
boundary-contract mismatch: a legitimate partial domain operation was added
without adapting total validators at the layer transition.

Keep the core helper partial. Introduce a checked/nullable predecessor path or
catch the documented range failure at coherence, returning `false`; also make
the deserializer defensively convert validation exceptions to its standard
corrupted result. Tests should pin all three contracts.

Real parsers restrict dates to 1900–2100, so normal analysis cannot create the
witness. Reachability is constructed, tampered, or stale persistence, making
severity Low. Plan 148 owns the direct helper policy but not this older
validator interaction, and no prior historical owner covers it.

### Publication identity

The complete publication identity remains owned by the build boundary:

- normalized projection and canonical hashing:
  `scripts/catalog-publication.ts:96-136,282-411`;
- legacy/browser orchestration and file publication:
  `scripts/build-json.ts:298-495`;
- browser runtime verification:
  `apps/web/src/lib/catalog-publication-identity.ts`,
  `apps/web/src/lib/card-catalog-reader.ts`, and
  `apps/web/src/lib/cards.ts`;
- CLI validation:
  `packages/rules/src/optimizer-artifact.ts` and
  `tools/cli/src/card-catalog.ts`.

The generator now supplies caller-owned legacy projections under named
supplemental keys without teaching the reusable browser projector about
legacy schema details. Hash injection remains separate from identity-free
construction, preventing a circular contract. Legacy schema v2 and browser
schema v1 can share a publication generation without conflating their schema
owners.

No runtime layer gained a dependency on the generator or on a legacy payload.

### Dependency admission

`scripts/check-dependencies.ts:11-22,465-692` owns file discovery, syntax
extraction, and manifest classification in one gate. Deriving config admission
from the shared extension set removes the previous split grammar. The change
does not alter workspace package edges and does not add a production
dependency.

Tests model production, test, and config ownership for both module-TypeScript
extensions. This is cohesive gate evolution, not a new framework abstraction.

## Broader architectural assessment

### Boundaries that remain coherent

- `@cherrypicker/rules/browser` exposes browser-safe schema/availability
  contracts; Node filesystem loaders stay in the main rules entrypoint.
- Core reward and optimizer code depends on domain rules, not on web, CLI,
  persistence, or generated-file APIs.
- Browser parser format implementations are deferred behind dynamic imports
  and format-specific workers; optimizer work has a separate protocol/worker.
- Analysis DTO validation and coherence live outside the Svelte singleton, so
  persistence, replacement, and tests share a neutral contract. C19-A-001 is
  the one current exception-totality breach in that boundary.
- Catalog summary, optimizer, categories, and issuer details are distinct
  projections with one generation identity and explicit readers.
- CLI remote PDF fallback retains an explicit consent boundary; scraper
  network policy and output publication remain separate services.
- Report HTML escaping and terminal sanitization are centralized in viz;
  presentation consumers do not reconstruct those sinks.
- E2E process ownership is isolated in repository scripts and does not confer
  broad process authority.

### Known liabilities, not new Cycle 19 roots

- Browser/server parser duplication retains deferred owner D-01.
- Analyzer orchestration breadth retains D-34 and later explicit planning
  history.
- Greedy replay and matcher scale retain D-09/D-51/D-86/D-C10-02 and related
  performance owners.
- Static-host response-header/CSP limits, session storage, full-page
  navigation, compatibility payloads, and component/DOM bridging all retain
  documented decisions or exit criteria.

No Cycle 18 change deepened those liabilities, changed their reachability, or
invalidated an exit criterion.

## Rejected architectural hypotheses

- **A public brand with a private symbol is unusable across packages:** false;
  consumers receive the opaque type and construct/narrow through exported
  functions, which is the intended nominal boundary. C19-A-001 concerns
  partial-operation handling, not brand visibility.
- **Common catalog identity couples schema versions:** false; schema version
  and generation identity answer different questions, and readers validate
  their own projection schema.
- **Supplemental publication payloads make the helper depend on legacy
  types:** false; the helper accepts a stable keyed unknown-value record while
  build-json owns legacy shape.
- **Extension admission needs a plugin registry:** unsupported at current
  scale; one explicit set plus syntax-kind selection is simpler and covered.
- **Worker, cache, or store ownership crosses route lifetimes unsafely:** no
  current path survived operation-epoch, abort-controller, and reset tracing.

## Classification and evidence

- Confirmed new architecture findings: one Low / High-confidence
  exception-totality boundary defect, C19-A-001.
- Likely new architecture findings: none.
- Manual-validation risks promoted to findings: none. Live UI review belongs
  to the designer role; no browser was launched here.

Dependency ownership, workspace type checking, workspace/script unit tests,
the full Vitest suite, and bundle/request budgets passed during read-only
verification. No deploy, source edit, generated-data write, or external
mutation occurred.

## Final missed-issue sweep

The final sweep revisited package exports, runtime-specific imports, source
and generated truth, DTO ownership, cache/version boundaries, worker
protocols, persistence schemas, cancellation ownership, network/filesystem
services, CI authority, configuration drift, and historical deferrals. It
also checked every Cycle 18 changed source and every direct caller/test.

No relevant file was skipped. C19-A-001 is the sole new boundary defect; no
additional coupling, cycle, split authority, or invalid abstraction survived.

Final new finding count: **1**.
