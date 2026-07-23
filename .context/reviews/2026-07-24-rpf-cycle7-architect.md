# Cycle 7 architect report

- Review date: 2026-07-24
- Reviewed HEAD: `3086a379e31e5b17f82401807f5b3c24325b9962`
- Branch: `codex/review-plan-fix-no-deploy-20260723`
- Lens: canonical contracts, dependency boundaries, publication/runtime
  agreement, and cross-surface configuration
- Findings: 3 (`2 High`, `1 Medium`)

## Inventory and coverage

The architecture pass classified all 2,175 tracked paths: 1,045 historical
`.context` files, 683 authored card YAML files, 30 generated catalog artifacts,
and 417 active implementation/test/configuration/documentation/fixture files.
Every review-relevant tracked file was included in the inventory and
source/search pass.

The pass examined dependency direction and public boundaries across web, core,
parser, rules, visualization, CLI, scraper, scripts, and E2E; canonical
category and card contracts; browser/Bun mirrors and worker protocols; schema
and semantic validation; artifact publication and identity; persistence
versioning; and manifest/toolchain/documentation agreement. Bulk card data and
generated outputs were exhaustively parsed/validated and queried for the
contract shapes relevant to the findings below.

## Findings

### C7-AR-001 — Legacy keyword maps override the canonical taxonomy and make supported rewards unreachable

- Severity: **High**
- Confidence: **High**
- Classification: **confirmed**
- Canonical contract:
  - `packages/rules/data/categories.yaml:72-164,373-404,449-481`
  - `packages/core/src/categorizer/taxonomy.ts:19-31`
- Divergent runtime:
  - `packages/core/src/categorizer/matcher.ts:23-28,81-169,205-245`
  - `packages/core/src/categorizer/keyword-overrides.ts:130-180`
  - `scripts/migrations/generate-keyword-overrides.ts:46-89`
  - Reward category gate:
    `packages/core/src/calculator/reward.ts:384-409`

`categories.yaml` is the category contract used to validate card rules. It
declares, for example, `세븐일레븐` and `이마트24` as `convenience_store`,
`교통카드` as `public_transit`, `약국` as `medical.pharmacy`, and
`넷플릭스` as `entertainment.streaming`. The runtime matcher builds its legacy
static maps first and returns those exact/substring matches before consulting
the taxonomy.

Current generated overrides instead select:

```text
세븐일레븐 -> offline_shopping
이마트24   -> offline_shopping
교통카드   -> transportation
약국       -> medical.hospital
넷플릭스   -> subscription
```

These are not harmless label differences: `findRules()` requires category and
subcategory equality for ordinary supported rules.

Live end-to-end reproduction with `nh-zgm-play`:

```text
MerchantMatcher("세븐일레븐") -> offline_shopping
10,000원 transaction at tier1 -> 0원
same transaction categorized by canonical taxonomy as convenience_store -> 500원
```

Why it matters: supported convenience, transit, grocery, pharmacy, streaming,
and other rewards can never match common canonical keywords, changing card
rankings and disclosures. Existing tests at
`packages/core/__tests__/categorizer.test.ts:199-246,365-375` snapshot the
legacy winners and only prove that conflicts have an override; they do not
prove that the override agrees with the category contract used by card rules.

Concrete scenario: a user uploads a transaction whose merchant is exactly
`세븐일레븐`. A card with a supported 5% convenience-store reward is evaluated
as if the transaction were generic offline shopping, so the optimizer omits a
real 500원 benefit.

Root fix:

- Make canonical taxonomy semantics authoritative for its declared keywords,
  or reconcile each legacy decision through an explicit semantic migration.
- Regenerate/remove divergent legacy overrides; do not merely rerun the
  current historical-last-source generator.
- Add an invariant that every canonical taxonomy keyword resolves to its
  declared category/leaf, followed by end-to-end supported-rule reachability
  tests.

### C7-AR-002 — Free-form choice restrictions bypass fail-closed catalog validation

- Severity: **High**
- Confidence: **High**
- Classification: **confirmed**
- Validation boundary:
  - `packages/rules/src/rule-semantics.ts:15-32,41-86`
  - `packages/rules/src/catalog-validation.ts:358-370`
  - `packages/rules/__tests__/catalog-validation.test.ts:480-504`
