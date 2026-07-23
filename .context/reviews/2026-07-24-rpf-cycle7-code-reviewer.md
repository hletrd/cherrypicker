# Cycle 7 code-reviewer report

- Review date: 2026-07-24
- Reviewed HEAD: `3086a379e31e5b17f82401807f5b3c24325b9962`
- Branch: `codex/review-plan-fix-no-deploy-20260723`
- Lens: implementation correctness, parser behavior, public calculation APIs, and test coverage
- Findings: 2 (`2 Medium`)

## Inventory and coverage

I inventoried all 2,175 tracked paths: 1,045 historical/provenance files under
`.context`, 683 authored card YAML files, 30 generated catalog artifacts, and
417 active implementation, test, fixture, documentation, manifest, and
configuration files. The active inventory includes 196 implementation files
and 150 test/E2E paths across `apps/web`, `packages/core`, `packages/parser`,
`packages/rules`, `packages/viz`, `tools/cli`, `tools/scraper`, `scripts`, and
root configuration.

Every review-relevant file was included in the inventory and source/search
pass. Production calculator, parser, categorizer, optimizer, rules, web state,
CLI, scraper, visualization, and publication code received direct semantic
review. All 683 card files were parsed and semantically validated through the
catalog checks; generated payloads were checked against their publication
sources. Tests, fixtures, manifests, and documentation were inspected against
the runtime contracts they exercise.

Cross-file traces covered statement input through parsing, categorization,
reward calculation, optimization, persistence, web/CLI/report presentation,
and authored card/category data through validation and generated artifacts.

## Findings

### C7-CR-001 — Credit/refund columns are accepted as positive spending, and paired Debit/Credit files depend on header order

- Severity: **Medium**
- Confidence: **High**
- Classification: **confirmed**
- Primary regions:
  - `packages/parser/src/csv/column-matcher.ts:71-76`
  - `packages/parser/src/csv/generic.ts:132-151,227-264`
  - `packages/parser/src/xlsx/index.ts:201-210,247-267`
  - `packages/parser/src/shared/json.ts:34-41,91-121,152-169`
  - Browser mirrors: `apps/web/src/lib/parser/csv.ts:288-305,387-412` and
    `apps/web/src/lib/parser/xlsx.ts:356-365,402-422`

The shared amount-column pattern treats `debit`, `credit`, Korean refund
columns, and ordinary charge columns as interchangeable. Generic CSV and XLSX
then select the first matching header and read only that column. JSON similarly
places `debit` and `credit` in one ordered alias list without retaining the
field's direction.

Live reproductions at this HEAD:

```text
Date,Merchant,Credit,Debit
2026-07-01,Refund,5000,
2026-07-02,Purchase,,7000
```

produced only `Refund amount=5000`, with no diagnostic. Reversing the two
headers produced only `Purchase amount=7000`. JSON
`{"date":"2026-07-01","merchant":"Refund","credit":5000}` produced a positive
5,000원 spending transaction with no diagnostic.

Why it matters: a refund can increase spending and rewards, while a real
purchase in the other amount column disappears. The same logical statement
changes result merely by reordering its headers. This contradicts the parser's
normal policy of rejecting non-spending values and the direction-aware OFX
path at `packages/parser/src/ofx/index.ts:163-180`.

Concrete scenario: a bank export contains separate incoming `Credit` and
outgoing `Debit` columns. If `Credit` appears first, the optimizer sees refunds
as purchases and omits all actual debits, producing an invalid spending total
and recommendation.

Root fix:

- Model amount-column roles as directional rather than using one regex/alias
  bucket.
- Support paired Debit/Credit (and charge/refund) fields per row, accepting
  outgoing spending and rejecting or diagnosing incoming/refund values.
- Share the role-aware kernel across CSV, XLSX, JSON, and browser adapters.
- Add both header orders, credit-only JSON, and positive refund cases to
  server/browser conformance tests.

### C7-CR-002 — Exported percentage helpers still undercount fractional rates after the main calculator moved to exact arithmetic

- Severity: **Medium**
- Confidence: **High**
- Classification: **confirmed**
- Primary regions:
  - `packages/core/src/calculator/types.ts:61-103`
  - `packages/core/src/calculator/discount.ts:1-13`
  - `packages/core/src/calculator/points.ts:1-14`
  - `packages/core/src/calculator/cashback.ts:1-14`
  - Public exports: `packages/core/src/index.ts:51-59`
- Correct exact implementation for comparison:
  `packages/core/src/calculator/reward.ts:538-578`

`calculatePercentageReward()` documents a fractional rate such as `0.05`, but
computes `Math.floor(amount * rate)`. Its three public aliases therefore still
have the binary-floating-point bug removed from the main rule calculator.

Live reproduction:

```text
rate = 0.7 / 100 = 0.006999999999999999
calculateDiscount(10_000, rate, null, 0).reward = 69
calculatePoints(10_000, rate, null, 0).reward   = 69
calculateCashback(10_000, rate, null, 0).reward = 69
```

The mathematical result is 70원. There are no direct tests of these exported
helpers; Cycle 6 exact-arithmetic tests exercise only `calculateRewards()`.

Why it matters: callers choosing the advertised single-transaction helpers get
a different answer from the rule engine for the same percentage benefit. The
error can recur per transaction and alter cap accounting.

Concrete scenario: a workspace consumer calculates a 0.7% cashback using the
documented fractional-rate API and records 69원 for a 10,000원 purchase, while
the optimizer records 70원.

Root fix:

- Give the exported helpers the same checked decimal/rational arithmetic as the
  rule calculator and consolidate the two paths behind one implementation.
- Prefer an exact rate representation (percentage-point decimal with an
  explicit divisor, decimal string, or numerator/denominator) instead of
  accepting an already-noisy binary fraction without a precision contract.
- Add parity tests for 0.7%, 4.1%, capped totals, exact/non-exact products, and
  safe-integer boundaries.

## Verification

- `bun run verify` passed at the reviewed HEAD, including toolchain,
  migrations, dependency audit, 683-card data validation, lint/typecheck,
  package/script tests, web build, and bundle budget.
- Live read-only Bun reproductions confirmed both findings.
- No source, plan, protected Cycle 42 artifact, branch, commit, deployment, or
  external state was changed.

## Final missed-issue sweep

The final sweep rechecked parser server/browser parity, amount direction,
calculator numeric boundaries and exports, taxonomy/category matching,
optimizer state, persistence validation, CLI/report loading, scraper write and
network boundaries, TODO/type-escape/ignored-error sites, and current tests
against their claimed contracts. Fixed Cycle 6 findings and speculative
format/product assumptions were not re-reported.
