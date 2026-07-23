# Cycle 9 test-engineer review

## Provenance and scope

- Specialist lens: test-engineer — coverage gaps, false-positive assertions, mutation boundaries, flakiness risk, and regression/TDD opportunities.
- Review date: 2026-07-24.
- Reviewed commit: `c5c6eab9b421e547d66716e989e08c747cc36aa1`.
- Sorted tracked-manifest SHA-256: `47bfbcc36706291e34da2709db76b134184c2c99fe9c25151cc8ac12de83f0d1`.
- Active-manifest SHA-256 after excluding historical `.context/reviews` and `.context/plans` bodies: `593f6630e814f550d7db85b63685c91a3056e0abf7aedce18e82ede9ba5377e8`.
- Historical reports were checked only to avoid repeating repaired issues. The findings below are current gaps demonstrated against the reviewed tree.

## Repository inventory and test coverage

The complete tracked inventory contains 2,232 files: 190 source files, 161 tests/specifications/fixtures, 29 current documentation files, 24 configuration/CI files, 725 domain/generated data files, 3 asset/vendor files, 21 other tracked files, and 1,079 historical `.context` files.

All active test and product families were inventoried:

| Area | Product/config files | Tests/specs/fixtures |
| --- | ---: | ---: |
| `apps/web` | 113 | 53 |
| `packages/core` | 28 | 10 |
| `packages/parser` | 37 | 48 |
| `packages/rules` | 727 | 6 |
| `packages/viz` | 11 | 3 |
| `tools/cli` | 18 | 10 |
| `tools/scraper` | 24 | 11 |
| `scripts` | 11 | 8 |
| `e2e` | 4 support/fixture files | 12 specs/baselines |
| Root/policy/workflow/vendor/other | 19 | — |

The review read every test filename and configuration boundary, then traced assertions into the calculator, optimizer, persistence, browser state, UI components, CLI/scraper, publication scripts, and E2E harness. The 683 card YAML files and generated catalog artifacts were covered through their schema/catalog/publication tests and repository verification gates.

Verification at the reviewed commit:

- `bun run lint` — passed.
- `bun run typecheck` — passed; Astro reported 0 errors, 0 warnings, and 0 hints.
- `bun run test` — passed across every workspace; the root script suite reported 69 passing tests.
- No E2E suite was started by this lens.

## Findings

### C9-TE-01 — The merchant applicability suite checks diagnostics, not false-positive rewards

- Severity: Medium
- Confidence: High
- Classification: Confirmed
- Exact region:
  - `packages/core/__tests__/calculator.test.ts:1615-1702`
  - `packages/core/src/calculator/reward.ts:184-195`
  - `packages/core/src/calculator/reward.ts:395-408`

Failure scenario:

The catalog test named “unrelated merchant allowlists never emit catalog issues” feeds one sentinel merchant, but it only inspects `unsupportedRules`; it never asserts that the calculated reward is zero. The sentinel `__definitely_unrelated_merchant__` also avoids every short alias by construction. Positive coverage then verifies only mixed-case intended matches such as CGV and AliExpress.

Consequently, the current calculator rewards unrelated `SECURITY SERVICE`, `CULTURE CENTER`, and `CUBAN RESTAURANT` transactions under a real `CU` allowlist, while the entire merchant applicability block remains green.

Rationale:

This is a false-negative test design rather than merely missing branch coverage. The test's title claims non-applicability, but its oracle observes a side channel that supported rules do not populate. It therefore cannot detect the financial output error it purports to guard.

Suggested fix:

For every catalog rule with `specificMerchants`, assert both sides of the contract: intended aliases yield the expected reward and unrelated/near-collision merchants yield zero reward and no unsupported issue. Generate near-collisions for short Latin aliases (`CU`, `KT`, `SKT`) by embedding them inside longer tokens. Keep focused real-card cases so catalog data and matcher behavior are tested together.

