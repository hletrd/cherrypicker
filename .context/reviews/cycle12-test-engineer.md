# Review-plan-fix Cycle 12 — test engineer

- Date: 2026-07-24
- Reviewed revision: `e72a4c69f7c0eab7053c61a587c2d040760c236c`
- Branch: `codex/review-plan-fix-no-deploy-20260723`
- Disposition: **1 genuinely new finding — 1 Medium**
- Scope: review and this report only; no implementation, source/test/config or
  generated-artifact change, staging, commit, push, deployment, server,
  browser, or E2E run

## Inventory and test architecture

I classified all **2,291 tracked paths** before reviewing the test system:
**1,129** tracked `.context` paths and **1,162** active product, data, test,
documentation, workflow, configuration, and vendor-integrity paths. The active
tree contains 202 production-like source files and 141 runnable unit/E2E test
files:

| Test family | Files |
| --- | ---: |
| Web unit and source-contract tests | 55 |
| Core | 15 |
| Parser | 23 |
| Rules/catalog | 7 |
| Visualization/reporting | 3 |
| CLI | 10 |
| Scraper | 10 |
| Repository scripts/workflow/process controls | 8 |
| Playwright E2E specifications | 10 |
| **Total** | **141** |

The review covered every workspace's production/test relationship; root and
workspace manifests; Turbo, Bun, Vitest, TypeScript, Astro, and Playwright
configuration; all repository scripts; the sole GitHub Actions workflow; the
custom E2E owner/port/process runner; fixtures and temporary-file cleanup; and
the generated-data, documentation, dependency, type, lint, build, unit, and
browser gates. No test is marked `.skip`, `.only`, `.todo`, or `.fixme`.

The root unit gate delegates all workspace suites to Turbo/Bun and then runs
the repository-script tests (`package.json:13`). The broader `verify` gate also
runs toolchain, migration, dependency, advisory, data, lint, type, and web-build
checks (`package.json:18-29`). Browser regression is deliberately separate
(`package.json:15`) and the deployment workflow correctly runs both `verify`
and browser regression before publication. The finding below concerns when
those otherwise substantial gates run.

## Finding

### RPF12-TE-001 — automated verification starts only after a change reaches `main`

- **Severity:** Medium
- **Confidence:** High
- **Status:** Confirmed by complete workflow inventory and a focused
  workflow-contract test
- **Locations:**
  - `.github/workflows/deploy.yml:3-6` — the repository's only workflow
    triggers on a push to `main` or manual dispatch; it has no
    `pull_request` trigger.
  - `.github/workflows/deploy.yml:41-45` — the otherwise strong `verify` and
    browser-regression gates are inside that post-merge deployment workflow.
  - `scripts/__tests__/workflow-consistency.test.ts:23-39` — the parsed
    workflow contract omits the trigger map entirely.
  - `scripts/__tests__/workflow-consistency.test.ts:56-202` — tests enforce
    action pins, permissions, tool versions, gate content/order, E2E
    configuration, and workspace command shape, but never assert when the
    workflow runs.

`git ls-files .github/workflows` contains only `deploy.yml`, and a complete
workflow search found no `pull_request` or equivalent pre-merge event. The
focused workflow-consistency suite nevertheless passed all eight tests. That
green result therefore gives strong confidence in the contents of a deployment
run while leaving the absence of any pre-merge run invisible.

- **Concrete failure:** a pull request changes parser behavior and also breaks
  its unit test, typecheck, generated-data parity, web build, or browser
  regression. GitHub Actions provides no repository-owned status before the
  merge, so review can complete without an automated signal. Only the push
  after the change has entered `main` starts verification. A failure prevents
  the new Pages artifact from deploying, but the default branch is already
  broken and now requires a revert or follow-up repair. Branch protection
  cannot require a repository-supplied check that is never created for the
  pull request.
- **Suggested fix/test:** first extend the parsed workflow type and its contract
  test to require a read-only `pull_request` verification path. Then split
  verification from publication, either into separate workflows or jobs:
  run installation, `bun run verify`, and `bun run test:e2e` for pull requests
  and pushes to `main`, while guarding Pages artifact upload and deployment so
  they run only for the trusted `main` push/manual path. Add negative fixture
  tests proving that removing the PR trigger or allowing the Pages/OIDC write
  job on a PR fails the workflow contract.

## Historical and same-cycle reconciliation

At final reconciliation I had indexed and candidate-searched all **1,143**
`.context` files then present, including 1,129 tracked records, the six
protected Cycle 42 artifacts, all seven sibling Cycle 12 reports, and this
report. I read the implicated current/archived test reviews, aggregates,
completed plans, deferred register, and every sibling Cycle 12 report end to
end.

This does not revive the old `D-05` “No CI quality gate” item
(`.context/plans/00-deferred-items.md:41-47`). That item specifically required
test, lint, and typecheck commands in the deploy workflow; the current
`verify` step satisfies that content requirement. `RPF12-TE-001` is the
previously unreported trigger boundary: the repository waits until after
merge to invoke those commands. Full-history searches for pull-request,
pre-merge, branch-protection, required-status, and merge-gate findings returned
no prior owner.

The current Cycle 12 code findings (shared-cap identity/coherence,
per-transaction cap wording, and whitespace-first scraper selection),
performance finding (statement-byte copies), document findings (the no-op root
`parse` script and false scraper prompt contract), designer candidates, and
the critic's browser cap-disclosure finding retain their same-cycle
dispositions and are not duplicated here. The critic's later novelty challenge
to the CardGrid SVG is likewise left to same-cycle aggregation. The architect
and security reports found no additional issue.

I also excluded the already deferred mixed Bun/Vitest runner and coverage-gate
work, historical fixed conditional-assertion and flaky-browser issues, the
known E2E `/tmp` fixture cleanup debt, build-stats fallback debt, broad
accessibility-gate requests, and previously repaired parser/core/catalog
contract gaps. The Cycle 11 amount-sign, merchant-boundary, cap-telemetry, and
source-label repairs have focused regression coverage. The rejected
prefixed/leading-NUL XLSX hypothesis remains rejected and was not revived.

## Verification and final missed-issue sweep

- `bunx vitest run --reporter=dot` passed **2,977 tests across 122 files** in
  the supplemental unit-only runner.
- `bun test scripts/__tests__/workflow-consistency.test.ts` passed **8 tests**
  and 54 expectations, independently confirming that the present workflow
  contract cannot see the missing trigger.
- No browser, E2E, preview/dev server, or E2E status command was run in this
  role.

The closing sweep revisited amount/date/format matrices, parser diagnostics and
server/browser parity, worker settlement and cleanup, categorization and
reward/cap invariants, optimizer determinism, persistence/replacement
coherence, catalog schema/publication parity, CLI subprocess and consent
contracts, scraper network/extraction/writer tests, report rendering,
weak/conditional assertions, timers/retries, temporary paths, runner
portability, skipped/focused tests, and every package/configuration gate.
Candidates that were guarded by preceding exact assertions, fixed, deferred,
already owned, unsupported by the product contract, or not reproducible were
excluded.

The six protected Cycle 42 artifacts remained byte-identical. The only path
written by this role is `.context/reviews/cycle12-test-engineer.md`.

**Final count: 1 new finding — 1 Medium.**
