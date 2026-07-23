# Code Review — Cycle 1

**Reviewer:** code-reviewer
**Date:** 2026-07-23
**Scope:** Entire current repository at `e6fe49b`; correctness, cross-file contracts, parser behavior, and maintainability
**Outcome:** 1 Critical, 6 High, 2 Medium findings

## Executive summary

The largest risk is not a local edge case: the categorizer, card catalog, calculator, generator, and scraper do not share one category/reward contract. A mechanical audit found that hundreds of card benefits cannot be reached by the merchants they explicitly name, while unsupported reward units and duplicated rules can produce zero, understated, or impossible rewards. These failures directly affect the product's primary recommendation result.

The parser sweep also confirmed four transaction-integrity defects shared by the browser and server implementations. No source files were changed.

## Findings

### CR-01 — Common merchants and declared card benefits use incompatible category keys

**Severity:** Critical
**Confidence:** High
**Status:** Confirmed by code inspection, full-catalog mechanical audit, and runtime reproduction

**Evidence**

- `packages/core/src/categorizer/matcher.ts:8-19` merges four keyword maps by object spread. Later maps silently replace earlier entries.
- `packages/core/src/categorizer/matcher.ts:61-99` returns the winning static mapping without checking it against the taxonomy.
- `packages/core/src/categorizer/taxonomy.ts:30-55` emits child matches as `{ category: parentId, subcategory: childId }`.
- `packages/core/src/calculator/reward.ts:67-94` requires those fields to exactly match a reward rule and rejects a broad parent rule when a transaction has a subcategory.
- Concrete conflicting entries include `packages/core/src/categorizer/keywords.ts:364` (`이마트 -> grocery.supermarket`) being overwritten by `packages/core/src/categorizer/keywords-niche.ts:870` (`이마트 -> offline_shopping`). Similar conflicts affect convenience stores, fuel, books, cinemas, airlines, and department stores.
- A representative benefit declares `GS칼텍스` under `transportation` at `packages/rules/data/cards/shinhan/gscaltex-shine.yaml:37-62`, while the effective matcher returns bare `fuel`. The catalog's CGV benefit at `packages/rules/data/cards/shinhan/cj-one-prism.yaml:47-61` similarly receives bare `movie`.
- `scripts/build-json.ts:204-214,246-250` flattens every taxonomy node into one set and only warns about unknown top-level categories. It never validates an emitted `(category, subcategory)` pair or benefit reachability, and warnings do not fail the build (`scripts/build-json.ts:284-293`).

**Full-catalog sweep**

- 13,568 raw keyword entries collapse to 12,740 effective keys.
- 828 keys are duplicated across maps; 183 duplicates disagree on the category.
- 2,377 effective static mappings are outside the parent/subcategory shape emitted by `CategoryTaxonomy`.
- Of 639 reward rules with `specificMerchants`, 357 cannot match any merchant listed by that rule through the current matcher/calculator path.
- 121 reward rules in 95 card files are outside the taxonomy-emitted key shape.
- 1,818 performance-exclusion entries in 577 cards do not equal any category, leaf, or parent/leaf key that `apps/web/src/lib/analyzer.ts:239-261` can test.

**Concrete failure**

Runtime reproduction with the real taxonomy and catalog produced:

- `MerchantMatcher.match("GS칼텍스") -> { category: "fuel" }`; the named `shinhan-gscaltex-shine` benefit returned `0`.
- `MerchantMatcher.match("CGV") -> { category: "movie" }`; the named `shinhan-cj-one-prism` benefit returned `0`.

The optimizer therefore ranks cards using missing benefits for ordinary, high-frequency merchants.

**Fix**

Define one canonical `CategoryKey` contract and generate every keyword map, card rule, UI option, and scraper enum from it. Normalize legacy leaf IDs at the ingestion boundary. Make the catalog build fail on conflicting keyword overrides, invalid parent/child pairs, unreachable `specificMerchants`, and exclusion values that the categorizer cannot emit. Add end-to-end catalog assertions that each declared merchant reaches its own reward rule.

---

### CR-02 — Reward units can yield impossible rewards or silently lose benefits

**Severity:** High
**Confidence:** High
**Status:** Confirmed by real-card runtime reproduction and full-catalog scan

**Evidence**

