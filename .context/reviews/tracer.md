# Tracer — Current-State Data-Flow Review

**Reviewer:** tracer
**Date:** 2026-07-23
**Baseline:** working tree based on `e6fe49b` (including pre-existing local edits)
**Scope:** cross-file data propagation from input/catalog generation through parsing, categorization, optimization, persistence, and rendering

## Summary

| ID | Severity | Confidence | Status | Trace |
|---|---|---|---|---|
| TR-01 | High | High | Confirmed | General-spend YAML → categorized merchant → no rule match → zero base reward |
| TR-02 | High | High | Confirmed | Rich benefit prose → permissive schema → single-rule selector → wrong schedule |
| TR-03 | High | High | Confirmed | Signed PDF token → unsigned capture → positive transaction → inflated optimization |
| TR-04 | Medium | High | Confirmed | Header mismatch correction → stale cached amount → partial structured result → missing row |
| TR-05 | Medium | High | Confirmed | Multi-month analysis → reoptimization → latest/full metadata collapse |
| TR-06 | High | High | Confirmed trust-boundary path | Remote page → LLM card ID → schema → filesystem traversal |

## TR-01 — General-spend rewards disappear after merchant categorization

**Severity:** High
**Confidence:** High
**Status:** Confirmed

**Trace:**

```text
card YAML (`category: uncategorized`, label says all merchants)
  → build-json preserves category
  → cards.json / cards.ts preserve category
  → analyzer MerchantMatcher assigns a known category/subcategory
  → reward.findRule requires exact category or `*`
  → calculateRewards returns zero
  → greedy optimizer undervalues the card
```

**Regions:**

1. `packages/rules/data/cards/sc/zero-edition3-discount.yaml:22-30` authors an all-merchant 0.8% reward as `uncategorized`.
2. `scripts/build-json.ts:224-268,381-428` validates/copies that value.
3. `apps/web/src/lib/cards.ts:135-157` casts public JSON; `apps/web/src/lib/analyzer.ts:60-80` preserves reward categories.
4. `apps/web/src/lib/analyzer.ts:143-158` calls `MerchantMatcher`; `packages/core/src/categorizer/matcher.ts:61-105` maps Starbucks to `dining.cafe`.
5. `packages/core/src/calculator/reward.ts:67-82` matches only `rule.category === tx.category` or `*`.
6. `packages/core/src/optimizer/greedy.ts:39-70,216-244` converts the resulting zero into a card score/assignment.

**Observed reproduction:** The real card rule returns 800 Won for a 100,000-Won `uncategorized` transaction and 0 Won for the same `dining.cafe` transaction. The catalog audit found 208 explicitly general-spend `uncategorized` rules across 202 files and no production wildcard rule.

**Competing hypothesis:** `uncategorized` might intentionally mean fallback/base scope. The implementation disproves that hypothesis because it has a distinct wildcard syntax and never falls back from a known category to `uncategorized`.

**Fix/validation:** Migrate audited base rules to `*`, add structured geographic/channel scope where necessary, and add an integration test that starts with merchant text, runs `MerchantMatcher`, and calculates a real all-merchant card's reward.

## TR-02 — Benefit conditions are preserved as prose but discarded at evaluation

**Severity:** High
**Confidence:** High
**Status:** Confirmed

**Trace:**

```text
YAML label/note describes day, time, amount band, count, or bonus
  → Zod `.passthrough()` accepts it
  → build artifact preserves it
  → ruleConditionsMatch evaluates only minTransaction/specificMerchants
  → findRule returns one highest-specificity candidate
  → later duplicate schedules are unreachable or never stacked
```

**Regions:**

- `packages/rules/src/schema.ts:26-39`
- `packages/core/src/calculator/reward.ts:42-95,226-300`
- `packages/rules/data/cards/cu/eobuba-check.yaml:22-86`
- `packages/rules/data/cards/shinhan/point-plan-plus.yaml:31-71`

**Observed corpus shape:** 91 duplicate category/subcategory groups occur in 90 card files. Forty-three groups have identical runtime predicates; 40 of those have different reward schedules. This is a lower bound on definitely ambiguous groups, not merely a count of stylistic duplicates.

**Concrete trace:** Point Plan+ supplies five uncategorized amount bands. All have equal runtime specificity and no executable range, so stable index ordering selects the first 0.7% rule for every matching amount, including 1,000,000 Won and above.

**Fix/validation:** Add executable min/max amount, day/time, transaction count, payment channel, geography, user-choice, exclusive-group, stacking, and priority fields. Fail generation on duplicate rules that are indistinguishable to the evaluator. Add a table-driven catalog contract test for every duplicate group.

## TR-03 — Two negative PDF formats become positive optimizer inputs

**Severity:** High
**Confidence:** High
**Status:** Confirmed

