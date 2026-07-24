# Review-plan-fix Cycle 17 — dependency expert

## Review identity

- Date: 2026-07-24
- Reviewed revision: `857e12a794e585560a0c447b0a1619def02cbcf3`
- Branch: `codex/review-plan-fix-no-deploy-20260723`
- Lens: manifest/import ownership, lock resolution and integrity, runtime and
  peer compatibility, supply-chain provenance, browser/server boundaries,
  build/test tooling, and missing or unused declarations
- Disposition: **one genuinely new Low finding**
- Scope: review and this report only; no source, manifest, lockfile, generated
  artifact, plan, gate, deployment, or external-system change

## Inventory and dependency graph

The review covered all eight manifests:

- root `package.json`;
- `apps/web/package.json`;
- `packages/{core,parser,rules,viz}/package.json`; and
- `tools/{cli,scraper}/package.json`.

It also covered all 567 package rows and eight workspace rows in `bun.lock`,
the root and workspace TypeScript configs, `bunfig.toml`, `turbo.json`,
Vitest/Playwright/Astro configuration, the deployment workflow, package
exports, root/workspace scripts, all static and dynamic package specifiers in
production and tests, browser/server entry points, the vendored SheetJS
archive and both digest records, and `scripts/check-dependencies.ts` with its
focused tests.

The current lock has one integrity-bearing resolution for each direct
registry identity used here, one local vendored SheetJS resolution shared by
web and parser, and seven valid local workspace links. The Cycle 16-to-17
product delta changes no manifest or lock row. Browser entry points remain
free of Node-only parser/rules modules; server-only PDF, Anthropic, filesystem,
and report dependencies do not enter the checked web bundles by declaration.

## C17-DEP-001 — a web test imports `iconv-lite` without owning the dependency

- Severity: **Low**
- Confidence: **High**
- Status: **Confirmed by exhaustive manifest/import comparison**
- Direct import and use:
  `apps/web/__tests__/parser-cycle5-integrity.test.ts:3,48-50`
- Owning manifest:
  `apps/web/package.json:12-30`
- Current transitive provider:
  `packages/parser/package.json:20-29`
- Policy blind spot:
  `scripts/check-dependencies.ts:553-595,695-720`
- Locked identity: `bun.lock:829`

The web workspace's parity test directly imports `iconv-lite` to construct
CP949 fixtures. Its manifest declares neither a dependency nor a
devDependency for that package. Resolution currently succeeds because the web
workspace depends on `@cherrypicker/parser`, parser declares `iconv-lite`, and
the supported Bun workspace layout makes that transitive package reachable.
History identifies the boundary change precisely: commit `9376035` moved the
test with 94% similarity from
`packages/parser/__tests__/conformance/cycle5-parser-integrity.test.ts`, where
the declaring parser manifest owned it, to the web workspace without adding a
web devDependency.

That is not a stable direct-import contract. An isolated web-workspace test,
a stricter non-hoisting linker, or a future parser implementation that no
longer needs its fallback can leave the web test unable to resolve the module
even though the test itself has not changed. The dependency policy does not
report this because it scans only each workspace's `src` directory and checks
only production `dependencies`; it never inventories test imports or
`devDependencies`.

### Required fix

Declare `iconv-lite` in `apps/web` devDependencies, or move CP949 fixture
encoding behind a helper owned by a workspace that already declares it.
Extend the dependency check to validate test/config imports against
dependencies plus devDependencies, with narrow explicit exemptions for
repository-owned shared runners such as the root Vitest/Playwright tooling.
Add a fixture proving that an undeclared test-only import fails the policy.

## Historical reconciliation

- Cycle 3 `C3-DEP-002` concerned scraper's then-missing direct Zod
  declaration. Scraper now declares Zod; it does not own the web test import
  retained here.
- Cycle 3 `C3-DEP-003` removed seven named heavy dependencies. Neither root
  Zod nor the web test's `iconv-lite` import was among them.
- Root Zod was examined but not retained. Commit `6e81d17` removed the
  generator's direct Zod import, but root generators still import
  `packages/rules/src/index.ts` by relative source path and execute its Zod
  schemas. The full workspace graph therefore consumes the one locked Zod
  identity, rules and scraper own compatible direct ranges, and removing the
  root declaration has no demonstrated resolution, install, or runtime
  benefit. This is not a confirmed unused dependency.
- `packages/viz` declaring `@cherrypicker/rules` without a source import was
  explicitly rejected as a historical private-workspace metadata item in the
  Cycle 14 dependency report and was not reopened.
- The `cherrypicker`/`cardpick` root lock label was explicitly rejected in
  Cycles 12–14 and was not reopened.
- Cycle 16's SheetJS worksheet-metadata finding is implemented at the reviewed
  revision. Vendored archive identity, archive limits, browser isolation, and
  the dependency version itself remain distinct and consistent.
- Prior PDF-package, action-pin, remote-tarball, optional-peer, advisory, and
  parser/browser-boundary findings retain their historical ownership. No
  current evidence supports relabeling them.

A full tracked-history search found references to the web parity test but no
earlier finding, plan, deferred item, or explicit rejection owns its exact
manifest/import mismatch.

## Final missed-file sweep

The closing pass rechecked every manifest declaration against production,
test, configuration, and command consumers; all package exports and runtime
partitions; every current lock workspace/direct identity; registry integrity,
local archive provenance, workspace links, overrides, and peer-policy
coverage; and the complete Cycle 16/Cycle 17 candidate set.

No full dependency gate, audit, install, build, test suite, browser run,
deployment, or external advisory research was performed. Current dependency
state is unchanged from the Cycle 16 locked graph, whose completed report
records passing dependency and audit checks. The protected untracked Cycle 42
artifacts were not opened, modified, staged, or adopted.

Final count: **1 new Low finding, High confidence and confirmed**.