- `packages/rules/src/schema.ts:14-24` accepts any non-negative `rate` with no upper bound and any non-empty `unit`.
- `packages/core/src/calculator/reward.ts:120-127` always interprets `rate` as a percentage and divides it by 100.
- `packages/core/src/calculator/reward.ts:168-172` implements `won_per_liter` as one `fixedAmount` per transaction because transaction volume is absent.
- `packages/rules/data/cards/ibk/oil-and-life.yaml:25-36` stores a “리터당 120원” benefit as `rate: 120`; a real 50,000원 fuel transaction consequently returns 60,000원 reward (120% of spend).
- `packages/rules/data/cards/hana/1q-special-plus.yaml:37-91` stores fixed 5,000/1,000원 benefits in the percentage `rate` field.
- `packages/rules/data/cards/samsung/id-auto.yaml:35-49` and `packages/rules/data/cards/samsung/gongmu-pension.yaml:31-40` use `fixedAmountPerLiter`. Zod strips that unknown tier field, leaving `rate`, `fixedAmount`, and `unit` all null, so those benefits become zero.
- The catalog contains seven tier rates above 100 (maximum 5,000), 34 `won_per_liter` tier entries across 17 cards, and three `fixedAmountPerLiter` entries.

**Concrete failure**

An Oil & Life card with a 50,000원 GS칼텍스 transaction returns a 60,000원 discount. If that transaction is manually categorized to the rule's key, this impossible value can dominate the optimizer. Conversely, the Samsung `fixedAmountPerLiter` benefits are stripped and return no reward.

**Fix**

Replace the open-ended rate/unit shape with a discriminated union such as percentage, fixed-per-transaction, fixed-per-day, mileage-per-spend, and fuel-per-liter. Reject percentage rates above 100. Until fuel volume exists, mark per-liter benefits explicitly unsupported and exclude them from ranking rather than inventing a one-transaction approximation. Migrate and lint all existing catalog entries.

---

### CR-03 — Duplicate reward rules and inert notes make authored conditions unreachable

**Severity:** High
**Confidence:** High
**Status:** Confirmed by full-catalog scan

**Evidence**

- `packages/core/src/calculator/reward.ts:42-54` evaluates only `minTransaction` and `specificMerchants`.
- `packages/core/src/calculator/reward.ts:67-94` selects exactly one rule, breaking equal-specificity ties by source order.
- `packages/core/src/calculator/reward.ts:38-40,275,300` keys monthly usage only by category/subcategory, so distinct conditional rules also share a cap implicitly.
- The catalog has 90 cards with duplicate category keys (91 groups), 69 groups with equal specificity, and 42 groups containing multiple unconditional rules. It also has 540 rules whose real restrictions are recorded only in an inert `conditions.note`.
- `packages/rules/data/cards/samsung/id-simple.yaml:22-38` has two unconditional `uncategorized` rules for transactions below/above 100,000원. No maximum-transaction condition exists, so the first 0.7% rule wins for every amount and the later 1.0% rule is unreachable.
- `packages/rules/data/cards/cu/eobuba-check.yaml:22-86` encodes Tuesday versus non-Tuesday behavior only in notes. Both rules otherwise overlap, so source order decides instead of the transaction day.

**Concrete failure**

A 200,000원 iD SIMPLE purchase receives 0.7% rather than the authored 1.0%. The CU card's Tuesday benefit may be applied on every day, while the weekday rule is never selected for the same merchants.

**Fix**

Give rules stable IDs and explicit cap-group IDs. Model maximum transaction, day-of-week, online/offline, occurrence limits, payment method, and other conditions as executable fields. Fail catalog validation when equal-priority rules overlap or when a note contains a restriction that is not represented structurally.

---

### CR-04 — Multi-month tier input ignores the user's override and bypasses per-card exclusions

**Severity:** High
**Confidence:** High
**Status:** Confirmed by cross-file control-flow inspection

**Evidence**

- `apps/web/src/components/upload/FileDropzone.svelte:577-580` promises that a manually entered previous-month amount overrides automatic multi-month detection.
- `apps/web/src/lib/analyzer.ts:381-419` instead chooses the second-latest uploaded month whenever two months exist and consults `options.previousMonthSpending` only for a single-month upload.
- It does not require the selected month to be the calendar month immediately preceding the latest month.
- `apps/web/src/lib/analyzer.ts:424-428` passes that raw aggregate as an explicit scalar.
- `apps/web/src/lib/analyzer.ts:228-235` applies any explicit scalar to every card, bypassing the card-specific exclusion calculation at lines 239-261.
- `apps/web/src/lib/store.svelte.ts:498-505,585-619` preserves the ignored manual value and starts using it after a category edit, so initial analysis and reoptimization can switch tiers without the input changing.

