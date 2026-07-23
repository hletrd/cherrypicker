# Cycle 9 critic review

## Provenance and scope

- Specialist lens: critic — user-visible truthfulness, product semantics, failure communication, and whether displayed claims match the data actually measured.
- Review date: 2026-07-24.
- Reviewed commit: `c5c6eab9b421e547d66716e989e08c747cc36aa1`.
- Full tracked inventory: 2,232 files; manifest SHA-256 `47bfbcc36706291e34da2709db76b134184c2c99fe9c25151cc8ac12de83f0d1`.
- Active inventory excluding historical `.context` plan/review bodies: 1,153 files; manifest SHA-256 `593f6630e814f550d7db85b63685c91a3056e0abf7aedce18e82ede9ba5377e8`.

## Repository inventory and product coverage

The review inventoried and inspected all tracked product/configuration/test/documentation families: 166 web files, 38 core files, 85 parser files, 733 rules files, 14 visualization files, 28 CLI files, 35 scraper files, 19 scripts, 16 E2E files, and 19 root/policy/workflow/vendor/other files. This includes 190 source files, 161 tests/specifications/fixtures, 29 current documentation files, 24 configuration/CI files, all 683 card-rule YAML files and 42 other domain/generated data artifacts, plus the root manifests and lockfile.

Product journeys checked end to end:

- Upload, parser warnings, month selection, prior-spending disclosure, optimization, dashboard review/reoptimization, results, and report.
- Card catalog/list/detail navigation and publication identity.
- CLI analyze/optimize/report disclosures and standalone report output.
- Scraper consent/network/write behavior and authored-rule validation.
- README/help claims, generated catalog statistics, accessibility/navigation states, persistence degradation, and empty/error states.

Declarative and generated families were evaluated exhaustively through schema/publication/verification gates. Historical review bodies, build products, dependencies, caches, and `.git` were not used as current product source.

Verification:

- `bun run lint`, `bun run typecheck`, and `bun run test` all passed.
- Astro type checking reported 0 errors, 0 warnings, and 0 hints.
- The root script suite reported 69 passing tests.
- No browser/E2E run was performed by this lens.

## Finding

### C9-CT-01 — “Spending by category” is actually “reward-assigned spending by category”

- Severity: Medium
- Confidence: High
- Classification: Confirmed
- Exact region:
  - `apps/web/src/components/dashboard/SpendingSummary.svelte:70-73`
  - `apps/web/src/components/dashboard/SpendingSummary.svelte:137-168`
  - `apps/web/src/components/dashboard/CategoryBreakdown.svelte:118-172`
  - `apps/web/src/components/dashboard/CategoryBreakdown.svelte:197-203`
  - `apps/web/src/components/dashboard/CategoryBreakdown.svelte:269-304`
  - `packages/core/src/optimizer/greedy.ts:350-388`
  - `packages/core/src/optimizer/greedy.ts:432-445`

Failure scenario:

The optimizer intentionally leaves any transaction with no positive calculable reward unassigned. The dashboard's category chart and “top spending category” do not read categorized transactions; they read only optimizer assignments:

- In a mixed result, unassigned spending disappears from the category chart and the remaining assigned subset is renormalized to 100%. The tooltip nevertheless labels that denominator “전체 지출 비중” (“share of total spending”).
- If every transaction is unassigned, the summary shows a real positive latest-month total and transaction count plus an unassigned-spending warning, while the “top spending category” becomes `-` and the adjacent category panel says there is no analyzed history and asks the user to upload a statement.

For example, with 10,000 won of dining spending that earns a benefit and 90,000 won of grocery spending that earns none, the dashboard presents dining as 100% of category spending and as the top spending category even though grocery is the true 90% top category.

Rationale:

Reward assignment and spending classification answer different questions. An assignment is a recommendation output whose membership depends on the selected card catalog, prior-spending tier, supported rule set, and whether reward is greater than zero. Category spending is an input fact and should not change when the user selects a different card set. The current UI makes a recommendation artifact look like an objective spending analysis, undermining the main product promise even though a separate warning discloses the aggregate unassigned amount.

This also creates inconsistent product surfaces: the standalone CLI HTML report builds its category table directly from categorized transactions, while the web dashboard derives it from assignments.

Suggested fix:

Add a canonical latest-month category aggregate to `AnalysisResult`, computed from positive categorized transactions before optimization and retained in the compact persisted projection. Use it for:

- The “top spending category” tile.
- Category amounts and percentages.
- The category empty state.

Keep assignments exclusively for the recommendation map. If only a truncated snapshot without a trustworthy category aggregate is available, show a specific “category details were not retained” state rather than claiming no analysis exists. Add component/domain tests for both mixed and all-unassigned results, asserting that category totals equal `optimization.totalSpending` and do not change when the selected cards change.

## Final missed-issue sweep

The closing product pass compared labels and disclosures with their data sources across upload, dashboard, results, web report, CLI output, standalone report, card catalog, and persistence warning states. Annual-fee/gross-reward wording, prior-month provenance, unsupported-rule notices, unassigned-benefit notices, navigation, and partial-parse warnings remained consistent after the recent fixes. No additional user-facing claim was reported without a concrete current mismatch.

Findings: 1 total — 1 Medium.
