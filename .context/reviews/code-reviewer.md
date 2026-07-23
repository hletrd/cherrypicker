# Cycle 3 — Code Reviewer

**Review target:** `614ce5c` on `codex/review-plan-fix-no-deploy-20260723`
**Mode:** read-only deep review after signed Cycle 1 and Cycle 2 closure. Closed findings were not re-reported unless a current boundary failure was independently reproduced.

## Inventory and coverage

`git ls-files` produced 2,072 tracked paths. Excluding historical `.context/**`, orchestration state, and generated caches left **1,067 current source/config/test/doc/data artifacts**:

| Area | Files | Coverage |
|---|---:|---|
| Root, `.claude`, and workflow policy/config/docs | 15 | Direct inspection |
| `apps/web` | 130 | Direct source/config/test inspection and boundary probes |
| `e2e` | 10 | All specs and fixtures inventoried; contract assertions inspected |
| `packages/core` | 32 | Direct source/test inspection and executable reward probes |
| `packages/parser` | 78 | Direct source/test/fixture inspection; server/web parity compared |
| `packages/rules` | 729 | 22 code/generated artifacts directly inspected; all 683 card YAMLs and 24 issuer READMEs exercised by exhaustive catalog checks |
| `packages/viz` | 8 | Generator, template, exports, and all tests inspected |
| `scripts` | 16 | Direct inspection plus build/data gates |
| `tools/cli` | 17 | All source/tests inspected; report handoff traced |
| `tools/scraper` | 32 | Source/config/targets/tests inspected |

The 318 code/config/test artifacts were listed before review in `/tmp/c3-review-files.txt`. Cycle 2 reports and plans 73–78 were checked for closure and non-duplication. Cross-file flows traced included parser → fact provenance → analyzer/CLI → core reward → optimizer → persistence/report, and YAML → publication artifacts → browser readers → categorizer.

## Findings

### C3-CR-001 — An unbounded statement fuel-volume fact can make rewards non-finite

- **Severity:** High
- **Confidence:** High
- **Status:** confirmed
- **Location:** `packages/parser/src/shared/transaction-facts.ts:124-130,196-204`; `packages/parser/src/json/index.ts:148-156`; `apps/web/src/lib/parser/json.ts:140-148`; `packages/core/src/calculator/reward.ts:318-352`; representative supported rule `packages/rules/data/cards/shinhan/the-classic-y.yaml:73-95`
- **Concrete failure scenario:** A JSON statement contains a normal 10,000-won fuel transaction with `fuelVolumeLiters: 1e308`. The parser accepts the fact as statement-provenanced. A supported 60-won-per-liter rule multiplies it to `Infinity`, so reward totals and optimizer comparisons are no longer valid financial numbers.
- **Evidence:** `parseFuelVolume()` accepts every finite positive number, without a safe upper bound or amount plausibility constraint. `calculateFixedReward()` checks only finite/positive/provenance before returning `fixedAmount * liters`; it does not validate the product. Executable reproduction against `the-classic-y.yaml` returned:
  `{"parseErrors":[],"liters":1e+308,"provenance":{"fuelVolumeLiters":"statement"},"totalReward":"Infinity","reward":"Infinity","finite":false}`.
  Existing tests cover 12.5- and 20-liter examples (`packages/parser/__tests__/json.test.ts:263-301`, `apps/web/__tests__/parser-json.test.ts:186-209`, `packages/core/__tests__/calculator.test.ts:1028-1042`) but no domain maximum, overflow, or non-finite output invariant.
- **Suggested fix:** Give fuel volume one canonical bounded validator shared by all parsers and persisted/user facts. Reject values outside a documented physical/domain range and optionally cross-check them against transaction amount. Independently require the calculated reward and all accumulated totals to be finite safe monetary values; fail closed with a calculation issue instead of returning a non-finite reward. Add parser, core, web handoff, optimizer, and persistence regressions for the upper boundary and `1e308`.

### C3-CR-002 — The browser category artifact is cast after only an array/nonempty check

- **Severity:** Medium
- **Confidence:** High
- **Status:** confirmed
- **Location:** `apps/web/src/lib/cards.ts:69-75,402-423`; `apps/web/src/lib/analyzer-helpers.ts:25-36`; downstream assumption `packages/core/src/categorizer/taxonomy.ts:71-89`; canonical validator `packages/rules/src/schema.ts:254-286`; tests `apps/web/__tests__/cards-loader.test.ts:226-269,538-570`
- **Concrete failure scenario:** A deployed `categories.json` retains the expected 64-character `sourceHash` but one node lacks `keywords`. `loadCategories()` accepts and caches it. Starting analysis then constructs `MerchantMatcher`, which throws while iterating `entry.keywords`, leaving the user unable to analyze any statement until a new page session.
- **Evidence:** The loader validates only that `value` is a record and `categories` is a nonempty array, then performs `value.categories as CategoryNode[]`. A fetch-mocked production call accepted `{id:"dining",label:"Dining",labelKo:"외식"}` and the next `new MerchantMatcher(categories)` failed with `TypeError: undefined is not an object (evaluating 'entry.keywords')`. The local type itself requires an obsolete `label` and omits the artifact's actual `labelEn`; `toRulesCategoryNodes()` compensates by replacing every English label with `''`. By contrast, optimizer/detail artifacts are parsed through `cardRuleSetSchema` in `apps/web/src/lib/card-catalog-reader.ts:41-115`, and a canonical recursive `categoryNodeSchema` already exists. The tracked-artifact test checks only the category artifact's source hash, not its node structure.
- **Suggested fix:** Add a dedicated category-artifact reader that validates `sourceHash` plus every recursive node with the canonical schema before calling `acceptSourceHash()` or populating the cache. Reuse the rules `CategoryNode` type directly and remove the lossy adapter/local `label` shape. Add malformed root/child, missing-keywords, duplicate-ID, wrong-label, and retry/cache tests.

## Verification and missed-issue sweep

- `bun test`: 2,254 pass, 0 fail across 80 files.
- `bun run lint`: pass; Astro reported 0 errors, warnings, or hints.
- `bun run typecheck`: pass; Astro reported 0 errors, warnings, or hints.
- `bun run data:check`: pass for 683 cards and 24 issuer READMEs.
- `bun run migrations:check`: pass.
- Final targeted searches covered unchecked casts, numeric finiteness/safe-integer guards, report consumers, stale comments/TODOs, parser null paths, and all split-artifact readers. No additional Code Reviewer finding met the evidence threshold.
