# Review–Plan–Fix Cycle 6 — Debugger

- Date: 2026-07-24
- Baseline: `449f10a2faffaae2a2c47036070b0e61a5b6eec2`
- Lens: latent defects, error paths, stateful interactions, data integrity, regression risk, and test adequacy
- Scope: review only; no product source, tests, plans, generated artifacts, or protected Cycle 42 evidence changed

## Inventory and coverage

I classified all 2,151 tracked paths: 1,028 context/plan/review files, 147 web
files, 865 package files, 59 tool files, 18 scripts, 15 E2E files, and 19
root/config/vendor/instruction files. This includes 309 implementation files,
145 test paths, 683 card-rule YAML files, and 30 generated JSON/CSV artifacts.
Every review-relevant path was included in the inventory and source/search
pass.

I read the repository instructions and manifests, then followed success,
failure, empty, cancellation, stale-result, overflow, cap, serialization, and
partial-data paths through parser → categorizer → calculator → optimizer →
web/CLI/report output; catalog authoring → validation → artifact generation →
consumers; scraper extraction → validation → persistence; and browser workers
→ state ownership → persistence. High-volume authored/generated data was
covered through the complete schema, semantic-validation, publication, and
artifact gates. Comments and tests were checked against the current
implementation rather than accepted as proof. Existing Cycle 6 provenance was
consulted only to remove duplicates after the independent pass.

## Finding

### RPF6-DBG-001 — grouped alternative rewards repeatedly spend a losing card's unused cap

- **Severity:** Medium
- **Confidence:** High
- **Status:** Confirmed
- **Code regions:**
  - `packages/core/src/optimizer/greedy.ts:66-118`
  - `packages/core/src/optimizer/greedy.ts:137-210`
  - `packages/core/src/optimizer/greedy.ts:310-366`
- **Test gap:** `packages/core/__tests__/optimizer.test.ts:196-204`

Every card's marginal score is calculated against the transactions actually
assigned to that card. When a candidate loses a transaction, that transaction
is not added to the candidate's state. The next transaction therefore scores
the same losing card as though its monthly, global, use-count, or per-day cap
were still wholly unused. `buildAssignments()` subsequently groups the chosen
transactions by category and winning card, sums those independent losing-card
scores, and presents the total as one alternative reward and effective rate.

**Failure scenario:** two dining transactions are won by an uncapped 20% card.
The displayed alternative is a 10% card with a 100-won monthly cap. Each
transaction independently gives that losing card a 100-won score because its
actual assigned list remains empty. The grouped alternative is therefore
reported as 200 won, even though assigning both displayed group transactions
to that card can earn only 100 won. The same overstatement can occur for
global caps, `maxUses`, and fixed-per-day rewards. Existing optimizer coverage
only asserts that an alternative entry exists; it does not verify aggregate
reward correctness under stateful limits.

**Suggested fix:** calculate each grouped alternative as a counterfactual
marginal delta: start with the candidate card's final actually assigned
transactions, calculate its current reward, then calculate the reward after
adding the whole displayed transaction group once. Do not sum per-transaction
scores that were each computed from an unchanged candidate state. Add
regressions for monthly and global caps, use counts, fixed-per-day rewards, and
an alternative that already won transactions in another category.

## Verification

- Focused optimizer, CLI output/consent, and scraper writer suites: **88 passed,
  0 failed** across four test files. The optimizer suite's only grouped
  alternative assertion checks array membership/length, so it does not
  exercise capped aggregate rewards.
- `bun run data:check`: **passed** for all 683 authored rules, generated
  artifacts, category fallback, and README catalog.
- No browser or E2E run was performed, per review constraints.

## Final missed-issue sweep

The bounded final pass revisited accumulator ownership, grouped-report
semantics, cap rollback, duplicate IDs, empty and partial parse success,
filesystem cleanup, async cancellation, stale worker/UI state, malformed
storage, and generated-artifact consumers. Previously reported Cycle 6
findings were excluded. No second new, non-duplicate debugger defect met the
evidence threshold.

Final count: **1 Medium finding**, confirmed with High confidence.
