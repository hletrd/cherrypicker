# Critic — Current-State Review

**Reviewer:** critic
**Date:** 2026-07-23
**Baseline:** working tree based on `e6fe49b` (including pre-existing local edits)
**Scope:** product correctness, domain-model honesty, failure semantics, duplicated implementation/test strategy, and state contracts

## Summary

| ID | Severity | Confidence | Status | Finding |
|---|---|---|---|---|
| CRIT-01 | High | High | Confirmed | “All merchants” rewards are modeled as `uncategorized`, suppressing base rewards on categorized purchases |
| CRIT-02 | High | High | Confirmed | The rule model cannot express many authored conditions or stacking, so duplicate rules collapse to one |
| CRIT-03 | High | High | Confirmed | PDF fallback turns two refund notations into positive spending while tests certify only regex fragments |
| CRIT-04 | Medium | High | Confirmed | Structured PDF per-row fallback updates indices after caching the old amount/date cells |
| CRIT-05 | Medium | High | Confirmed | `won_per_liter` is presented as a precise reward but is calculated once per transaction |
| CRIT-06 | Medium | High | Confirmed | `reoptimize()` breaks the documented latest-month metadata contract |

The central problem is not another edge-case parser: the catalog vocabulary, runtime evaluator, and tests disagree on what several core fields mean. Multiple earlier reviews marked behavior “fixed” after making it deterministic, but deterministic selection of the wrong semantic rule is still wrong.

## CRIT-01 — `uncategorized` is being used as “all merchants”

**Severity:** High
**Confidence:** High
**Status:** Confirmed
**Files/regions:**

- `packages/rules/data/cards/sc/zero-edition3-discount.yaml:22-30`
- `packages/rules/data/cards/shinhan/simple-plan.yaml` (general-spend fixture)
- `packages/core/src/categorizer/matcher.ts:61-123`
- `packages/core/src/calculator/reward.ts:67-82`
- `packages/core/__tests__/calculator.test.ts:14,107-118`
- `packages/core/__tests__/optimizer.test.ts:266-276`

**Evidence:** Across the 683 YAML files:

- 375 cards contain 401 `uncategorized` reward rules.
- 202 files contain 208 such rules whose label/note explicitly says “전 가맹점,” “국내외 가맹점,” “국내 가맹점,” “해외 가맹점,” or “기본 적립/할인/캐시백.”
- Zero production rules use the calculator's actual wildcard category, `*`.

`MerchantMatcher` categorizes known merchants, while `findRule()` only accepts an exact category or `*`. A read-only reproduction with `sc-zero-edition3-discount` produced 800 Won for a 100,000-Won `uncategorized` transaction and 0 Won for the same transaction categorized as `dining.cafe`. The card's only rule is labeled “전 가맹점 0.8% 할인.”

Tests reinforce the faulty model: they construct `uncategorized` transactions for a general-spend card and explicitly assert that a dining purchase receives zero.

**Failure scenario:** A Starbucks transaction becomes `dining.cafe`, so a card promising 0.8% at every merchant receives no base reward. The optimizer systematically undervalues that card and can recommend a worse portfolio.

**Fix:** Audit and migrate genuine general-spend rules to `category: '*'`. Introduce structured scope for domestic/overseas and other qualifiers that a wildcard alone cannot represent. Add a build-time lint rejecting `uncategorized` rules whose label/note claims general merchant coverage, and add integration tests that pass real merchant matching output into real catalog rules.

## CRIT-02 — Duplicate rules encode semantics the evaluator cannot represent

**Severity:** High
**Confidence:** High
**Status:** Confirmed
**Files/regions:**

- `packages/rules/src/schema.ts:26-39`
- `packages/core/src/calculator/reward.ts:42-95,226-300`
- `packages/rules/data/cards/cu/eobuba-check.yaml:22-86`
- `packages/rules/data/cards/shinhan/point-plan-plus.yaml:31-71`
- `packages/rules/data/cards/hana/daltal-sweet.yaml` (`dining` rules)
- `packages/rules/data/cards/samsung/id-simple.yaml:22-38`

**Evidence:** The catalog contains 91 duplicate `(category, subcategory)` groups across 90 files, encompassing 197 rules. Forty-three groups have identical predicates as understood by the runtime, and 40 of those produce different reward schedules. The runtime understands only `minTransaction` and `specificMerchants`; the schema `.passthrough()` accepts other authored concepts without implementing them. `findRule()` then sorts candidates and returns exactly one.

Examples:

- `cu/eobuba-check`: Tuesday 10% versus other weekdays 5%; day/count/minimum-spend semantics live only in notes.
- `shinhan/point-plan-plus`: five amount bands from 0.7% to 3.0%, but none has a machine-readable maximum/minimum range; the first rule always wins.
- `samsung/id-simple`: below/above 100,000 Won schedules share the same key; `perTransactionCap: 99999` caps reward, not transaction eligibility.
- Several rules are additive (“base reward” plus “weekend bonus”), but returning one candidate makes stacking impossible.

The earlier specificity fix only made the winner deterministic. It did not make time ranges, day-of-week, transaction ranges, count limits, channel, geography, user selection, or additive bonuses evaluable.

**Failure scenario:** A 1,200,000-Won purchase on Point Plan+ is evaluated with the first 0.7% rule rather than 3.0%. A weekday CU purchase receives the Tuesday rate because the weekday note is ignored.

**Fix:** Define structured conditions for amount ranges, day/time, count, channel, geography, and selection; define exclusive groups versus additive rules and explicit priority; migrate the affected data; and make the build fail on indistinguishable duplicate rules rather than silently choosing one.

