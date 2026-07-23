# Verifier Review — Cycle 1

**Reviewer:** verifier
**Date:** 2026-07-23
**Scope:** End-to-end correctness claims, catalog/runtime contracts, current dirty edits, and user-visible result semantics
**Result:** 9 findings: 7 High, 2 Medium

## Findings

### VER-01 — Parent-category rewards are rejected for normally subcategorized transactions

- **Severity:** High
- **Confidence:** 0.99
- **Status:** Confirmed by code inspection, catalog scan, existing test semantics, and a focused execution
- **Locations:** `packages/core/src/calculator/reward.ts:67-82`; `packages/core/src/categorizer/matcher.ts:61-106`; `packages/core/__tests__/calculator.test.ts:627-662`; `packages/rules/data/cards/bc/baro-on-off.yaml:49-61`

`findRule()` explicitly rejects a parent rule whenever the transaction has a subcategory (`reward.ts:81`). The categorizer normally emits both a parent and child, for example `dining.cafe`, while much of the catalog intentionally authors a broad `dining` rule. A semantic scan of all 683 card files found 1,181 broad rules in parent categories with children, spanning 567 cards. The existing inverse test treats the rejection as desired behavior, but that assumption contradicts catalog labels such as “음식점/커피 10% 할인.”

**Failure scenario:** A Starbucks transaction is categorized as `{ category: "dining", subcategory: "cafe" }`. The broad `dining` rule on `baro-on-off` returns zero reward; a focused calculator run reproduced that result.

**Fix:** Let a matching parent rule remain a candidate for child transactions. Keep child rules more specific so they win when present. Replace the inverse test with regressions for parent fallback, child override, and wildcard fallback.

### VER-02 — The card catalog contains runtime-unreachable category IDs, and generation only warns

- **Severity:** High
- **Confidence:** 0.99
- **Status:** Confirmed by full-catalog semantic scan
- **Locations:** `packages/rules/src/schema.ts:32-39`; `scripts/build-json.ts:246-250`; `scripts/build-json.ts:291-293`; `packages/rules/data/categories.yaml:2-24`; `packages/rules/data/categories.yaml:154-183`; `packages/rules/data/cards/samsung/k-pass-samsung.yaml:40-47`; `packages/rules/data/cards/samsung/id-energy.yaml:35-95`; `packages/core/src/calculator/reward.ts:69-71`

The schema accepts any category string. The generator recognizes unknown top-level IDs but records them as warnings, then exits successfully because only schema errors are fatal. The catalog currently has 90 such reward rules across 69 cards. Fifty-seven use a leaf ID such as `cafe`, `fuel`, `parking`, or `toll` as a top-level category; the remainder use IDs absent from the taxonomy. Runtime matching is exact, so these benefits cannot match canonically categorized transactions.

**Failure scenario:** `k-pass-samsung` authors `category: cafe`, but Starbucks becomes `dining.cafe`; the 20% rule is never selected. `id-energy` has the same defect for `transportation.fuel`, `.parking`, and `.toll`.

**Fix:** Add a taxonomy-aware cross-file validator that requires either a canonical parent category or a canonical `(category, subcategory)` pair, make violations fatal in generation/CI, migrate the 90 rules, and add a reachability test over every catalog reward.

### VER-03 — Scraped percentage rates are 100× smaller than the calculator contract

- **Severity:** High
- **Confidence:** 0.99
- **Status:** Confirmed by contract inspection and focused execution
- **Locations:** `tools/scraper/src/prompts/system.ts:28-35`; `tools/scraper/src/prompts/system.ts:74-76`; `tools/scraper/src/prompts/schemas.ts:76-84`; `tools/scraper/src/validators.ts:34-48`; `packages/core/src/calculator/reward.ts:120-127`

The scraper tells the model and tool schema that 5% must be emitted as `0.05`, with a maximum rate of 1. The runtime catalog contract stores 5% as `5.0`, and `normalizeRate()` divides by 100. The validator preserves the scraper output without conversion. A focused run passed a scraper-shaped `0.05` rule through validation and the calculator: a 10,000 won purchase yielded 5 won instead of 500 won.

**Failure scenario:** Newly scraped cards validate and serialize successfully but appear almost benefit-free in optimization.