### C9-TE-02 — Coherence mutation tests break one copy at a time and miss coordinated contradictions

- Severity: Medium
- Confidence: High
- Classification: Confirmed
- Exact region:
  - `apps/web/__tests__/analysis-result.test.ts:200-266`
  - `apps/web/__tests__/analysis-result.test.ts:269-376`
  - `apps/web/__tests__/store-persistence.test.ts:1085-1099`
  - `apps/web/src/lib/analysis-result.ts:136-283`
  - `apps/web/src/lib/analysis-result.ts:326-456`

Failure scenario:

The mutation table proves that independently corrupting an assignment or card-result field is rejected. For category consistency, it changes only `cardResults[].byCategory.category`, leaving the assignment unchanged; the validator catches the disagreement between two derived copies. It never changes both derived copies while leaving the canonical transaction unchanged.

Likewise, the unassigned-count test covers only the all-unassigned branch, and the truncation test asserts that the optimizer object round-trips unchanged without mutating the independently retained monthly breakdown.

Current executable counterexamples all return `true` or restore successfully:

```text
transaction=dining optimizer=grocery true
2 unassigned rows reported as 1 true
fabricated contradictory cap telemetry true
```

A truncated payload with latest monthly spending of 999,999 won and optimizer spending of 10,000 won is also accepted.

Rationale:

The tests mirror the validator's internal comparison graph, so they verify local balance rather than externally meaningful truth. Correlated mutation is the exact failure mode of stale writers, partial migrations, and duplicated derived state.

Suggested fix:

Build mutation tests from a canonical transaction fixture and apply paired/correlated changes:

- Relabel assignment and card category together.
- Preserve unassigned spending while under-counting mixed unassigned rows.
- Add contradictory `capsHit` and `capReached` telemetry.
- Mutate retained truncated monthly totals independently from optimizer totals.

Assert rejection through both `isAnalysisResultCoherent` and the public `deserializeAnalysis` boundary. Prefer property-based or table-driven invariant mutations so every duplicated fact has a canonical-source comparison.

### C9-TE-03 — The CategoryBreakdown E2E test explicitly asserts content from a different component

- Severity: Medium
- Confidence: High
- Classification: Confirmed
- Exact region:
  - `e2e/ui-ux-review.spec.js:344-353`
  - `apps/web/src/components/dashboard/CategoryBreakdown.svelte:118-172`
  - `apps/web/src/components/dashboard/CategoryBreakdown.svelte:197-203`
  - `apps/web/src/pages/dashboard.astro:96-109`

Failure scenario:

The test titled “shows category breakdown with bars” checks the page heading and then, by its own comment, accepts the `공과금` label rendered in `OptimalCardMap`. It neither scopes the assertion to the category-breakdown panel nor checks a bar, amount, percentage, total, or empty state.

The CategoryBreakdown implementation can therefore disappear, normalize only reward-assigned spending to 100%, or render the false “아직 분석한 내역이 없어요” all-unassigned state while this test continues to pass because the recommendation map still contains the label.

Rationale:

This is a confirmed cross-component false positive. The test suite reports coverage of a critical dashboard claim while observing a different component with duplicated text.

Suggested fix:

Give the CategoryBreakdown root and rows stable semantic/test identifiers, scope assertions under `data-testid="category-breakdown-panel"`, and assert the rendered amounts and percentages against categorized transaction totals. Add mixed and all-unassigned fixtures; category totals must equal latest-month positive spending and remain unchanged when card selection changes. Verify the true empty state separately.

## Final missed-issue sweep

The final sweep rechecked test names against their actual oracles, skipped/conditional tests, timing and process ownership, parser parity fixtures, mutation tests, catalog loops, web state restoration, UI selectors, CLI process tests, scraper network/write tests, publication drift gates, and workflow consistency. Existing green gates are broad and stable; the three reported gaps are places where assertions observe the wrong layer or mutate only the validator's own representation.

Findings: 3 total — 3 Medium.
