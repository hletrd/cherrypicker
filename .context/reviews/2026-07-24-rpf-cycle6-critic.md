# Cycle 6 Critic Review

## Review basis and coverage

- Reviewed current HEAD `449f10a2faff` on `codex/review-plan-fix-no-deploy-20260723`.
- Enumerated all 2,151 tracked files and classified 372 implementation, test, configuration, workflow, and documentation artifacts for direct review. Bulk authored card YAML, generated/public catalog payloads, snapshots, and archived review material were inventoried rather than read line by line; representative catalog inputs and the publication validators were inspected.
- Followed the principal data paths through statement detection/parsing, transaction validation and categorization, card-catalog loading and validation, optimization, persistence/reoptimization, dashboard/report rendering, CLI, scraper, build scripts, and CI/E2E configuration.
- Re-checked historical review material by targeted search so fixed historical findings were not repeated.

## Findings

### C6-CT-001 — Non-tabular parsers bypass the repository's required-merchant contract

- **Severity:** Medium
- **Confidence:** High
- **Status:** confirmed
- **Code regions:** `packages/parser/src/shared/required-fields.ts:1-26`; `packages/parser/src/shared/json.ts:107-129,163-168`; `packages/parser/src/html/index.ts:119-137,172-180,208-212`; `packages/parser/src/ofx/index.ts:78-98,127-132`; browser mirrors at `apps/web/src/lib/parser/html.ts:108-125,141-163,190-209` and `apps/web/src/lib/parser/ofx.ts:53-74,101-105`; persisted boundary at `apps/web/src/lib/tx-validation.ts:51-61`.
- **Why it matters:** The canonical required-column contract explicitly includes `merchant`, and CSV/XLSX reject a missing merchant column or blank merchant row. JSON only checks date and amount, HTML only requires date and amount columns, and OFX only requires `DTPOSTED` and `TRNAMT`. Those paths can therefore emit a transaction whose merchant is `""`; the persisted transaction guard also accepts any string, including blank whitespace. Merchant text drives category and merchant-scoped reward matching, so the same statement data can be rejected in CSV but silently optimized as an unknown/general-spend transaction in JSON, HTML, or OFX.
- **Concrete scenario:** On current HEAD, `parseJSONTransactions('[{"date":"2026-07-01","amount":1000}]')` returned `{"merchant":""}` with no diagnostic. An OFX `STMTTRN` containing only `DTPOSTED` and `TRNAMT=-1000` likewise returned a blank merchant with no diagnostic.
- **Suggested fix:** Apply `normalizeRequiredMerchant()` at every format boundary, reject absent/blank merchant fields with the shared `missing_required_merchant` diagnostic, and use the same check in the browser adapters and persisted transaction validator. Add parity tests for JSON, HTML, OFX, and structured/LLM PDF inputs, covering both a missing merchant field/column and a whitespace-only value.

### C6-CT-002 — A partially stale explicit card selection silently changes optimization scope

- **Severity:** Medium
- **Confidence:** High
- **Status:** confirmed
- **Code regions:** `apps/web/src/lib/analyzer.ts:213-226`; `apps/web/src/lib/analyzer-helpers.ts:66-72`; `apps/web/__tests__/analyzer-adapter.test.ts:174-181`.
- **Why it matters:** `optimizeFromTransactions()` filters the eligible catalog by the requested IDs, but `assertRequestedCardsResolved()` only fails when the filtered count is zero. It does not verify that every distinct requested ID resolved. An explicit multi-card comparison can therefore degrade to a smaller, different comparison without informing the user.
- **Concrete scenario:** If a restored selection is `["still-active", "removed-or-discontinued"]`, one rule resolves and the helper accepts `resolvedCount === 1`; optimization proceeds using only `still-active`. A direct current-HEAD call to `assertRequestedCardsResolved(["valid-card", "stale-card"], 1)` completed without error. Existing tests cover all-missing and one-requested/one-resolved cases, but not partial resolution.
- **Suggested fix:** Compare the de-duplicated requested ID set with the actual resolved eligible card IDs, and fail closed with the missing IDs (or require an explicit user acknowledgement before continuing). Add tests for partial resolution, duplicate requested IDs, and IDs filtered out by recommendation eligibility.

### C6-CT-003 — Duplicate reward-tier references are accepted, then resolved by array order

- **Severity:** Medium
- **Confidence:** High
- **Status:** confirmed
- **Code regions:** `packages/rules/src/schema.ts:231-244`; `packages/rules/src/catalog-validation.ts:74-101,230-270`; `packages/core/src/calculator/reward.ts:51-53`.
- **Why it matters:** The schema requires a non-empty `rule.tiers` array, and semantic validation checks that each `performanceTier` exists, but neither requires those references to be unique within a reward. The calculator uses `Array.find()`, so it silently applies the first duplicate. Reordering otherwise identical catalog data can consequently change the reward result.
- **Concrete scenario:** A current catalog rule was cloned with a second entry for the same `tier0`, changing its rates from `0.3` to `[0.3, 99]`. Both `cardRuleSetSchema.safeParse()` and `validateCardRuleSet()` accepted it. The calculator would select `0.3` because that entry appears first. A scan of the current authored catalog found no existing duplicate, so this is a confirmed ingestion/validation defect with latent rather than presently published impact.
- **Suggested fix:** Add a uniqueness refinement on `rewardRuleSchema.tiers[*].performanceTier` and a matching semantic-validation issue with the duplicate index. Keep the calculator fail-closed or assert the invariant defensively. Cover schema, catalog publication, scraper validation, and order-independence in tests.

## Validation performed

- Focused repros confirmed blank merchants from JSON and OFX, partial requested-card acceptance, and schema/domain acceptance of duplicate reward-tier references.
- `bun test apps/web/__tests__/analyzer-adapter.test.ts packages/rules/__tests__/schema.test.ts packages/rules/__tests__/catalog-validation.test.ts packages/parser/__tests__/json.test.ts packages/parser/__tests__/ofx.test.ts`
  - Result: **138 passed, 0 failed**.
  - The green suite confirms the gaps are not covered by the current focused tests; it does not invalidate the direct repros above.

## Final missed-issue sweep

The final sweep revisited parser parity, explicit-selection state, catalog semantic invariants, persistence restore behavior, scraper I/O boundaries, and report consumers. No additional current-HEAD issue met the bar for a non-duplicative, evidence-backed critic finding. In particular, speculative UI polish, documentation-version drift, and corruption-only persistence tradeoffs were excluded from this report.