**Fix:** Make the scraper emit percentage-form numbers (`5.0` for 5%) and widen the tool limit appropriately, or normalize exactly once at the scraper boundary. Add a contract test from extractor output through `calculateCardOutput()`.

### VER-04 — The scraper emits taxonomy and condition fields the runtime cannot honor

- **Severity:** High
- **Confidence:** 0.98
- **Status:** Confirmed contract mismatch
- **Locations:** `tools/scraper/src/prompts/system.ts:37-40`; `tools/scraper/src/prompts/system.ts:46-72`; `tools/scraper/src/prompts/schemas.ts:63-66`; `tools/scraper/src/prompts/schemas.ts:96-105`; `packages/rules/data/categories.yaml:1-190`; `packages/rules/src/schema.ts:26-39`; `packages/core/src/calculator/reward.ts:42-63`

The scraper's hard-coded list mixes obsolete or invented parents (`transport`, `shopping`, `department`, `overseas`, `leisure`, `auto`, and others) with canonical leaf IDs. Its tool schema accepts any string and has no `subcategory`. It also emits `excludeOnline`, while the runtime explicitly removed that check because transactions do not carry `isOnline`; passthrough schemas allow the unsupported field to survive.

**Failure scenario:** A scraped fuel reward is emitted as top-level `fuel`, validates, and never matches `transportation.fuel`. An “online excluded” benefit is applied to online transactions because the exclusion is silently ignored.

**Fix:** Generate the extractor enum/description from `categories.yaml`, expose parent and subcategory separately, reject noncanonical pairs, and either implement online-channel metadata end to end or reject/remove `excludeOnline`.

### VER-05 — Material eligibility limits are stored only in notes and therefore applied unconditionally

- **Severity:** High
- **Confidence:** 0.97
- **Status:** Confirmed by catalog scan and runtime-condition inspection
- **Locations:** `packages/rules/src/schema.ts:26-30`; `packages/core/src/calculator/reward.ts:42-54`; `packages/rules/data/cards/bnk/bujadoseyo-mileage-check.yaml:47-83`

The executable condition model only enforces minimum transaction amount and merchant names. Day-of-week, per-day/per-month use count, offline/autopay channel, and similar limits remain free text. A conservative scan found 39 card files whose notes mention patterns such as weekdays/weekends, monthly use counts, offline use, or autopay. For example, `bujadoseyo-mileage-check` says online shopping is limited to once monthly and coffee to four times monthly, but the calculator applies those rewards until the monetary cap is exhausted.

**Failure scenario:** Two qualifying 30,000 won online-shopping purchases both receive the benefit even though the terms allow one monthly use. Depending on transaction sizes, this overstates the card and can change the recommended card.

**Fix:** Introduce typed conditions for calendar/channel/use-count constraints and tracker state in reward calculation. Until a condition is modeled, mark the affected rule unsupported instead of calculating it as unconditional. Add boundary tests at N and N+1 uses.

### VER-06 — `won_per_liter` rewards are treated as one fixed payment per transaction

- **Severity:** High
- **Confidence:** 0.99
- **Status:** Confirmed implementation defect
- **Locations:** `packages/core/src/calculator/reward.ts:148-173`; `packages/rules/data/cards/lotte/digiloca-auto.yaml:34-55`

For `won_per_liter`, `calculateFixedReward()` returns `fixedAmount` once. The transaction model contains no fuel volume, so a rate such as 100 won per liter becomes 100 won for the entire fuel purchase. The current catalog has 14 such tier entries across 7 cards.

**Failure scenario:** A 50-liter fill under a 100 won/liter benefit should receive 5,000 won, but the optimizer assigns 100 won. The same output is produced for 10 and 50 liters.

**Fix:** Add verified fuel-volume metadata and multiply by liters, or treat the benefit as unsupported when volume is unavailable. Do not present a fabricated exact reward. Add 20-liter and 50-liter fixtures plus cap tests.

### VER-07 — Invalid but long date strings can select a fake latest month

- **Severity:** High
- **Confidence:** 0.98
- **Status:** Confirmed data-flow defect
- **Locations:** `packages/parser/src/json/index.ts:147-155`; `packages/parser/src/pdf/index.ts:206-217`; `apps/web/src/lib/analyzer.ts:283-293`; `apps/web/src/lib/analyzer.ts:381-422`; `apps/web/src/lib/analyzer.ts:440-454`; `apps/web/src/lib/store.svelte.ts:551-575`