**Trace:**

```text
PDF fallback line `(10,000)` or `마이너스10,000`
  → regex matches the negative form
  → capture chain selects digits only (`10,000`)
  → parseAmount returns +10000
  → `amount > 0` appends RawTransaction
  → analyzer counts it as spending
  → optimizer rewards it as a purchase
```

**Regions:**

- Server: `packages/parser/src/pdf/index.ts:301-314,335-382`
- Browser: `apps/web/src/lib/parser/pdf.ts:520-542,565-600`
- Downstream accumulation: `apps/web/src/lib/analyzer.ts:381-428`

Fullwidth-minus and trailing-minus captures retain the sign, making the defect notation-dependent. Both parser copies have the same defect.

**Why tests did not stop it:** `packages/parser/__tests__/table-parser.test.ts:456-490,685-739` and `apps/web/__tests__/parser-pdf.test.ts:10-74` duplicate the regex and assert capture groups rather than invoking the production scanner. The targeted 167-test batch passes while a direct production-function probe parses the stripped capture as positive.

**Fix/validation:** Extract a shared production helper that returns a signed token/amount. Exercise the helper or actual parser with every supported refund notation, and assert that no refund is present in the returned positive-spending transactions.

## TR-04 — Corrected PDF indices do not correct cached values

**Severity:** Medium
**Confidence:** High
**Status:** Confirmed

**Trace:**

```text
header supplies dateIdx/amountIdx
  → code reads dateValue/amountValue
  → per-row heuristic discovers shifted indices
  → code updates indices only
  → amount parses from the pre-correction cell
  → row is skipped or misparsed
  → any other successful row causes early structured return
  → line fallback never recovers the skipped row
```

**Regions:**

- `packages/parser/src/pdf/index.ts:106-127,193-206,286-295`
- `apps/web/src/lib/parser/pdf.ts:307-323,386-403,509-518`

**Failure scenario:** One row has an extra leading sequence column. The date and amount finders locate the real cells, but the amount parser still receives the old merchant/category cell. If at least one normal row parsed, the function returns a plausible but incomplete statement.

**Fix/validation:** Move cell reads after index reconciliation. Test a single extracted table containing both aligned and shifted rows, and assert exact row count, dates, merchants, and amounts.

## TR-05 — Reoptimization collapses two metadata scopes

**Severity:** Medium
**Confidence:** High
**Status:** Confirmed

**Trace:**

```text
analyzeMultipleFiles:
  latestTransactions → statementPeriod/transactionCount
  allTransactions    → fullStatementPeriod/totalTransactionCount

user edits a category
  → store.reoptimize filters latestTransactions for optimization
  → metadata is recomputed only from all editedTransactions
  → both latest and full fields receive all-month values
  → dashboard/report show a period/count inconsistent with reward totals
```

**Regions:**

- Contract: `apps/web/src/lib/store.svelte.ts:68-81`
- Initial split: `apps/web/src/lib/analyzer.ts:421-479`
- Reoptimization: `apps/web/src/lib/store.svelte.ts:547-554,620-650`
- Consumers: `apps/web/src/components/dashboard/SpendingSummary.svelte:89-101`; `apps/web/src/components/report/ReportContent.svelte:8-23`

**Fix/validation:** Compute primary metadata from `latestTransactions` and full metadata from `editedTransactions`. Drive a two-month result through the actual store method and assert the scopes remain distinct before and after an edit.

## TR-06 — Remote content controls the scraper's write destination

**Severity:** High
**Confidence:** High
**Status:** Confirmed trust-boundary path

**Trace:**

```text
remote HTML
  → cleanHTML
  → page text inserted in LLM user message
  → tool response supplies card.id/card.issuer
  → runtime Zod accepts unrestricted strings
  → writer joins them into an output path
  → writeFile follows `..` outside the intended root
```

**Regions:**

- `tools/scraper/src/cli.ts:88-114`
- `tools/scraper/src/extractor.ts:23-31,52-61`
- `packages/rules/src/schema.ts:41-57`
- `tools/scraper/src/writer.ts:10-17,44`

**Observed validation:** A traversal card ID passes the canonical schema, and resolving the writer's constructed path shows it outside `packages/rules/data/cards`.

**Fix/validation:** Treat filesystem coordinates as local policy, never model output: enforce an ID slug, require issuer equality to the CLI target, resolve and verify containment, and require an explicit overwrite flag. Test the full validator/writer boundary in a temporary root.

## Coverage closeout

The trace sweep followed uploaded statement data, catalog YAML/build output, browser card loading, categorization, reward calculation, greedy assignment, persistence, rendering, scraper networking, and scraper writes. It also inspected tests and deployment configuration for places where a broken path could be masked. No browser or E2E process was launched.
