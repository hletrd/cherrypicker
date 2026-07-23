# Review-plan-fix Cycle 10 — document specialist

- Date: 2026-07-24
- Reviewed commit: `56c0f1fcd5b670b20cd972556199f37e3f382d8d`
- Branch: `codex/review-plan-fix-no-deploy-20260723`
- Disposition: **changes requested**
- Final count: **1 Medium finding**

## Inventory and review method

I inventoried all 2,252 tracked paths and treated the 1,124 tracked Markdown
files as documentation or review provenance. The current product-documentation
surface is the root README, `.claude/AGENTS.md`, `.claude/CLAUDE.md`, the
vendored SheetJS README, 24 issuer READMEs, and the license. I traced those
documents through package scripts, CLI and scraper parsers, schema and
publication contracts, generated catalogs, issuer-index generation, web/CLI
result renderers, workflow gates, and the behavior at the reviewed revision.

For duplicate control, I indexed the historical `.context` ledger, read the
Cycle 9 aggregate and documentation report, Plans 114–119, the protected Cycle
42 reports, and every available same-cycle specialist report. Cycle 9's
CI-equivalence wording and catalog-versus-optimizer eligibility findings are
closed at this revision and are not repeated here. The finding below is also
distinct from C14-09's rate-normalization question and Cycle 2's explicitly
unit-tagged Samsung mileage rules; the distinction is documented with the
finding.

## RPF10-DOC-001 — unitless mileage rewards are ranked and displayed as won without a valuation contract

- **Severity:** Medium
- **Confidence:** High
- **Status:** Confirmed; genuinely new documentation/code-contract mismatch
- **Authoritative benefit source:**
  `packages/rules/data/cards/samsung/and-mileage-platinum.yaml:28-42`
- **Contradictory fail-closed source:**
  `packages/rules/data/cards/samsung/and-mileage-platinum.yaml:43-59`
- **Schema and publication boundary:**
  `packages/rules/src/schema.ts:5,68-75,102-110`;
  `packages/rules/src/catalog-validation.ts:325-341`;
  `packages/rules/__tests__/catalog-validation.test.ts:448-480`
- **Calculation and result contract:**
  `packages/core/src/calculator/reward.ts:822-847,943-1011`;
  `packages/core/src/models/result.ts:1-6`;
  `packages/core/src/optimizer/greedy.ts:550-603`
- **Public documentation and output consumers:**
  `README.md:21-25,31-34`;
  `packages/rules/data/cards/samsung/README.md:15,33,102`;
  `apps/web/src/lib/analysis-disclosures.ts:4-5`;
  `apps/web/src/lib/formatters.ts:7-11`;
  `apps/web/src/components/dashboard/SavingsComparison.svelte:192-216`;
  `packages/viz/src/reward-disclosure.ts:1-5`;
  `packages/viz/src/terminal/comparison.ts:10-70`;
  `packages/viz/src/report/generator.ts:117-121,252-290`

The authoritative Samsung rule labels its supported base benefit
“1 mile per 1,000 won,” declares `type: mileage`, and stores `rate: 0.1`
without a unit. Because a missing unit is normalized to `null`, the schema
derives a generic percentage value and catalog validation accepts the rule as
executable. The same card's special “2 miles per 1,000 won” rules carry
`unit: miles` and are explicitly unsupported because “mileage reward valuation
contract is not modeled.” The catalog test even asserts that the base rule is
supported while the five unit-tagged rules fail closed.

The calculator does not convert mileage to money. It computes every unitless
percentage reward as `floor(transaction amount × rate / 100)`, accumulates the
result with cashback and discounts, and returns one scalar whose type contract
calls it the “Total Won value of rewards.” The optimizer ranks cards, computes
an effective rate, and calculates single-card savings from that mixed scalar.
Every public renderer then appends `원` and describes the result only as gross
monthly rewards before annual fees; no current README, disclosure, schema
field, or report states a miles-to-won assumption.

A read-only production-code probe loaded the Samsung card and evaluated one
uncategorized domestic KRW 100,000 transaction:

```text
label="국내외 가맹점 기본 적립 (1000원당 1마일)"
authoredType="mileage"
authoredRate=0.1
totalReward=100
rewardType="mileage"
reward=100
unsupportedRules=[]
```

The authored promise is 100 miles, but the dashboard, terminal, and HTML report
render that scalar as `100원` and compare it directly with monetary cashback
and discounts. A catalog-wide read-only sweep found 27 supported
`type: mileage` rules across 17 cards, so this is not an isolated record.

Concrete failure scenario: a user uploads ₩100,000 of eligible Samsung-card
spending. CherryPicker reports ₩100 of monthly benefit and uses a 0.1% monetary
return when ranking the card, even though the source rule promises 100 miles.
Unless one mile is deliberately valued at exactly ₩1, the amount and card
ordering are wrong. If that valuation is deliberate, it is still hidden and
contradicts the adjacent statement that mileage valuation is not modeled.

This is not a duplicate of C14-09. That review questioned percentage
normalization and was closed by historical commit `0000000e0d`, whose internal
comment claimed mileage rates were won-equivalent percentages and illustrated
approximately ₩15 per mile. The current code no longer contains that comment,
the public surfaces never acquired the assumption, and the current
`1 mile / ₩1,000` value of `0.1` produces an implicit ₩1 per mile rather than
the historical example's valuation. It is also not Cycle 2's finding: that
finding covered five `unit: miles` rules that the calculator rejected and that
are now correctly marked unsupported. This finding covers the 27 unitless
mileage rules that still cross the monetary result boundary.

**Recommended fix:**

1. Define an explicit, program-aware valuation contract and preserve both raw
   mileage and monetary equivalent in result types. Only the explicit monetary
   value may feed optimizer comparisons, effective rates, savings, or
   `formatWon`.
2. Until that contract exists, fail closed for every mileage-denominated rule,
   including `type: mileage` with `unit: null`, consistent with the existing
   special-rule policy. Do not infer a monetary percentage from a missing unit.
3. If a fixed valuation is intentionally adopted, encode it in schema/data,
   validate it during publication, and disclose it in the root README, web,
   terminal, and HTML report. Regenerate issuer eligibility statuses after any
   rules are made catalog-only.
4. Add cross-unit optimizer tests and public-renderer tests proving raw miles
   are never formatted as won or compared with cash without conversion.

## Verification and final missed-issue sweep

The following non-browser checks passed at the reviewed revision:

```text
bun run docs:check
683 cards, 566 optimizer-executable, 24 issuers

bun run data:check
683 card YAML files parsed; generated JSON and documentation current

bun run toolchain:check
Bun 1.3.12

bun run dependencies:check
dependency policy valid
```

Forty-seven focused README-generation, workflow-consistency, CLI-help, option,
and scraper-argument tests passed with zero failures. Rendered root, analyze,
optimize, report, and scraper help agreed with their parsers and defaults. A
read-only link/count/schema-reference sweep found no broken local links,
issuer-count drift, or stale hand-written YAML references. License,
toolchain, supported-format, remote-LLM consent, scraper credential, generated
catalog, eligibility, and CI/E2E wording all reconciled with current behavior.
No second non-duplicate documentation mismatch met the evidence threshold.

No browser/E2E run, source/test/plan/generated-document edit, staging, commit,
push, or deployment was performed.
