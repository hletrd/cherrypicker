# Review-plan-fix Cycle 12 — dependency expert

- Date: 2026-07-24
- Reviewed revision: `e72a4c69f7c0eab7053c61a587c2d040760c236c`
- Branch: `codex/review-plan-fix-no-deploy-20260723`
- Disposition: **pass — 0 genuinely new dependency findings**
- Scope: dependency/supply-chain review and this report only; no manifest,
  lockfile, source, test, configuration, generated-artifact, staging, commit,
  push, install, deployment, server, browser, or E2E change

## Inventory and result

I reviewed all eight root/workspace manifests, the complete 632-entry lock
graph, root and package compiler/task configuration, production imports,
workspace links and public subpath exports, repository scripts, the vendored
SheetJS input, the sole GitHub Actions workflow, and the dependency implications
of every retained Cycle 12 candidate.

The dependency graph has 22 unique direct external package names and five
consumed workspace package names. All seven workspace links resolve locally.
All 624 registry rows in `bun.lock` carry SHA-512 integrity; the remaining rows
are authenticated local workspace or vendored-archive entries. No manifest or
lock row uses an HTTP(S), Git, or GitHub package source, and no repository
manifest defines an install lifecycle hook.

Production package imports are directly declared by their owning workspaces,
and every consumed `@cherrypicker/*` subpath is present in the producer's
export contract. The established dependency graph remains acyclic:

```text
web     → core, parser, rules
core    → rules
viz     → core, rules
CLI     → core, parser, rules, scraper, viz
scraper → rules, viz
```

The vendored `xlsx-0.20.3.tgz` is referenced identically by the browser and
parser manifests and lockfile. Its current SHA-256 and SHA-512 match the
blocking policy, its checksum sidecar matches, its archive has no absolute or
parent-traversal entry, and its package metadata has no install hook. This
keeps completed `C3-DEP-001`/Plan 80 closed.

The workflow uses a frozen lockfile, pins Bun 1.3.12 consistently, sets up
Node 24 explicitly, begins with no token permissions, grants only
`contents: read` to verification, grants Pages/OIDC writes only to deployment,
disables checkout credential persistence, and pins all seven action references
to full 40-character commit SHAs.

**Final count: 0 new dependency findings.**

## PR-trigger validation and safe repair shape

`RPF12-TE-001` is confirmed and remains owned by the test-engineer report. The
sole workflow triggers only on `main` push and manual dispatch, so dependency
installation, `verify`, and browser regression do not create a pull-request
status. Historical `D-05` required verification content in the deploy path;
that content now exists, making the missing pre-merge trigger genuinely
distinct rather than a revival of `D-05`.

The dependency/supply-chain-safe repair is:

1. Use `pull_request`, never `pull_request_target`, for code from a pull
   request.
2. Run checkout, frozen installation, `bun run verify`, and browser regression
   in a read-only verification job/workflow.
3. Keep Pages artifact upload and the Pages/OIDC deployment job conditional on
   a trusted `main` push or explicit manual dispatch; do not expose publication
   authority to PR code.
4. Extend the workflow contract to assert both event selection and
   main/manual-only write jobs, while retaining full-SHA action pins and
   `persist-credentials: false`.

This is remediation detail for the existing test finding, not a second
dependency ID.

## Same-cycle and historical reconciliation

The verifier retained nine unique Cycle 12 findings. None establishes a
separate dependency root cause:

- shared-cap identity/coherence is domain-state and validation logic;
- standalone cap wording and omitted browser cap disclosure are output sinks;
- scraper whitespace fallback and false URL-stamping wording use already
  declared, integrity-locked Cheerio/Anthropic/rules dependencies;
- CLI statement copies occur inside the existing parser boundary;
- source-host contrast is presentation;
- the no-op root `parse` script is a manifest command contract already owned
  by `RPF12-DOC-001`; and
- the missing PR trigger remains `RPF12-TE-001` as described above.

The unnamed CardGrid SVG remains the verifier-rejected historical Cycle 9
duplicate. Earlier dependency findings are closed: direct scraper Zod and
shared visualization dependencies are declared, the seven unused direct
packages were removed, SheetJS is vendored with dual digests, frozen install
and dependency-policy checks are blocking, and the advisory scan is part of
`verify`.

The stale root-name string inside lockfile metadata and the identical duplicate
PostCSS override serialization were inspected but not promoted: neither changes
resolution, integrity, installed package identity, task filtering, or runtime
behavior, and no concrete dependency failure reproduced. They are generated
metadata polish, not reportable supply-chain findings.

The rejected prefixed/leading-NUL XLSX inflation hypothesis remains rejected.
Dependency provenance of the SheetJS bytes is authenticated, and no new
evidence changes the parser's byte-zero `PK` admission precondition.

## Verification and final audit

- `bun run dependencies:check` passed.
- `bun run toolchain:check` passed with Bun 1.3.12.
- Focused dependency and workflow policy tests passed: **12 tests, 61
  expectations, 0 failures**.
- Local package-manager inspection resolved 632 locked packages and all seven
  workspaces without a missing direct dependency.
- No advisory-network query or package install was performed in this role; the
  repository's blocking `bun audit` remains part of `verify`.
- No server, browser, E2E, deployment, or external-system mutation occurred.

The final sweep covered manifest/lock parity, integrity-bearing resolutions,
overrides, workspace ownership, deep imports/exports, compiler/runtime pins,
install hooks, vendored contents and paths, workflow action pins and
permissions, PR trust boundaries, all retained Cycle 12 candidates, completed
dependency plans, and the deferred/history ledger. No distinct dependency or
supply-chain failure survived.

The six protected Cycle 42 artifacts remained byte-identical. The only path
written by this role is `.context/reviews/cycle12-dependency-expert.md`.

**Final count: 0 genuinely new dependency findings.**
