# Cycle 6 code-reviewer report

- Review date: 2026-07-24
- Reviewed HEAD: `449f10a2faffaae2a2c47036070b0e61a5b6eec2`
- Branch: `codex/review-plan-fix-no-deploy-20260723`
- Lens: code quality, logic, SOLID/maintainability, cross-file contracts
- Findings: 3 (`1 High`, `2 Medium`)

## Inventory and coverage

I read the governing documentation in the required order:

1. `.claude/CLAUDE.md`
2. `.claude/AGENTS.md`
3. `README.md`
4. root/workspace manifests, TypeScript/Astro/Vitest/Playwright/Turbo/Bun configuration, scripts, and the deployment workflow

I inventoried every tracked behavior-bearing file under the following groups. Counts include source, tests, fixtures, and package-local configuration, but exclude generated catalog payloads:

| Group | Tracked files inventoried | Review coverage |
|---|---:|---|
| `apps/web/**` | 119 | parser adapters/workers, analysis and persistence state, catalog loaders, Svelte/Astro UI logic, and web tests |
| `packages/core/**` | 34 | analysis context, categorizer, calculator, optimizer, models, and tests |
| `packages/parser/**` | 86 | CSV/XLSX/HTML/JSON/OFX/PDF routing and kernels, shared normalization, fixtures, and tests |
| `packages/rules/**` | 25 | schemas, semantic validation, loaders, category/security contracts, and tests |
| `packages/viz/**` | 12 | terminal and standalone-report generation plus tests |
| `tools/cli/**` | 26 | commands, option parsing, consent, catalog/report boundaries, and tests |
| `tools/scraper/**` | 33 | argument parsing, extraction, network policy, validation, writer, and tests |
| `scripts/**` | 18 | catalog publication/build/check/E2E support and tests |
| `e2e/**` | 15 | Playwright configuration and browser regression specifications |

The tracked functional inventory contained 276 TypeScript, 14 Svelte, 6 Astro, 13 JavaScript, and the relevant CSS/templates/fixtures. I classified but did not manually line-review generated/bulk data (`packages/rules/data/cards/**`, compiled catalog JSON, `apps/web/public/data/**`), dependencies, build output, or historical `.context/**`; their contracts were reviewed through authoring schemas, publication code, generated-artifact checks, runtime loaders, and tests. Binary parser fixtures were reviewed through their parser boundaries and conformance tests.

Cross-file traces covered:

- statement bytes → format routing → normalized transaction → categorization → analysis-month selection → reward calculator → greedy optimizer → web/CLI/report output;
- authored YAML/category taxonomy → semantic validation → split catalog publication → browser/CLI loading;
- analysis replacement/reoptimization → session persistence → restoration/UI review;
- scraper URL policy → extraction schema → semantic validation → atomic writer.

## Findings

### C6-CR-001 — A zero-value specific rule suppresses a valid wildcard base reward

- Severity: **High**
- Confidence: **High**
- Status: **confirmed**
- Primary regions:
  - `packages/core/src/calculator/reward.ts:181-217` (`ruleSpecificity` / `compareRuleCandidates`)
  - `packages/core/src/calculator/reward.ts:219-288` (`findRules`)
  - `packages/core/src/calculator/reward.ts:588-689` (selection occurs before tier value is evaluated)
  - Concrete published example: `packages/rules/data/cards/shinhan/deep-dream.yaml:31-70`

`findRules` chooses one exclusive member per stacking group using category specificity and priority before looking up the current performance tier's reward. A category-specific rule therefore wins even when its current tier is explicitly zero, and the matching `*` base rule is discarded.

Live reproduction against the published optimizer artifact:

```text
card: shinhan-deep-dream
previousMonthSpending: 0
transaction: 10,000원, category=dining
actual totalReward: 0원

same transaction, category=uncategorized
actual totalReward: 69원 (the wildcard rule is reached)
```

The card contract calls `reward-001` “전 가맹점 기본 적립 (무실적)” at 0.7%, while the more specific dining rule is 0% at `tier0`. The base benefit should remain reachable for dining, but specificity selects the zero rule. A catalog scan found the same positive-wildcard/zero-specific shape in 91 tier/rule pairs across 41 recommendation-eligible cards. The same design can also prevent fallback to a base rule after a specific rule's cap or occurrence limit is exhausted.

This systematically understates benefits and can change both the selected card and the claimed savings, especially for users below a card's performance threshold.

Suggested fix:

- Make exclusive selection tier- and state-aware instead of selecting solely by static specificity. A zero/unavailable/non-executable candidate must not silently displace an applicable positive base rule.
- If some cards intentionally use a zero specific rule to override the wildcard, model that as an explicit override/fallback contract rather than inferring it from specificity.
- Add catalog-semantic validation and calculator/optimizer tests for positive wildcard + zero specific tier, exhausted specific cap, and an intentional explicit override.

