# Cycle 7 test-engineer review

Review snapshot: `3086a379e31e5b17f82401807f5b3c24325b9962` on 2026-07-24.

## Inventory and verification

The review inventoried all 2,175 tracked paths, then bounded the test surface to:

- 108 unit-test files: 40 under `apps/web`, 8 under `packages/core`, 27 under `packages/parser`, 6 under `packages/rules`, 2 under `packages/viz`, 7 under `scripts`, 9 under `tools/cli`, and 9 under `tools/scraper`.
- 10 Playwright spec files plus their fixtures, stylesheet, and two screenshot baselines.
- 197 production TypeScript, JavaScript, Astro, Svelte, CSS, and HTML files used to map tested behavior back to its implementation.
- Root/workspace package manifests, Turbo/Bun/Vitest/Playwright/TypeScript/Astro configuration, the deployment workflow, and the custom E2E runner.

Every tracked test file was enumerated and included in source-level assertion, skip/focus, process-boundary, and source-to-test sweeps. All 108 unit files were exercised. All 10 Playwright specs and both Playwright configurations were read. Verification results:

- `bun run test`: passed, including every Turbo test task and 65 script tests.
- `bun test --coverage packages/core packages/parser packages/rules packages/viz apps/web tools/cli tools/scraper scripts/__tests__`: 2,707 passed, 0 failed; 91.87% function coverage and 89.78% line coverage.
- `bunx vitest run --reporter=dot`: 100 files and 2,630 tests passed.
- `bun run data:check`: passed for 683 cards across 24 issuers and the generated documentation/data outputs.
- No `.skip`, `.fixme`, or `.only` marker was present in the tracked test suites.

The Playwright suite was not launched from this review because other cycle reviewers shared the same persistent E2E process. Its complete static surface was reviewed, including the direct-invocation guard, release retries, flaky-test policy, server reuse policy, and runner ownership.

## Findings

### C7-TE-001 — Three CSV regression tests become assertion-free when parsing returns no transactions

- Severity: Medium
- Confidence: High
- Classification: Confirmed
- Location: `packages/parser/__tests__/csv.test.ts:979-1003`, `packages/parser/__tests__/csv.test.ts:1023-1044`, and `packages/parser/__tests__/csv.test.ts:1046-1061`

The three tests put every transaction assertion behind `if (result.transactions.length > 0)` and never assert a minimum or exact transaction count first. A parser regression that returns `[]` for these inputs therefore makes the bodies at lines 998-1002, 1037-1043, and 1057-1060 no-ops, while all three named regression tests still pass.

The current parser returns the expected three, three, and two transactions, respectively. The failure is in the tests' ability to detect a future regression: a change to header/data inference could discard all rows and preserve a green suite for the exact amount-detection behavior these cases claim to protect.

Root-cause fix: assert the exact expected transaction count before inspecting values, then assert the complete amount arrays (`[3500, 12000, 5000]`, `[3500, 12000, 5678]`, and `[10000000, 25000000]`). Remove the conditional guards so a missing parse result is an immediate failure.

### C7-TE-002 — The direct-Playwright freshness guard checks one source file but imports three compiled modules

- Severity: Medium
- Confidence: High
- Classification: Confirmed
- Location: `e2e/core-regressions.spec.js:16-44`

The `beforeAll` comment promises that direct Playwright invocation never exercises stale compiled core code. The guard compares only `src/categorizer/matcher.ts` with `dist/categorizer/matcher.js` at lines 24-34, but the same hook imports `dist/optimizer/constraints.js` and `dist/optimizer/greedy.js` at lines 39-44 without checking either optimizer source.

For example, editing `packages/core/src/optimizer/greedy.ts` while leaving an existing `dist` tree in place does not trip this guard if the matcher timestamps remain acceptable. `bunx playwright test` then evaluates stale optimizer code and can report a false green. The repository's `bun run test:e2e` wrapper builds first, but the test explicitly supports and claims to protect direct invocation.

Root-cause fix: make freshness cover the complete imported source graph. A build-provenance manifest or content hash for the core package is more robust than mtimes; at minimum, compare each imported source/dist pair. Add a runner-level regression test that makes only an optimizer source newer and verifies direct invocation refuses to proceed.

### C7-TE-003 — The workflow documentation gate validates Bun but misses the Node runtime used by its documented web command

- Severity: Medium
- Confidence: High
- Classification: Confirmed
- Location: `scripts/__tests__/workflow-consistency.test.ts:101-109`
- Cross-file evidence: `README.md:139-155`, `package.json:10-12`, and `.github/workflows/deploy.yml:24-30`

The workflow test derives the Bun version and requires the README's Bun-only prerequisite sentence, but it does not validate the Node version or require Node to be documented. The README consequently says Bun 1.3.12 is the required tool while its next documented workflow invokes `bun run dev:web`, whose root script is `cd apps/web && node --run dev`. Deployment separately installs Node 24.

A contributor following the tested README on a Bun-only machine reaches the advertised web command and fails because `node` is absent or incompatible, while the documentation gate remains green.

Root-cause fix: treat both runtime pins as one toolchain contract. Derive the Node major used by the workflow/web script, require the README to list Node 24 alongside Bun 1.3.12, and make `toolchain:check` validate both runtimes before installation or development.

### C7-TE-004 — The “executable CLI examples” test checks only text presence and misses the remote fallback's required API key

- Severity: Medium
- Confidence: High
- Classification: Confirmed
- Location: `scripts/__tests__/readme-catalog.test.ts:280-287`
- Cross-file evidence: `README.md:157-164` and `packages/parser/src/pdf/llm-fallback.ts:207-223`

The test named “keeps the documented CLI examples executable through root scripts” only checks that two command strings occur in the README. It neither validates their runtime prerequisites nor checks the remote path. The documented `--allow-remote-llm` command has no accompanying `ANTHROPIC_API_KEY` setup, while `parsePDFWithLLM` rejects a missing or malformed key before it can make the request.

For a locally unparseable PDF, a user can follow the tested example, consent to remote fallback, and then receive the missing-key error. The gate passes because the command text exists.

Root-cause fix: model documented commands as contracts rather than string snippets. Require the remote example's prerequisite section to name `ANTHROPIC_API_KEY` and test the CLI with a stubbed remote client for both a documented valid setup and the documented missing-key failure. Keep real credentials out of fixtures.

## Missed-defect sweep and coverage statement

The final sweep covered conditional/no-op assertions, skipped or focused tests, duplicated runner surfaces, release retry/flaky semantics, stale build artifacts, subprocess and port ownership, generated-data checks, documentation truth checks, and production areas with weak file-level coverage. Other conditional assertions found by the sweep had an earlier cardinality assertion and were not reported. The Cycle 6 flaky-release and Astro/tooling documentation findings are fixed at this snapshot and were not repeated.

Result: **4 current findings** (`C7-TE-001` through `C7-TE-004`), all confirmed. The only dynamic gap in this lens is the unlaunched Playwright browser run noted above; no browser-only failure is asserted from static evidence.
