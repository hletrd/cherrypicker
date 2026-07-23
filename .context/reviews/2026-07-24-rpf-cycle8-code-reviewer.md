# Cycle 8 code-reviewer review

## Provenance and scope

- Specialist lens: code-reviewer — logic, quality, SOLID boundaries, and maintainability.
- Review date: 2026-07-24.
- Reviewed commit: `3fd993d471a8676170031f20715f6a53c99e8a9f`.
- This is a fresh review of the current tree. Historical `.context` material was inventoried as documentation/provenance, but was not used as a source of findings.

## Repository inventory and coverage

`git ls-files` reports 2,199 tracked files. The extension inventory contains 1,090 Markdown files, 685 YAML files, 293 TypeScript files, 59 JSON files, 14 Svelte files, 14 JavaScript files, 13 CSV fixtures, 6 Astro files, 5 HTML files, and 2 CSS files, plus small XML/OFX/QFX/image/archive families. A path-and-extension classification found 198 non-test code files and 155 test/fixture files under `apps`, `packages`, `tools`, `scripts`, and `e2e`; `packages/rules/data/cards` contains 683 card-rule YAML files.

The review covered:

- Web routes, Astro layout, Svelte components, browser parser/worker code, analysis state, persistence, catalog loading, and public scripts.
- Core calculator, categorizer, models, optimizer, and their tests.
- Parser package formats, shared kernels, adapters, fixtures, and conformance tests.
- Rules schemas, validators, loaders, generated publication inputs/outputs, and card data.
- CLI and scraper commands, option parsing, I/O boundaries, and tests.
- Viz package, root scripts, migrations, manifests, lock/toolchain policy, TypeScript/Astro/Vitest/Turbo configuration, GitHub workflow, README, E2E specifications, and `.context` documentation.
- Generated/cache/vendor families were inventoried and checked at their source/publication boundary rather than treated as independently authored runtime source.

Verification at the reviewed commit:

- `bun run lint` — passed.
- `bun run typecheck` — passed; Astro reported zero errors, warnings, or hints.
- `bun run test` — passed across all workspaces and root script tests.
- No browser or E2E suite was run, per the review constraint.

## Findings

### C8-CR-01 — Persisted analysis validation accepts semantically impossible results

- Severity: Medium
- Confidence: High
- Status: Confirmed
- Exact region:
  - `apps/web/src/lib/persistence.ts:186-303`
  - `apps/web/src/lib/persistence.ts:378-399`
  - `apps/web/src/lib/persistence.ts:573-684`
  - `apps/web/src/lib/persistence.ts:710-745`

Failure scenario:

A syntactically valid but stale, partially corrupted, or manually modified `sessionStorage` payload can claim one transaction count while carrying a different transaction list, claim arbitrary optimization totals unrelated to its assignments/card results, and carry monthly totals unrelated to either. `deserializeAnalysis` accepts the object and the dashboard restores mutually inconsistent financial results as if they were trustworthy.

Evidence:

- The validators check each field's primitive shape and numeric range, but do not check cross-field invariants. In particular, they do not reconcile transaction counts, monthly breakdown totals, assignment/card-result totals, `effectiveRate`, `savingsVsSingleCard`, or card/transaction references.
- After those independent checks, line 731 casts the entire optimization object into the application contract.
- A targeted reproduction started with `serializeAnalysis`, changed only `transactionCount`, `totalTransactionCount`, `optimization.totalReward`, `optimization.totalSpending`, and one `monthlyBreakdown` entry to unrelated nonnegative safe integers, then called `deserializeAnalysis`. It returned `data !== null`, `shouldRemove === false`, and preserved the impossible values (`transactionCount: 999999`, `totalReward: 888888`).
- This is a correctness/integrity defect, not a claim that browser storage is a security boundary.

Recommended fix:

Extract a pure `validateAnalysisResultCoherence` function and run it after migration but before accepting the restored result. It should use checked integer addition and verify, where the relevant data is present:

- Unique transaction and card identifiers and valid assignment references.
- Transaction counts and statement/month breakdown counts.
- Spending and reward sums across assignments, card results, and optimization totals.
- `effectiveRate` and per-category rates under an explicit rounding/tolerance rule.
- `savingsVsSingleCard === totalReward - bestSingleCard.totalReward`.

Reject and remove incoherent payloads just as corrupted payloads are handled now. Add table-driven tests that mutate one coherent field at a time so future schema additions cannot silently bypass the invariant layer.

### C8-CR-02 — The root CLI help advertises an option combination that the parser always rejects

- Severity: Low
- Confidence: High
- Status: Confirmed
- Exact region:
  - `tools/cli/src/index.ts:21-26`
  - `tools/cli/src/command-options.ts:330-337`

Failure scenario:

A user copies the documented example `cherrypicker optimize statement.csv --cards ./rules/`. Argument parsing fails before the statement or rule directory is used because `optimize` requires `--categories` and `--cards` to be supplied together.

Evidence:

- The root help prints the one-sided `--cards` example at `index.ts:24`.
- The shared option parser explicitly rejects exactly one of the two paths.
- Running the printed command exits with status 1 and reports: `optimize 명령에서 --categories와 --cards는 함께 지정해야 합니다.`
- The green unit suite covers command help and option behavior separately, but does not execute every root-help example against the parser contract.

Recommended fix:

Change the example to include both inputs, for example:

`cherrypicker optimize statement.csv --categories ./categories.yaml --cards ./rules/`

Then add a small contract test that extracts or centrally defines root-help examples and verifies that each reaches the intended command parser without an option-contract error. Keeping examples beside typed option definitions would reduce future drift.

## Final missed-area sweep

After the primary pass, the review rechecked error/cast boundaries, TODO/FIXME markers, generated catalog publication, optimizer eligibility, browser navigation state, parser parity tests, storage restoration, CLI examples, and representative test gaps. The sweep found no additional code-quality issue with enough current evidence to report. Findings: 2 total — 1 Medium, 1 Low.
