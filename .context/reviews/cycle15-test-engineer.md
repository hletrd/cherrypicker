# Review-plan-fix Cycle 15 — test engineer

- Date: 2026-07-24
- Reviewed revision: `4b1f368d6b8b92cf009ba18d93639f841a8b5d06`
- Branch: `codex/review-plan-fix-no-deploy-20260723`
- Disposition: **0 genuinely new findings**
- Scope: review and this report only; no source, test, configuration,
  generated-artifact, plan, staging, commit, push, deployment, browser,
  preview-server, or E2E change/run

## Inventory and test architecture

I classified all **2,354 tracked paths** before the final sweep: **1,185**
tracked `.context` paths and **1,169** active product, data, test,
documentation, workflow, configuration, and vendor-integrity paths. The active
tree contains 203 production-like source/script paths and 146 runnable
unit/integration/E2E specification files:

| Test family | Files |
| --- | ---: |
| Web unit and source-contract tests | 56 |
| Core | 19 |
| Parser | 23 |
| Rules/catalog | 7 |
| Visualization/reporting | 3 |
| CLI | 10 |
| Scraper | 10 |
| Repository scripts/workflow/process controls | 8 |
| Playwright E2E specifications | 10 |
| **Total** | **146** |

The audit mapped every workspace's implementation to its tests and inspected
the root/workspace manifests, Bun lockfile, Turbo/Bun/Vitest/TypeScript/Astro/
Playwright configuration, repository scripts, workflow contracts, E2E process
owner, fixtures, generated-data checks, and current documentation. The 683
authoring card files and split/compiled catalog artifacts were covered through
the canonical schema, complete-catalog, publication-identity, generated-byte,
browser-reader, and CLI-artifact oracles rather than sampled as isolated
fixtures. No active test is marked `.skip`, `.only`, `.todo`, or `.fixme`.

The root Bun gate reaches all 136 non-browser specification files. Vitest
reaches 127 compatible files, with the Bun-only CLI subprocess test excluded
by configuration. Playwright's 10 specifications are deliberately owned by
the separate repository E2E runner; the blocking and screenshot-only
configurations remain disjoint.

## Findings

No reproducible test deficiency, weak oracle, flake/shared-state failure, or
missing failure/edge/integration case that is both open at this HEAD and
genuinely new relative to the archived reviews and plans survived the
behavioral and history checks.

## Current-HEAD changed-contract review

The only product delta since the Cycle 14 review baseline `5260bbd` is the
stateless counterfactual-prefix optimization and its public completeness
comment:

- `packages/core/src/calculator/reward.ts:1127-1200` validates the private
  optimizer proof, requires collection plus the exact appended-row boundary,
  and independently gates it on the prepared card's derived statelessness.
- `packages/core/src/calculator/reward.ts:1256-1312,1522-1563` uses one
  row-local flag for candidate/group work, applied-reward accumulation,
  emission, and reconciliation while preserving every actual-history row.
- `packages/core/src/optimizer/greedy.ts:228-270,646-682` has the sole
  production enabling site and derives it from the live monotonic
  portfolio-completeness latch plus the card's cap participation.
- `packages/core/__tests__/cycle14-reconciled-stateless-cap-prefix.test.ts:
  157-357` locks ordinary versus claimed output identity, invalid proof
  boundaries, `maxUses` and fixed-per-day retention, unsafe direct-call and
  optimizer knownness, public-export isolation, and deterministic operation
  counts.
- `packages/core/src/calculator/types.ts:68-83` now documents incomplete
  suppression arrays by consequence rather than claiming overflow is the only
  cause.

I did not rely on those assertions alone. Two read-only differential probes
exercised the production implementation:

1. A deterministic 2,000-case direct prepared-card matrix varied transaction
   counts, additive/exclusive groups, categories, rates, per-transaction,
   monthly, and global caps. All **1,983** cases whose prefixes and complete
   invocation satisfied the optimizer proof had byte-identical ordinary and
   claimed outputs; the other 17 were correctly ineligible because
   completeness was already false.
2. A deterministic 500-case full-optimizer matrix varied one to four cards and
   one to seven transactions. Each fast stateless result was compared with a
   semantically unreachable fixed-per-day sentinel that forced the existing
   full-history slow path. Assignments, alternatives, totals, cap events,
   diagnostics, ordered portfolio losses, and `undefined` versus present-array
   knownness were byte-identical in every case.

The focused Cycle 14 file also passed under both configured unit runners:
**5 tests / 28 expectations** under Bun and **5 tests** under Vitest. No
current behavior or runner-specific failure was reproduced.

## Historical reconciliation and excluded candidates

I indexed and candidate-searched all 1,185 tracked `.context` records plus the
six protected untracked Cycle 42 artifacts. I read the recent Cycle 12–14 test
reviews, QA/verifier/debugger evidence, aggregates, Plans 138–142, the deferred
register, and the implicated older test-infrastructure plans.

- A permanent property/differential suite could provide additional defense,
  but its absence is not a new failing contract: the current focused
  regression, existing cap-loss/prepared/determinism matrices, live catalog
  witnesses, both unit runners, and the independent differentials above all
  agree. No unsupported correctness claim was promoted from a generic
  hardening wish.
- The DOM-capable Svelte component harness remains the explicit Plan 70
  deferral. Built-app Playwright coverage and source-contract tests do not
  silently close that item, but it is historical rather than a Cycle 15
  finding.
- Coverage thresholds and Bun/Vitest standardization remain registered as
  `C32-INFRA02` and `C32-INFRA03`; Playwright parallel/browser-matrix choices
  remain `C32-INFRA04`.
- The fixed-path `/tmp/test-invalid.txt` cleanup debt, old fixed waits,
  date-clock testability, and broad accessibility-gate requests already have
  historical owners or completed repairs and gained no new failure evidence.
- The historical prefixed/leading-NUL XLSX inflation hypothesis remains
  explicitly rejected. This revision adds no parser change, production
  fixture, failing boundary, or evidence that a non-`PK` prefix enters ZIP
  inflation, so it was not revived.

## Verification and final missed-issue sweep

- Broad Bun run:
  `bun test packages/core packages/parser packages/rules packages/viz
  apps/web/__tests__ tools/cli tools/scraper scripts/__tests__` —
  **3,208 passed, 0 failed, 13,776 expectations across all 136 non-E2E
  specification files**.
- Supplemental runner:
  `bunx vitest run --reporter=dot` — **3,110 passed, 0 failed across 127
  files**.
- `git diff --check 5260bbd..HEAD` and the local `git diff --check` completed
  cleanly.
- The 10 Playwright specifications and both configurations were inspected
  statically. No browser, E2E, preview/dev server, deployment, or external
  request was run in this role.

The closing sweep revisited conditional and weak assertions, fake timers,
abort/listener cleanup, temporary paths, subprocess isolation, shared caches,
worker settlement, retry behavior, runner discovery/parity, amount/date/format
matrices, server/browser parser conformance, categorization, reward/cap
ordering, optimizer determinism and knownness, persistence/replacement
coherence, catalog publication, CLI consent and output races, scraper
network/write boundaries, report sinks, workflow inclusion, and
generated-artifact identity. Candidates that were already fixed, deferred,
historically owned, unsupported by a product contract, or not reproducible
were excluded.

The six protected Cycle 42 artifacts retained their recorded SHA-256 hashes
and remained untracked, unstaged, and untouched. The only path written by this
role is `.context/reviews/cycle15-test-engineer.md`.

**Final count: 0 new findings.**