### C6-CR-002 — Decimal percentage-point conversion causes one-Won undercounting

- Severity: **Medium**
- Confidence: **High**
- Status: **confirmed**
- Regions:
  - `packages/core/src/calculator/reward.ts:313-320` (`rate / 100`)
  - `packages/core/src/calculator/reward.ts:632-660` (normalized rate passed to the calculator)
  - `packages/core/src/calculator/types.ts:61-100` (`Math.floor(amount * rate)`)

Authored rates are percentage points. The code first divides by 100 as a binary floating-point value and then floors the product. For common decimal rates, the division introduces a value just below the mathematical rate:

```text
0.7 / 100 = 0.006999999999999999
10,000 * that value = 69.99999999999999
Math.floor(...) = 69
```

Thus an exact 0.7% reward on 10,000원 becomes 69원 rather than 70원. The live `shinhan-deep-dream` wildcard reproduction returned 69원. The published artifact contains 767 positive non-integer percentage tiers across 311 cards, so this is not an isolated input shape.

This biases reward totals downward by one unit for affected transaction/rate combinations and can compound across many transactions or alter close optimizer ties.

Suggested fix:

- Calculate from the authored percentage-point decimal exactly, e.g. a checked rational/`BigInt` path equivalent to `floor(amount × rate / 100)`. The existing decimal-product helper in `reward.ts` can be generalized/reused.
- Do not patch this with an arbitrary epsilon.
- Add boundary tests for 0.7%, 1.3%, 0.033%, exact-integer products, non-integer products, and safe-integer overflow.

### C6-CR-003 — The required-merchant contract is enforced only by CSV/XLSX

- Severity: **Medium**
- Confidence: **High**
- Status: **confirmed**
- Contract and affected regions:
  - `packages/parser/src/shared/required-fields.ts:1-27` declares `date`, `merchant`, and `amount` required
  - `packages/parser/src/shared/json.ts:107-168` checks only date/amount and constructs `merchant: ''`
  - `packages/parser/src/html/index.ts:119-137,157-212` and `apps/web/src/lib/parser/html.ts:108-125,141-194` require only date/amount
  - `packages/parser/src/ofx/index.ts:78-132` and `apps/web/src/lib/parser/ofx.ts:53-105` accept neither `NAME` nor `MEMO`
  - `packages/parser/src/shared/pdf-text.ts:152-207` can emit `findMerchant(...).value === ''`
  - `apps/web/src/lib/tx-validation.ts:51-61` accepts any merchant string, including blank/whitespace, during persistence restoration

The Cycle 5 shared contract and CSV/XLSX paths reject a missing or blank merchant, but JSON, HTML, OFX, structured PDF, and restored web transactions do not consistently use that contract.

Live reproductions at this HEAD:

```text
JSON [{date:"2026-07-01", amount:1234}]
  -> one transaction, merchant="", no error

HTML table with only date and amount columns
  -> one transaction, merchant="", no error

OFX STMTTRN with DTPOSTED/TRNAMT but no NAME/MEMO
  -> one transaction, merchant="", no error

isOptimizableTx({...valid, merchant:""})
  -> true
```

A blank merchant is categorized as uncategorized but still contributes spending and may receive a wildcard reward. The malformed row therefore changes totals/recommendations instead of being quarantined, while equivalent CSV/XLSX input is rejected.

Suggested fix:

- Centralize required-row validation and apply `normalizeRequiredMerchant` plus `REQUIRED_MERCHANT_ERROR_CODE` at every parser adapter and the persisted-transaction boundary.
- For OFX, require at least one nonblank `NAME`/`MEMO`; for structured PDF, reject rows where merchant inference fails.
- Add server/browser conformance tests for missing header, missing field, whitespace-only merchant, diagnostic bounds, and persistence restoration across JSON/HTML/OFX/PDF.

## Verification

- `bun run typecheck` — passed for parser, rules, core, viz, web (0 diagnostics), scraper, and CLI.
- `bun run test` — passed: all 12 Turbo tasks plus 61 script tests. Turbo replayed valid package-test cache entries; the script suite ran live.
- Live read-only Bun reproductions confirmed all three findings.
- Catalog scans found:
  - C6-CR-001: 91 affected tier/rule pairs across 41 cards.
  - C6-CR-002: 767 positive non-integer percentage tiers across 311 cards.
- No source, plan, protected Cycle 42 artifact, commit, branch, deployment, or external state was changed.

## Final missed-issue sweep

The final sweep rechecked TODO/FIXME/type-escape/ignored-error sites, parser server/browser parity, calculator cap/occurrence state, optimizer marginal scoring, catalog source-hash consistency, persistence migrations, CLI/report filesystem behavior, scraper network/write boundaries, and tests/comments against current code. I discarded speculative multi-sheet aggregation, heuristic-optimality, and threat-model observations where the repository explicitly documents the behavior or the evidence did not establish a current defect.