Parsers report an invalid date but still retain the transaction. Analysis guards only on string length before slicing `YYYY-MM`; `getLatestMonth()` does the same. A value such as `2026-99-99` therefore creates month `2026-99`, sorts after valid months, and becomes the optimized month. The later period filters also check length rather than calendar validity.

**Failure scenario:** One malformed footer row alongside valid July transactions makes `2026-99` the latest month, excludes July from optimization, and produces a plausible zero/incorrect result.

**Fix:** Use one strict calendar-valid ISO-date predicate at the analysis boundary. Exclude invalid-date rows from monthly breakdown, latest-month selection, optimization, and period metadata while preserving their parse errors for the UI.

### VER-08 — Reoptimization violates its own optimized-month metadata contract

- **Severity:** Medium
- **Confidence:** 0.99
- **Status:** Confirmed data-flow defect
- **Locations:** `apps/web/src/lib/store.svelte.ts:68-77`; `apps/web/src/lib/store.svelte.ts:548-554`; `apps/web/src/lib/store.svelte.ts:613-619`; `apps/web/src/lib/store.svelte.ts:620-649`; `apps/web/src/lib/analyzer.ts:430-479`

The interface defines `statementPeriod` and `transactionCount` as optimized-month metadata, with separate full-period fields. Initial analysis follows that contract. After an edit, reoptimization correctly filters `latestTransactions` for the optimizer but sets both count fields to all edited transactions and sets both period fields to the full date range.

**Failure scenario:** Upload January and February, then edit one category. The report claims its optimized period spans both months and reports both months' row count even though the reward result covers February only.

**Fix:** Derive `statementPeriod` and `transactionCount` from `latestTransactions`; derive `fullStatementPeriod` and `totalTransactionCount` from all edited transactions. Add a two-month edit/reoptimize regression test.

### VER-09 — The CLI requires remote-upload consent before attempting local PDF parsing

- **Severity:** Medium
- **Confidence:** 0.99
- **Status:** Confirmed control-flow defect; current tests encode the defect
- **Locations:** `tools/cli/src/consent.ts:46-65`; `tools/cli/src/commands/analyze.ts:51-65`; `packages/parser/src/pdf/index.ts:283-409`; `tools/cli/__tests__/commands.test.ts:48-69`

Every PDF is rejected unless `--allow-remote-llm` is supplied, before `parseStatement()` can attempt structured and line-scanner parsing. The parser only reaches a remote model after both local tiers fail, so the CLI gate is broader than the privacy-sensitive action.

**Failure scenario:** A text-based, locally parseable PDF cannot be analyzed offline because the CLI demands consent for a transfer that would never occur.

**Fix:** First parse with remote fallback disabled. Only after local failure should the CLI explain the exact upload and, with consent, retry with remote fallback enabled. A callback at the fallback boundary would avoid duplicate local work. Update the tests to cover local success without consent and remote retry after local failure.

## Dirty-worktree verification

The pre-existing edits in `apps/web/src/lib/parser/amount.ts`, `apps/web/__tests__/amount.test.ts`, and `apps/web/src/lib/store.svelte.ts` were reviewed in place and preserved. The amount-parser double-negative handling and newly added finite-number guards are directionally correct; none of the findings above is introduced by those hunks. Unrelated plan and Cycle 42 review artifacts were not modified.

## Coverage and final sweep

- Inventory traversed: `packages/core` 27 files, `packages/parser` 60, `packages/rules` 714, `packages/viz` 8, `tools/cli` 10, `tools/scraper` 20, `apps/web` 60, `scripts` 1, and `.github` 1, plus root workspace/configuration files.
- All 683 card YAML files were included in taxonomy, broad-rule, unit, and note-condition semantic scans; representative affected files were then inspected manually.
- Runtime/config/UI surfaces were checked for orphaned claims and contract drift. No additional actionable finding survived evidence verification.
- Focused executions covered broad parent matching and scraper-rate behavior. No browser or E2E test was launched, so this reviewer created no Playwright/Chrome process requiring cleanup.
