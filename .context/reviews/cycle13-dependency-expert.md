# Review-plan-fix Cycle 13 — dependency expert

## Revision lock and disposition

- Date: 2026-07-24
- Reviewed revision: `3e2d66320d213c7c8d7e33ef9a91f899ab70c0f9`
- Branch: `codex/review-plan-fix-no-deploy-20260723`
- Verdict: **1 genuinely new dependency finding**
- Aggregate: **1 Low, High confidence, Confirmed**
- Scope: repository-wide dependency, supply-chain, workspace, runtime/toolchain,
  bundle-compatibility, and dependency-test review; this report is the only
  path written
- Exclusions honored: no manifest, lockfile, source, test, configuration,
  generated artifact, install, upgrade, advisory-network query, browser,
  server, deployment, staging, commit, or push change

## Inventory and method

The locked tree contains 2,318 tracked paths, including 1,152 tracked
`.context` records. Before this report was written, the full deduplication
corpus contained 1,170 `.context` files. I reviewed all eight root/workspace
manifests, the complete 632-entry Bun lock graph, all production and
configuration imports, workspace links and public exports, compiler/task
configuration, the vendored SheetJS archive and checksum, the sole GitHub
Actions workflow, and the dependency implications of both retained Cycle 13
findings.

The graph contains 22 unique direct external package names, five consumed
workspace package names, and all seven local workspace links. Of the 632 lock
rows, 624 registry resolutions carry SHA-512 integrity and the remaining eight
are authenticated workspace/vendor resolutions. No manifest or lock row uses
an HTTP(S), Git, or GitHub package source, and no repository manifest or
vendored SheetJS metadata defines an install lifecycle hook.

Production imports are directly declared by their owning workspaces, and every
consumed `@cherrypicker/*` subpath is exported by its producer. The workspace
graph remains acyclic:

```text
web     → core, parser, rules
core    → rules
viz     → core, rules
CLI     → core, parser, rules, scraper, viz
scraper → rules, viz
```

I independently evaluated all 77 peer contracts serialized in `bun.lock`.
Seventy-six resolve compatibly. One exact optional-peer contract does not, and
it is not checked by the blocking dependency policy.

## RPF13-DEP-001 — the frozen graph violates Astro's exact optional-peer contract

- **Severity:** Low
- **Confidence:** High
- **Status:** Confirmed on current HEAD
- **Manual validation:** Not required
- **Owning manifest:** `apps/web/package.json:14-29`
- **Resolved optional peer:** `bun.lock:169`
- **Astro contract:** `bun.lock:637`
- **Uncovered policy boundary:** `scripts/check-dependencies.ts:309-331`
- **Missing regression coverage:** `scripts/__tests__/check-dependencies.test.ts:16-38`
- **Current dormant configuration:** `apps/web/astro.config.ts:5-19`

### Evidence

The web manifest allows Astro `^7.1.3`. The frozen graph selects
`astro@7.1.3`, whose lock metadata declares the optional peer
`@astrojs/markdown-remark` at the **exact** version `7.2.1`
(`bun.lock:637`). The same lock instead resolves the present optional peer as
`@astrojs/markdown-remark@7.2.0` (`bun.lock:169`).

Two independent local inspections confirmed the mismatch:

```text
bun pm why @astrojs/markdown-remark
@astrojs/markdown-remark@7.2.0
  └─ optional peer astro@7.1.3 (requires 7.2.1)
```

```json
{
  "owner": "astro@7.1.3",
  "peer": "@astrojs/markdown-remark",
  "range": "7.2.1",
  "actual": "7.2.0",
  "optional": true
}
```

This is not an absent optional dependency, which would be permitted. It is a
present dependency that violates the producer's exact compatibility contract.
A frozen CI install reproduces that unsupported graph.

The repository's dependency gate still reports success because
`checkDependencies()` checks direct production imports, remote URL references,
vendored digests, and vendor references only
(`scripts/check-dependencies.ts:309-331`). Its four focused tests mirror those
four concerns and contain no peer-satisfaction fixture
(`scripts/__tests__/check-dependencies.test.ts:16-38`).

### Activation scenario and impact

The current site uses Astro's default Sätteri Markdown processor, declares no
legacy `markdown.remarkPlugins`, `markdown.rehypePlugins`, or
`markdown.remarkRehype` configuration, and has no application `.md`/`.mdx`
source. That is why the current typecheck and production build remain green.

Astro's configuration path dynamically loads `@astrojs/markdown-remark` when
one of those unified/legacy Markdown options is enabled. A contributor can
therefore make an otherwise supported Astro configuration change and receive
the already-present 7.2.0 implementation even though the locked Astro release
requires exactly 7.2.1. The outcome is an unsupported build-time API pairing:
it may appear to work for unchanged APIs, but the exact peer contract provides
no compatibility guarantee and a patch-level fix or API expectation in 7.2.1
is unavailable. The blocking gate would affirm the graph before that path is
exercised.

There is no current end-user regression and the mismatched path is dormant, so
the finding is Low rather than Medium. Its lock-level fact, frozen-install
reproducibility, and policy gap are deterministic, so confidence is High.

### Required fix and dependency regression

1. Regenerate the frozen graph so a present
   `@astrojs/markdown-remark` resolves to the exact `7.2.1` required by
   `astro@7.1.3`; if the optional peer is intentionally unused and the package
   manager supports omitting it, remove the resolution rather than retaining
   an incompatible present version.