**Concrete failure**

For January and March uploads, January is treated as March's “previous month” even though February is missing. If the prior statement totals 500,000원 but includes 250,000원 of excluded tax/utility spending, every card receives 500,000원 and can qualify for a tier it did not earn. A manual 300,000원 override is ignored initially, then can take effect after an edit.

**Fix**

Represent the source explicitly: `{ kind: "user-total", amount }` versus `{ kind: "transactions", transactions }`. User input must have first precedence. For automatic mode, find the exact previous calendar month and compute a per-card map from those transactions after exclusions; do not collapse derived data to one scalar.

---

### CR-05 — ISO dates in HTML tables become `Date` objects and are emitted as invalid strings

**Severity:** High
**Confidence:** High
**Status:** Confirmed in both server and browser parsers with an in-memory reproduction

**Evidence**

- `packages/parser/src/html/index.ts:44-48,82-84` and `apps/web/src/lib/parser/html.ts:62-66,101-103` let SheetJS infer HTML cell types.
- An ISO cell such as `2026-01-01` is returned by SheetJS as a `Date`.
- Both implementations stringify it during forward fill (`packages/parser/src/html/index.ts:185-192`; `apps/web/src/lib/parser/html.ts:196-203`) and send that display string to the string-only date parser (`packages/parser/src/html/index.ts:257-267`; `apps/web/src/lib/parser/html.ts:267-276`).
- They report an error but still append the transaction.
- The XLSX parsers already have the necessary `Date` branch at `packages/parser/src/xlsx/index.ts:62-75` and `apps/web/src/lib/parser/xlsx.ts:216-229`.

**Concrete failure**

The same one-row HTML input produced this transaction in both implementations:

`date: "Thu Jan 01 2026 00:00:00 GMT+0900 (Korean Standard Time)"`

Downstream month grouping then uses the first seven characters (`apps/web/src/lib/analyzer.ts:381-397`), creating a bogus `Thu Jan` month.

**Fix**

Use a shared unknown-value date coercer before string conversion, including the existing `Date` branch. Reject rather than append any transaction whose final date fails `isValidISODate`. Add server/web parity cases for hyphenated HTML dates.

---

### CR-06 — HTML/XLSX forward-fill can fabricate transactions from note rows

**Severity:** High
**Confidence:** High
**Status:** Confirmed in both HTML parsers; identical unsafe logic exists in both XLSX parsers

**Evidence**

- `packages/parser/src/html/index.ts:179-237` and `apps/web/src/lib/parser/html.ts:192-248` forward-fill date, merchant, category, installments, memo, and amount on every partially empty row.
- `packages/parser/src/xlsx/index.ts:286-394` and `apps/web/src/lib/parser/xlsx.ts:459-567` do the same without consulting SheetJS `!merges`.
- The blank-row guard uses truthiness (`packages/parser/src/html/index.ts:152-164`, `packages/parser/src/xlsx/index.ts:305-317`), whereas the later helper defines whitespace-aware emptiness.

**Concrete failure**

Given a valid 50,000원 row followed by `<tr><td></td><td>할부 안내 문구</td><td></td></tr>`, both HTML parsers emitted a second 50,000원 transaction whose merchant was `할부 안내 문구`. A whitespace-only spreadsheet spacer can inherit every field and duplicate the previous transaction.

**Fix**

Use SheetJS merge ranges to forward-fill only cells genuinely covered by a merge. At minimum, use the whitespace-aware blank check, never forward-fill amount indiscriminately, and require a transaction signal (explicit amount plus explicit or merge-backed date/merchant) before emission.

---

### CR-07 — PDF per-row header fallback updates indexes but parses stale values

**Severity:** Medium
**Confidence:** High
**Status:** Confirmed by code inspection; fixture validation still required

**Evidence**

- Server: `packages/parser/src/pdf/index.ts:106-125` reads `dateValue` and `amountValue`, then changes `dateIdx`/`amountIdx`; lines 127 and 193 continue using the stale values.
- Browser: `apps/web/src/lib/parser/pdf.ts:307-321` has the same ordering; lines 323 and 386 use the stale values.

