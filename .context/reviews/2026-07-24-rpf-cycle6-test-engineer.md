# Cycle 6 test-engineer review

- Review date: 2026-07-24
- Reviewed commit: `449f10a2faffaae2a2c47036070b0e61a5b6eec2`
- Status: review only; no product, test, plan, deployment, or protected Cycle 42 artifact was changed
- Result: **2 open findings** (`C6-TE-001` high, `C6-TE-002` medium)

## Inventory and validation

All 2,165 tracked paths were inventoried before narrowing to the test contracts. The test-facing inventory comprises 299 source/config files under `apps/`, `packages/`, `tools/`, and `scripts/`, all 103 tracked `*.test.ts` files, all 10 tracked Playwright specs, both Playwright configs, the Vitest/Bun shims and config, every workspace manifest, the root task graph, and the deployment workflow. I also checked every test-discovery script against the tracked test paths and scanned the complete test inventory for `.skip`, `.fixme`, and `.only`; none were present.

Focused non-browser validation:

- `bun test --coverage packages/core packages/parser packages/rules packages/viz apps/web tools/cli tools/scraper scripts/__tests__`: **2,620 passed, 0 failed, 103 files**, 93.19% functions / 90.62% lines.
- `bunx vitest run --reporter=dot`: **2,550 passed, 0 failed, 95 files**. This independently confirms that the currently configured Bun/Vitest compatibility surface is green.
- `bun run data:check`: passed for all 683 YAML cards, 24 issuers, all generated JSON projections/shards, fallback category labels, and generated README sections.
- No browser or E2E suite was run, as required.

## Findings

### C6-TE-001 — CI accepts and deploys flaky browser regressions

- Severity: **High**
- Confidence: **High**
- Status: **Open**
- Exact region: `playwright.config.ts:11-24`; `.github/workflows/deploy.yml:44-60`
- Concrete failure: the regression config retries every failing CI test twice (`retries: process.env.CI ? 2 : 0`) but does not set `failOnFlakyTests`. Playwright therefore exits successfully when an initially failing test passes on retry. The workflow uploads diagnostic artifacts only under `if: failure()` and then uploads the Pages artifact, so that flaky result is both hidden from artifact collection and admitted to production deployment. This is a present false-green path in the release gate, not a request for additional test breadth.
- Suggested fix: set `failOnFlakyTests: Boolean(process.env.CI)` in the regression config. Preserve retry traces for diagnosis, upload artifacts for flaky as well as failed runs if the workflow exposes that state, and extend `scripts/__tests__/workflow-consistency.test.ts` to lock the fail-closed setting.

### C6-TE-002 — The documentation truth tests green-light two currently false operational claims

- Severity: **Medium**
- Confidence: **High**
- Status: **Open**
- Exact region: `scripts/__tests__/readme-catalog.test.ts:130-143,217-227`; `package.json:19-22,29`
- Concrete failure: the documentation tests validate the root README's Astro claim and the YAML examples in `README.md` plus `.claude/AGENTS.md`, but do not validate `.claude/CLAUDE.md` or regeneration instructions emitted into generated source. Consequently the full 2,620-test suite and `data:check` pass while `.claude/CLAUDE.md:7,22` still says Astro 6 and `apps/web/src/lib/category-labels-fallback.ts:2` recommends a Node command that fails at the current commit with `ERR_MODULE_NOT_FOUND`. This is a demonstrated false-green gap: both missed claims are wrong now.
- Suggested fix: expand the existing documentation contract test, rather than creating a parallel test harness. Derive the Astro major from `apps/web/package.json` and validate every current agent-facing guide; derive the catalog regeneration command from the root script contract and assert both the generator template and checked-in generated header use it. Add a negative fixture for each drift mode.

## Bounded missed-issue sweep

The final sweep rechecked test discovery, disabled/focused markers, runner/version claims, coverage outliers, workflow ordering, and cross-runtime parity. All 103 tracked Bun test files were executed, the configured 95-file Vitest surface also passed, and no orphaned or disabled unit test was found. Uncovered lines were not promoted merely from percentage data: subprocess-only CLI branches and browser/Svelte entrypoints have separate process or E2E coverage, so there was no demonstrable additional unit gap to report. The sweep produced no finding beyond `C6-TE-001` and `C6-TE-002`.