2. If the unified Markdown path is intended, declare the compatible peer
   explicitly in the web workspace so ownership is visible.
3. Extend the dependency gate to evaluate every serialized peer contract:
   required peers must be present and semver-compatible; optional peers may be
   absent, but must be compatible when present.
4. Add fixtures proving that `astro@7.1.3` plus present
   `@astrojs/markdown-remark@7.2.0` fails while `7.2.1` passes, then exercise a
   frozen install and the web build.

Do not weaken or ignore the upstream exact peer range merely to make the check
green.

## Remaining dependency, supply-chain, and compatibility result

The Cycle 12-to-13 dependency delta changes no workspace manifest, lock row,
version, override, or vendored input. The root manifest change only routes
`parse` through the already-declared CLI workspace. The workflow change adds
pull-request verification while retaining:

- Bun 1.3.12 in both `packageManager` and runner setup;
- Node 24, satisfying the inspected Astro, Playwright, PDF.js, Svelte, and
  TypeScript engine floors;
- `bun install --frozen-lockfile`;
- local locked Playwright CLI execution;
- no default token permissions and read-only build permissions;
- trusted-main/manual-only Pages/OIDC authority; and
- seven action references pinned to full 40-character commit SHAs.

The other relevant direct peer relationships are compatible: Astro/Svelte/
TypeScript satisfy `@astrojs/svelte@9.0.1`, Vite 8 satisfies
`@tailwindcss/vite@4.3.3`, and Node 24 satisfies Playwright and PDF.js. The
newer `@types/bun` patch is used for tests/tooling; no production Bun-only API
accepted solely by that patch was found, all workspace typechecks pass, and no
runtime failure reproduced, so it is not promoted.

Both web and parser manifests reference the identical
`file:../../vendor/xlsx-0.20.3.tgz` input. Its SHA-256 is
`8dc73fc3b00203e72d176e85b50938627c7b086e607c682e8d3c22c02bb99fe8`,
the checked SHA-512 also matches policy, the sidecar matches, the archive has
no absolute or parent-traversal path, and its package metadata has no install
hook. Completed `C3-DEP-001`/Plan 80 therefore remains closed.

## Same-cycle and historical reconciliation

The two retained Cycle 13 roots are not dependency duplicates:

- exact-cap event telemetry presented as analysis-wide “no loss” is a
  calculator state/DTO/output-contract defect; and
- repeated shared-cap coherence construction is validation-lifecycle
  placement inside application code, not a package resolution, external API,
  or toolchain defect.

Historical dependency findings remain closed: scraper Zod and shared
visualization imports are directly declared, the seven unused direct packages
were removed, SheetJS is authenticated locally with dual digests, frozen
installation is mandatory, the advisory scan is part of `verify`, and action
references remain fully pinned.

The stale root-name string in generated lock metadata and the duplicate
PostCSS override serialization were inspected again and not promoted. Neither
changes resolution, integrity, installed identity, task filtering, or runtime
behavior.

The full `.context` search contained no prior `markdown-remark`, `7.2.1`,
`7.2.0`, optional-peer, or equivalent peer-mismatch finding. Therefore
`RPF13-DEP-001` is genuinely new rather than a renamed historical issue.

### Explicit prefixed-XLSX rejection

The prefixed/leading-NUL XLSX inflation hypothesis remains rejected.
`preflightXLSXArchive()` inspects ZIP metadata only when bytes zero and one are
`PK`; otherwise it returns `not-zip`
(`packages/parser/src/shared/xlsx-archive.ts:113-132`). The authenticated
SheetJS dependency bytes do not change that offset-zero admission boundary,
and this pass found no new import, version, or dispatch path that could make a
prefixed payload reach ZIP inflation. It is not a dependency finding.

## Verification and final missed-issue sweep

- `bun run toolchain:check` passed with Bun 1.3.12.
- `bun run dependencies:check` passed, demonstrating the peer-check gap rather
  than refuting the locked mismatch.
- Focused dependency, toolchain, workflow, and bundle-policy tests passed:
  **25 tests, 82 expectations, 0 failures**.
- `bun run typecheck` passed for all seven workspaces; Astro checked 125 files
  with 0 errors, 0 warnings, and 0 hints.
- The current bundle policy passed: 16 initial files, 167.3 KiB decoded,
  58.5 KiB gzip; compact catalog 17.7% and optimizer 41.7% of their legacy
  artifacts.
- A local read-only lock scan evaluated all 632 rows and all 77 serialized
  peer contracts; `RPF13-DEP-001` was the sole incompatibility.
- The exact-HEAD verifier's full `bun run verify` also passed, including the
  blocking audit and production build. No advisory-network query or build was
  repeated in this role.

The final sweep covered manifest/lock parity, integrity-bearing resolutions,
all required and present optional peers, overrides, production plus
configuration imports, workspace ownership, public subpaths, engine/runtime
pins, install hooks, vendor contents and paths, action pins and permissions,
bundle/runtime compatibility, both retained Cycle 13 roots, all completed
dependency plans, and the full history/deferred ledger. No second dependency
or supply-chain issue survived.

**Final count: 1 genuinely new dependency finding — Low severity, High
confidence, Confirmed.**