- Concrete authored example:
  `packages/rules/data/cards/jb/1st-triple.yaml:37-112`
- Runtime condition boundary:
  `packages/core/src/calculator/reward.ts:112-180`

The catalog claims supported rules contain no unmodeled eligibility prose, but
the user-choice detector recognizes only `택 N`, `선택 서비스/혜택/업종`, or
`월별 선택`. It misses common authored forms such as `선택 카테고리`,
`A팩 선택 시`, `중 선택`, `Pack 선택 시`, and `선택A`.

A bounded full-catalog query found 30 currently `supported` reward rows across
12 cards with such unrecognized choice wording. Explicit examples include
`jb-1st-triple`, `kb-you-prime`, `nh-take5`, `samsung-taptap-o`,
`shinhan-yolo`, and `toss-moim-check`.

`jb-1st-triple` marks all three rules supported while each note says “3개 선택
카테고리 중 하나.” A live calculation with 100,000원 each in dining, online
shopping, and fuel awarded 5,000원 to all three (15,000원 total) and reported
no unsupported rule. The data itself says only one choice applies.

Why it matters: the optimizer overstates benefits and can recommend a card on
the assumption that mutually exclusive user selections are simultaneously
active. `data:check` remains green because it tests the same incomplete prose
classifier.

Concrete scenario: a user with spending in all three `1st Triple` categories
is shown 15,000원 of benefit even though only one selected category can
qualify, potentially overstating the card by 10,000원.

Root fix:

- Quarantine all current choice-bearing rules as unsupported until choice state
  is represented and provided by the user, then regenerate published
  artifacts.
- Replace prose-dependent eligibility inference with structured choice
  groups/options in the rule schema and calculator input.
- Until migration is complete, broaden the fail-closed inventory and add every
  current Korean/English phrasing as a regression fixture; regex alone should
  remain a guard, not the source of truth.

### C7-AR-003 — CLI accepts a custom taxonomy with an unrelated compiled card catalog

- Severity: **Medium**
- Confidence: **High**
- Classification: **confirmed**
- Regions:
  - `tools/cli/src/command-options.ts:62-87,355-367`
  - `tools/cli/src/commands/optimize.ts:63-93`
  - `tools/cli/src/commands/report.ts:68-97`
  - `tools/cli/src/card-catalog.ts:31-76`

The CLI advertises `--categories` independently for every statement command.
Optimize/report build the matcher and labels from that file, then call
`loadCliCardCatalog(cardsDir, categories)`. The loader validates those
categories only when `--cards` is also supplied. Without `--cards`, it returns
the precompiled canonical catalog without checking compatibility or source
identity.

Live reproduction:

```text
loadCliCardCatalog(undefined, [{ id: "custom-only", ... }])
  -> mode: "compiled"
  -> 682 recommendation-eligible canonical cards
  -> no reward category "custom-only"
```

Why it matters: the custom matcher can emit only categories that the compiled
rules do not recognize. The command completes normally with zero or wrong
rewards instead of reporting that its two semantic inputs belong to different
contracts.

Concrete scenario: an operator supplies a reduced company taxonomy with
`--categories` but omits `--cards`. Every statement row is categorized under
custom IDs, while the optimizer silently evaluates canonical card rules, so
recommendations collapse without an actionable error.

Root fix:

- Require `--categories` and `--cards` together for optimize/report, or compile
  and validate an explicitly bound category+catalog pair.
- Carry category source identity/hash in compiled artifacts and reject
  mismatches before categorization.
- Add command-level tests for custom categories alone, both overrides
  together, and artifact identity mismatch.

## Verification

- `bun run verify` passed: toolchain, migrations, dependency audit, all 683
  card files and generated artifacts, lint/typecheck, tests, web build, and
  bundle budget.
- Read-only runtime reproductions confirmed all three findings.
- No source, plan, protected Cycle 42 artifact, commit, branch, deployment, or
  external state was changed.

## Final missed-issue sweep

The final architecture sweep revisited canonical-versus-runtime category
ownership, reward eligibility representation, publication identity, CLI/web
catalog parity, browser/server boundaries, worker ownership, persistence
versioning, and manifest/documentation agreement. Fixed historical issues and
already-recorded deferred redesigns were excluded.
