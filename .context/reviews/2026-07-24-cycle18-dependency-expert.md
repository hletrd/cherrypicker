# Review-plan-fix Cycle 18 — dependency expert

## Review identity

- Date: 2026-07-24
- Reviewed revision: `c182c8144a4284bae1f28f009a5b0930d7762d5c`
- Branch: `codex/review-plan-fix-no-deploy-20260723`
- Lens: manifest and import ownership, workspace topology, package exports,
  frozen-lock coherence, browser/server boundaries, dependency policy,
  toolchain configuration, and the Cycle 17 ownership repair
- Disposition: **pass — 0 genuinely new dependency findings**
- Confidence: **High**
- Scope: read-only inspection plus this report; no source, manifest, lockfile,
  configuration, plan, generated artifact, dependency installation, process,
  gate, deployment, or external-system change

## Inventory and current graph

The review covered the private root and all seven private workspaces:
`package.json`, `apps/web/package.json`,
`packages/{core,parser,rules,viz}/package.json`, and
`tools/{cli,scraper}/package.json`. It reconciled those manifests with all
eight workspace records and 567 package rows in `bun.lock`, all current
`@cherrypicker/*` import specifiers, package export maps, TypeScript/Bun/Turbo/
Vitest/Playwright/Astro configuration, root and workspace scripts, and the
dependency-policy implementation and fixtures.

The 13 declared workspace edges remain `workspace:*` and form the same
acyclic graph:

```text
web     -> core, parser, rules
core    -> rules
viz     -> core, rules
CLI     -> core, parser, rules, scraper, viz
scraper -> rules, viz
```

The import sweep found no missing workspace target, undeclared current package
import, unexported subpath, browser-to-server entry-point leak, or new cycle.
The exported subpaths used by consumers are declared by core
(`packages/core/package.json:7-13`), parser
(`packages/parser/package.json:7-13`), rules
(`packages/rules/package.json:7-11`), and scraper
(`tools/scraper/package.json:6-8`). Web continues to consume the browser-safe
parser and rules surfaces, while CLI/server code owns the statement, PDF,
Anthropic, filesystem, and reporting surfaces.

The root pins Bun 1.3.12 and ten security/tooling overrides
(`package.json:35-55`). The current dependency delta adds no external identity:
the one `iconv-lite@0.6.3` lock row remains at `bun.lock:830`, and the web
workspace record now references that existing identity
(`bun.lock:16-36`).

## Cycle 17 repair verification

Plan 147 correctly identified a direct web-test import that was relying on
parser's transitive ownership
(`.context/plans/147-cycle17-test-dependency-ownership.md:7-18`) and required
separate production versus test/config policy
(`.context/plans/147-cycle17-test-dependency-ownership.md:20-38`).

The current tree satisfies that repair end to end:

- The test directly imports and uses `iconv-lite` only to construct CP949
  fixtures (`apps/web/__tests__/parser-cycle5-integrity.test.ts:1-4,33-50`).
- Its owning workspace now declares the compatible development range
  (`apps/web/package.json:25-31`).
- The lock's web workspace metadata carries the same range and reuses the
  already-present `iconv-lite@0.6.3` package identity
  (`bun.lock:16-36,830`); no second version or unrelated package row was added.
- The checker inventories production, test, and top-level config sources
  (`scripts/check-dependencies.ts:598-651`), permits runtime declarations in
  production and runtime plus development declarations in test/config
  (`scripts/check-dependencies.ts:626-667`), and keeps only the named,
  root-owned Vitest test-runner exception
  (`scripts/check-dependencies.ts:21-22,604-607,658-667`).
- Focused fixtures cover undeclared test/config imports, accepted development
  ownership, rejection of a development-only production import, and the narrow
  root-runner exception
  (`scripts/__tests__/check-dependencies.test.ts:144-225`).

This closes the Cycle 17 dependency root without broadening production
resolution or weakening workspace ownership.

## `.mts` / `.cts` adjudication

The checker has a real but dormant admission mismatch:
`CONFIG_SOURCE_PATTERN` recognizes `.mts` and `.cts` configuration names, while
`SOURCE_EXTENSIONS` does not include either extension
(`scripts/check-dependencies.ts:11-21`). Both recursive source discovery and
top-level config discovery filter through `SOURCE_EXTENSIONS` before parsing
(`scripts/check-dependencies.ts:464-503`).

No tracked production, test, or workspace-config source currently uses either
extension, so the mismatch skips no current import and demonstrates no present
manifest, install, test, build, or runtime failure. Plan 147 already owns the
test/config admission and classification policy, including its fixture surface
(`.context/plans/147-cycle17-test-dependency-ownership.md:24-38`). Adding the
two extensions and a fixture would be sensible preventive completion if the
repository adopts them, but it is not a genuinely new Cycle 18 dependency root
and is not counted as a finding.

## Historical reconciliation

- The earlier `cherrypicker` manifest versus `cardpick` private-root lock label
  remains long-standing generated metadata. It was explicitly rejected in
  prior dependency reviews and still has no package-resolution consequence
  (`bun.lock:4-14`;
  `.context/reviews/2026-07-24-rpf-cycle17-dependency-expert.md:96-100`).
- The unused private-workspace `viz -> rules` declaration remains the
  initial-scaffold metadata item already adjudicated in Cycle 14; it adds no
  external identity or second runtime copy
  (`packages/viz/package.json:13-17`;
  `.context/reviews/cycle14-dependency-expert.md:47-55`).
- Existing transitive version splits, root YAML/Zod ownership, peer-resolution
  coverage, remote-reference checks, overrides, and vendored SheetJS
  authentication retain their prior ownership. The Cycle 17 delta does not
  alter those package rows or their runtime boundaries.
- The previous dependency expert's sole new item was exactly the web
  `iconv-lite` ownership gap
  (`.context/reviews/2026-07-24-rpf-cycle17-dependency-expert.md:39-80`);
  Plan 147 is completed and the current manifests, lock metadata, policy, and
  fixtures agree with its acceptance criteria.

## Final missed-file sweep

The closing pass rechecked every manifest against current production, test, and
configuration consumers; all workspace subpath imports against export maps;
the complete declared workspace topology; the lock workspace delta; toolchain
ownership; and the prior dependency candidate set. No other current dependency
root remained after history and plan reconciliation.

No install, update, audit, dependency gate, build, test suite, browser run,
deployment, or external advisory query was run in this role. Passing tests
reported in Plan 147 are historical completion evidence, not a new execution
claim. The protected untracked Cycle 42 artifacts were not opened, modified,
staged, or adopted.

Final count: **0 genuinely new dependency findings**.