**Concrete failure**

If a header says date is column 0 and amount is column 3, but one row shifts them to columns 1 and 4, the fallback correctly discovers indexes 1/4. The row is nevertheless skipped because `dateValue` still came from column 0, or its amount is parsed from the old column 3.

**Fix**

Finalize and bounds-check indexes first, then read cell values. Add a parity fixture with a shifted row under a recognized header.

---

### CR-08 — Card detail renders catalog percentages 100× too high and fixed benefits as 0%

**Severity:** Medium
**Confidence:** High
**Status:** Confirmed by direct formatter execution

**Evidence**

- Catalog rates are percentages; `packages/core/src/calculator/reward.ts:120-127` converts `0.7` to `0.007`.
- `apps/web/src/components/cards/CardDetail.svelte:48-57,239-250` passes the raw catalog value to `formatPercent`.
- `apps/web/src/lib/formatters.ts:12-27` expects an already-decimal rate and multiplies by 100.
- `packages/rules/data/cards/samsung/id-simple.yaml:23-38` is a concrete 0.7/1.0% card.

**Concrete failure**

`formatPercent(0.7)` renders `70.0%`, and `formatPercent(null)` renders `0.0%`. The card page therefore shows 0.7% as 70% and hides fixed-amount/mileage benefits behind a false 0% label.

**Fix**

Add a catalog-tier formatter: percentage values should render as `${rate}%`; fixed benefits should render `fixedAmount` plus `unit`. Keep the existing decimal formatter only for calculated effective rates.

---

### CR-09 — The scraper is guaranteed to author 100×-small rates and stale conditions

**Severity:** High
**Confidence:** High
**Status:** Confirmed latent code path; current catalog contains no `llm-scrape` records

**Evidence**

- `tools/scraper/src/prompts/system.ts:34,74-80` instructs 5% to be emitted as `0.05`.
- `tools/scraper/src/prompts/schemas.ts:76-84` enforces `rate <= 1` and describes `0.05 = 5%`.
- Runtime divides authored rates by 100 (`packages/core/src/calculator/reward.ts:120-127`), turning 0.05 into 0.0005 (0.05%).
- The prompt's category list (`tools/scraper/src/prompts/system.ts:46-72`) uses stale bare IDs such as `cafe`, `fuel`, `transport`, `department`, and `overseas`.
- It asks for `excludeOnline` (`tools/scraper/src/prompts/system.ts:37-40`; `tools/scraper/src/prompts/schemas.ts:96-105`), but the calculator explicitly ignores that condition (`packages/core/src/calculator/reward.ts:46,62`).
- `tools/scraper/src/validators.ts:34-97` does not validate category reachability, rate units, or executable conditions, and `tools/scraper/src/writer.ts:10-46` writes the accepted result directly.

**Concrete failure**

The next scraped “5% online discount, online exclusions apply” rule is stored as `0.05`, calculated as 0.05%, may use an unreachable category, and may ignore the exclusion.

**Fix**

Generate the LLM tool schema and category descriptions from the same runtime contract. Add a conversion layer with explicit units and reject fields the calculator cannot execute. Run the same semantic catalog linter before writing.

## Coverage and validation

- Inventoried all 920 tracked, non-`.context` files: 152 TypeScript/Svelte/Astro/JavaScript files, 43 test/E2E files, 686 YAML files (683 card rules), 32 JSON/generated-data files, plus configs, docs, fixtures, styles, and assets.
- Read every implementation area: core calculator/categorizer/optimizer, rules/schema/loaders/data, all server and web parsers, analyzer/store/cards/UI paths, visualization, CLI, scraper, generator scripts, and test suites.
- Mechanically parsed all 683 card YAML files and all four keyword corpora; runtime schema loading succeeds for 683/683, demonstrating that structural validation currently misses the semantic defects above.
- `bun run --cwd apps/web typecheck`: 0 errors, 0 warnings, 0 hints.
- Dynamic checks were in-memory Bun executions only. No Playwright, Chrome, browser, deployment, or source mutation was performed.
- Final missed-issues sweep covered duplicate keys, taxonomy reachability, reward units/ranges, exclusion values, parser parity, scalar provenance, and UI rate consumers.
