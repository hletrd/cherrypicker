# Cycle 2 — Code Reviewer

**Review target:** `a9d3c99d52dcacd6e48eede07bb7208af4acb7a2` on `codex/review-plan-fix-no-deploy-20260723`
**Mode:** read-only review; Cycle 1 completed findings were not re-reported unless a remaining boundary failure was demonstrated.

## Inventory and coverage

`git ls-files` produced 2,029 tracked paths. After excluding historical `.context/**`, `.omc/**`, `.omx/**`, generated build/cache directories, and the four opaque root statement samples (not source/config/test/doc files), the review inventory contained **1,041 relevant tracked artifacts**:

| Area | Files | Coverage method |
|---|---:|---|
| Root policy/config/docs | 15 | Direct inspection |
| `apps/web` | 115 | Direct source/config review plus tests |
| `e2e` | 9 | All specs/fixtures inventoried; regression assertions inspected |
| `packages/core` | 29 | Direct source/test review and executable reproductions |
| `packages/parser` | 75 | Direct source/test/fixture review |
| `packages/rules` code/tests | 18 | Direct review |
| Rules registries/generated source | 4 | Schema and publication-contract review |
| Card source catalog | 707 | All 683 YAML files and 24 issuer READMEs covered by exhaustive schema/semantic tests and full-catalog queries, not sampling |
| `packages/viz` | 8 | Direct source/template/test review |
| `scripts` | 16 | Direct review and test execution |
| `tools/cli` | 13 | Direct source/test review |
| `tools/scraper` | 32 | Direct source/config/target/test review |

Current Cycle 1 aggregate and implementation plans 68–72 were checked first. D-112's 129 intentionally fail-closed merchant-scope rules were treated as known deferred data work and are not findings below.

## Findings

### C2-CR-001 — Unsupported merchant-scoped rules are disclosed for unrelated transactions

- **Severity:** Medium
- **Confidence:** High
- **Classification:** confirmed
- **Location:** `packages/core/src/calculator/reward.ts:72-108,188-218`; representative data at `packages/rules/data/cards/bc/baro-kapick.yaml:40-109`
- **Scenario:** Calculate BC KaPick for a `medical.hospital` transaction at `서울대병원`. The card's unsupported Coupang/Gmarket and coffee rules are both reported against that hospital transaction.
- **Evidence:** `findRules()` deliberately bypasses category filtering for any rule with `specificMerchants` (`:196-202`). `ruleConditionsMatch()` then returns `rule_marked_unsupported` at `:78-83` before checking the merchant allowlist at `:102-107`. An executable reproduction returned:
  - `reward-001 / online_shopping / rule_marked_unsupported`
  - `reward-002 / dining / rule_marked_unsupported`

  A full-catalog one-transaction audit produced 128 unsupported issues, 106 of them outside the transaction's `medical`, `medical.hospital`, or wildcard scope. Rewards remain fail-closed, but disclosures, confidence messaging, and issue-array cost are corrupted.
- **Suggested fix:** Establish applicability before support status. For merchant-scoped unsupported rules, test a normalized merchant allowlist first; for ordinary rules, test category/subcategory first. Only then emit the unsupported issue. Add a full-catalog assertion that an unrelated transaction cannot acquire a non-wildcard issue.

### C2-CR-002 — Five catalog rules are published as supported but the calculator always rejects their reward unit

- **Severity:** High
- **Confidence:** High
- **Classification:** confirmed
- **Location:** `packages/rules/src/schema.ts:19-24,55-77,80-164`; `packages/core/src/calculator/reward.ts:455-478`; `packages/rules/data/cards/samsung/and-mileage-platinum.yaml:43-122`
- **Scenario:** Use Samsung `& MILEAGE PLATINUM` at a department store. Its supported `reward-002` promises the special mileage rate, but calculation returns zero and `unsupported_reward_unit`.
- **Evidence:** The schema accepts `rate` plus `unit: miles` and derives `value.kind: mileage_per_spend`. The five special rules `reward-002` through `reward-006` are `support.status: supported` in source and generated optimizer data. The calculator rejects every non-null unit on a rate-based reward at `reward.ts:464-473`. The reproduction for `reward-002` returned total reward `0` with `unsupported_reward_unit`.
- **Suggested fix:** Pick one enforceable representation. Either implement an explicit mileage valuation/conversion contract and cap unit, or mark these five rules unsupported until such a contract exists. Add catalog validation that every `supported` tier shape is executable by the calculator, plus a real-card regression for this card.

### C2-CR-003 — The browser catalog boundary validates a transformed shape but returns the untransformed object

- **Severity:** High
- **Confidence:** High
- **Classification:** manual-validation risk
- **Location:** `apps/web/src/lib/card-catalog-reader.ts:31-53`; `packages/rules/src/schema.ts:80-164`; `packages/core/src/calculator/reward.ts:455-495`
- **Scenario:** A schema-valid optimizer artifact omits optional `fixedAmount`, `unit`, `monthlyCap`, and `perTransactionCap` fields (for example, an authored-shape or version-skewed cached artifact). Zod accepts it and supplies canonical null defaults, but the reader discards `result.data` and returns the raw object. A normal domestic 1% transaction then produces `NaN` reward.
- **Evidence:** `readCardRuleArray()` calls `safeParse()` but returns `value as CardRuleSet[]`. The Zod transforms at `schema.ts:84-91,150-164` therefore never reach runtime. A reproduction based on `shinhan-simple-plan.yaml`, with only those optional fields omitted, passed `readOptimizerCatalog()` and produced `totalReward: NaN` once `paymentType: domestic` made the rule applicable. Checked-in artifacts are canonical today, so this is a boundary/version-skew risk rather than current artifact corruption.
- **Suggested fix:** Return the collected `result.data` objects. If preserving the original object graph is a measured performance requirement, make normalized fields required on the browser artifact schema and reject authored-shape JSON. Add an accepted-but-transformed fixture and assert all calculator outputs are finite.

## Verification and final missed-issue sweep

- `bun test`: **2,196 passed, 0 failed** across 73 files. The installed executable was Bun 1.3.12; the repository pins Bun 1.2.6, so this is supporting evidence rather than the pinned release gate.
- Focused core/parser/web/CLI/scraper/viz run: **194 passed, 0 failed**.
- Full-catalog queries covered every card/rule for supported-unit shapes, merchant-scoped unsupported attribution, typed predicates, and non-category performance exclusions.
- Final sweeps covered thrown/caught errors, `TODO`/`FIXME` markers, unsafe numeric paths, async state commits, schema transforms, duplicate parser semantics, ignored conditions, cap keys, and generated-artifact consumers. No additional code-reviewer finding met the evidence threshold.
