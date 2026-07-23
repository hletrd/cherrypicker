# Documentation Review — Cycle 2

## Inventory

I checked all 28 tracked Markdown documents outside historical `.context` material: the root README, `.claude/CLAUDE.md`, `.claude/AGENTS.md`, and all 24 issuer READMEs, plus user-facing explanatory copy and source comments that define behavior. `docs:check` passed the generated 683-card/24-issuer sections; the findings below are in hand-written content that gate does not validate.

## Findings

### C2-DOC-01 — Upload help and analyzer comments describe the wrong missing-previous-month behavior

**Severity:** Medium
**Confidence:** High
**Status:** Confirmed

**Locations:** `apps/web/src/components/upload/FileDropzone.svelte:610-614`, `apps/web/src/lib/analyzer.ts:155-157`, `apps/web/src/lib/analysis-context.ts:108-127`, `apps/web/src/lib/analysis-disclosures.ts:46-68`

The single-file help says omitted input uses “this month’s spending,” and the analyzer comment says the same. The authoritative context builder instead requires the exact previous calendar month and assumes 0 won when it is absent; dashboard/report disclosure correctly reports that assumption.

**Suggested fix:** say that an omitted value uses only an uploaded exact previous-calendar-month statement, otherwise assumes 0 won. Update the stale analyzer comment to describe provenance rather than the removed current-month fallback.

### C2-DOC-02 — The public README’s YAML example does not pass the documented canonical schema

**Severity:** High
**Confidence:** High
**Status:** Confirmed by parsing the snippet

**Locations:** `README.md:162-194`, `packages/rules/src/schema.ts:12-17,80-164,207-252`

Parsing the README block with `cardRuleSetSchema` reports missing `card.lastUpdated`, `card.source`, tier `maxSpending`, `performanceExclusions`, reward `id`, required nullable `rate`, `priority`, `combination`, `stackingGroup`, `capGroup`, `support`, and `globalConstraints.minimumAnnualSpending`.

**Failure scenario:** a contributor copies the public example, fills in names, and the advertised data build rejects it.

**Suggested fix:** replace it with a canonically valid small fixture and test the fenced block in `docs:check`, or explicitly label it as a non-executable partial fragment and link to one validated YAML file plus the canonical schema.

### C2-DOC-03 — The agent guide teaches the pre-contract reward/category model

**Severity:** High
**Confidence:** High
**Status:** Confirmed

**Locations:** `.claude/AGENTS.md:12-57,67-77`, `packages/rules/src/schema.ts:80-252`, `packages/rules/src/category-contract.ts:27-92`, `packages/rules/data/categories.yaml`

The guide’s reward sample omits the required selection/cap/support fields. Its category list presents children such as `restaurant`, `cafe`, and `fuel` as standalone category IDs, while current rules require canonical parent plus optional subcategory. It also instructs adding top-level `discontinued: true`, although that field belongs inside `card`.

**Failure scenario:** an automated or human contributor follows the repository’s agent instructions and creates a rule that canonical publication rejects or whose category is unreachable.

**Suggested fix:** generate or validate this section from the same canonical contract used by publication. Document `category`/`subcategory` pairs and place `discontinued` under `card`.

### C2-DOC-04 — The agent guide’s publication procedure omits the actual multi-artifact/document gate

**Severity:** Medium
**Confidence:** High
**Status:** Confirmed

**Locations:** `.claude/AGENTS.md:5-10`, `package.json:19-23`, `scripts/build-json.ts:391-442`

The guide says to run `scripts/build-json.ts` and manually copy `cards.json`. The supported workflow is `bun run data:build`, which publishes the legacy file, summary, optimizer, 24 detail shards, categories, fallback labels, and generated READMEs; `bun run data:check` verifies drift.

**Suggested fix:** replace the manual copy steps with `bun run data:build`, followed by `bun run data:check`, and briefly list the generated outputs so contributors do not edit or copy individual artifacts.

## Final documentation sweep

Generated issuer counts, links, latest dates, format names, CLI examples, Bun pin, deployment description, product name, and license now agree with code/configuration. No additional current mismatch met the reporting threshold.