## CRIT-03 — Parenthesized and Korean-prefixed PDF refunds become purchases

**Severity:** High
**Confidence:** High
**Status:** Confirmed
**Files/regions:**

- `packages/parser/src/pdf/index.ts:301-314,335-371`
- `apps/web/src/lib/parser/pdf.ts:520-542,565-600`
- `packages/parser/__tests__/table-parser.test.ts:456-490,685-739`
- `apps/web/__tests__/parser-pdf.test.ts:10-74`

**Evidence:** The fallback regex captures only the digits inside `(10,000)` and `마이너스10,000`. The extraction chain passes that unsigned capture to `parseAmount()`, producing positive 10,000, and the `amount > 0` branch appends it. Fullwidth and trailing-minus alternatives retain their sign and behave correctly.

A direct probe of the production amount functions showed:

| Input token | Extracted `amountRaw` | Parsed result |
|---|---:|---:|
| `(10,000)` | `10,000` | `+10000` |
| `마이너스10,000원` | `10,000` | `+10000` |
| `10,000-` | `10,000-` | `-10000` |

The targeted 167-test parser batch passes because tests reconstruct the regex and assert that the capture is unsigned. They do not invoke the production fallback scanner and assert the final transaction set. The web test even reimplements `parseAmount()` locally.

**Failure scenario:** A statement contains a canceled 100,000-Won purchase in parentheses. The fallback scanner adds it as new spending, inflating totals, performance-tier inputs, and expected rewards.

**Fix:** Preserve the complete sign-bearing token (or reapply the marker based on the matched alternative) before parsing. Export a small production helper for fallback token extraction and test the actual helper/parser in both runtimes with positive, parenthesized, Korean-prefix, fullwidth-minus, and trailing-minus cases.

## CRIT-04 — Structured PDF fallback uses stale cell values

**Severity:** Medium
**Confidence:** High
**Status:** Confirmed
**Files/regions:**

- `packages/parser/src/pdf/index.ts:106-127,193-206`
- `apps/web/src/lib/parser/pdf.ts:307-323,386-403`

**Evidence:** Both implementations cache `dateValue` and `amountValue` from header-derived indices, then detect that the row layout differs and update `dateIdx`/`amountIdx`. The date is later parsed from the corrected index, but the amount is parsed from the old `amountValue`; the non-empty date guard also checks the old `dateValue`.

**Failure scenario:** The header is `[date, merchant, amount]`, while a transaction row has an extra leading cell. Per-row heuristics correctly relocate date and amount, but `parseAmount()` still receives the merchant cell. If other rows parsed, `parsePDF()` returns the partial structured result and never runs the line fallback for the dropped row.

**Fix:** Validate/adjust indices first, then derive all cell values. Add a mixed-layout integration fixture with one normal row and one shifted row so partial success cannot hide loss.

## CRIT-05 — `won_per_liter` fabricates a per-transaction value

**Severity:** Medium
**Confidence:** High
**Status:** Confirmed
**Files/regions:**

- `packages/core/src/calculator/reward.ts:148-182`
- `packages/core/src/models/transaction.ts:1-16`
- `packages/rules/data/cards/lotte/digiloca-auto.yaml:38-53`
- `packages/rules/data/cards/hana/1q-special-auto.yaml:28-42`
- `packages/core/__tests__/calculator.test.ts:690-700`

**Evidence:** There are 34 `won_per_liter` tiers in 17 card files. The transaction model has neither liters nor fuel unit price. Nevertheless, `calculateFixedReward()` returns the authored Won-per-liter value exactly once, regardless of transaction size, and the test canonizes 60 Won as the full reward.

**Failure scenario:** An 80-Won/L benefit returns 80 Won for both a small and full-tank purchase. For a 50-liter fill, the real discount would be 4,000 Won, so fuel cards are severely undervalued and recommendations can change.

**Fix:** Do not label a per-transaction constant as a calculated benefit. Either collect fuel volume, derive an explicitly labeled estimate from a configurable/reference unit price, or mark the unit unsupported and surface a warning/range. Tests should assert the chosen uncertainty semantics, not the current fiction.

## CRIT-06 — Reoptimization changes latest-month metadata into all-month metadata

**Severity:** Medium
**Confidence:** High
**Status:** Confirmed
**Files/regions:**

- `apps/web/src/lib/store.svelte.ts:68-81,547-554,620-650`
- `apps/web/src/lib/analyzer.ts:421-479`
- `apps/web/src/components/dashboard/SpendingSummary.svelte:89-101`
- `apps/web/src/components/report/ReportContent.svelte:8-23`

**Evidence:** `AnalysisResult` documents `statementPeriod` and `transactionCount` as optimized-month fields, with `fullStatementPeriod` and `totalTransactionCount` spanning all uploaded months. Initial analysis honors that split. `reoptimize()` correctly filters `latestTransactions` for optimization, then assigns both counts from `editedTransactions.length` and both periods from every edited date.

**Failure scenario:** A user uploads three months and corrects one category. Before the edit, the dashboard's primary count and report period describe the latest optimized month. After the edit, the same fields silently describe all three months while reward totals still cover only the latest month.

**Fix:** Derive primary count/period from `latestTransactions` and full count/period from `editedTransactions`. Add a real store-level regression test with two months and one reoptimization.

## Final critique

The final sweep covered the web app, core/parser/rules/viz packages, CLI/scraper, build scripts, deployment configuration, tests, and all card YAML. The most important corrective action is a domain-contract migration, not another tiebreaker: make catalog scope and eligibility executable, then test with real matcher output and real production parsing helpers.
