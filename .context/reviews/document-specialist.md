# Documentation and Contract Review — Cycle 1

**Reviewer:** document-specialist
**Date:** 2026-07-23
**Method:** Static repository review only; no external-source claims were introduced.

## Inventory

- Read the root README, all 18 issuer README files, all manifests/configuration, the deployment workflow, CLI/scraper help, exported types/JSDoc, and generator comments.
- Traced documentation claims through all 104 product source files and 43 test/E2E files.
- Scanned all 683 canonical card YAML files and compared their issuer counts/interfaces with both generated card catalogs, categories YAML/JSON, issuer metadata, and the generated fallback-label module.
- Current generated catalogs agree with one another at 683 cards / 24 issuers; the findings below concern stale public text or missing enforcement of that agreement.

## Findings

### DOC-01 — The README's issuer table accounts for only 561 of the advertised 683 cards

**Severity:** High
**Confidence:** High
**Status:** Confirmed issue

**Evidence**

- `README.md:12,27,37` advertises 683 cards.
- The 24 per-issuer counts at `README.md:55-68` sum to 561.
- The generated catalog confirms 683 cards (`apps/web/public/data/cards.json:4-6`) and differs for ten issuers. Examples: Shinhan is 80 (`:57-61`) rather than 65; KB is 67 (`:10146-10150`) rather than 47; Hyundai is 63 (`:19787-19791`) rather than 48; BC is 22 (`:71212-71216`) rather than 18.
- The other stale rows are Samsung 47→58, Lotte 47→55, Hana 45→61, Woori 42→52, IBK 35→43, and NH 34→49.

**Failure scenario**

Readers see mutually contradictory totals on the same page and cannot tell which issuers actually have meaningful catalog coverage. Contributors may also choose the wrong area based on outdated counts.

**Fix**

Generate the README issuer table from the canonical catalog as part of the data build/check, and assert that its row sum equals `meta.totalCards`.

### DOC-02 — Structured `paymentType` conditions are accepted and published but undocumented and ignored by reward calculation

**Severity:** High
**Confidence:** High
**Status:** Confirmed code/data contract mismatch

**Evidence**

- Ten YAML rewards encode `conditions.paymentType: overseas`; examples include `packages/rules/data/cards/kb/travelers-check.yaml:31-32`, `packages/rules/data/cards/nh/zgm-overseas.yaml:42-43`, and `packages/rules/data/cards/lotte/loca-for-travel.yaml:43-44`.
- `packages/rules/src/schema.ts:26-30` accepts unknown condition keys via `.passthrough()`, while `packages/rules/src/types.ts:22-27` documents only `minTransaction`, `specificMerchants`, and `note`.
- `packages/core/src/calculator/reward.ts:42-55` enforces only `minTransaction` and `specificMerchants`; `paymentType` never participates in matching or specificity.
- `README.md:23-27,35-38` presents the result as the best card for the user's spending without disclosing that a published structured condition is unsupported.

**Failure scenario**

A domestic transaction in the same category can receive an overseas-only rate, causing the optimizer and UI to recommend the wrong card while the YAML appears to describe the restriction correctly.

**Fix**

Make `paymentType` a documented typed field, carry the required transaction metadata through parsers, and enforce it in rule matching with tests. Until supported, reject such rules from the production catalog or explicitly mark the affected benefit unsupported in user-facing documentation.

### DOC-03 — `build-json.ts` claims authoritative validation but uses a weaker duplicate schema

**Severity:** High
**Confidence:** High
**Status:** Confirmed contract drift

**Evidence**

- `scripts/build-json.ts:1-9` says it validates all YAML against Zod schemas.
- Its local schema at `scripts/build-json.ts:20-81` permits any numeric rate (including negative), lacks the rate/fixed-amount mutual-exclusion refinement, and silently defaults missing `lastUpdated`, `source`, `performanceExclusions`, and global constraints.
- The canonical runtime schema rejects negative rates and mutually exclusive reward signals (`packages/rules/src/schema.ts:14-24`) and requires the core rule-set fields (`:41-71`).
- `README.md:121-122` directs contributors to run the generator, making its validation output part of the documented contribution workflow.

**Failure scenario**

A contributor runs the documented generator on malformed YAML. The generator reports success and publishes normalized JSON that the canonical loader would reject, leaving the browser and CLI on different rule contracts.

**Fix**

Delete the duplicate schema and import the canonical `cardRuleSetSchema` (plus explicit generator-only transformations after successful validation). Add a parity test proving every generator-accepted rule is loader-accepted.

### DOC-04 — The documented manual data build is not part of the actual build/deployment contract

**Severity:** Medium
**Confidence:** High
**Status:** Confirmed process mismatch; generated files are currently synchronized

**Evidence**

- `README.md:121-125` tells developers to run the data generator manually before the web server.
- `scripts/build-json.ts:381-451` writes the runtime catalogs and generated fallback-label source.
- `package.json:12-18` does not run that generator from `build` or `verify`.
- `.github/workflows/deploy.yml:34-39` verifies and builds the committed web artifacts without generating or checking them.

**Failure scenario**

The canonical YAML/category source changes, local tests pass, and deployment serves an older committed JSON/fallback module because the documented manual step was forgotten.

**Fix**

Define a single documented `data:build` command, invoke it from the web build or CI, and add a no-diff `data:check` gate. Document which files are generated and whether contributors should commit them.

### DOC-05 — The README's CLI example cannot succeed as written

**Severity:** Medium
**Confidence:** High
**Status:** Confirmed issue

**Evidence**

- `README.md:127-129` shows `bun run analyze` with no statement argument.
- That script forwards to the analyze command (`package.json:21`).
- `tools/cli/src/commands/analyze.ts:24-28` immediately throws unless a statement path is supplied.

**Failure scenario**

A new user follows the local-development instructions and receives an error instead of a first analysis, with no valid invocation on the README page to copy.

**Fix**

Show a complete command such as `bun run analyze -- ./statement.csv`, plus one PDF example documenting `--allow-remote-llm` and consent behavior.

### DOC-06 — Supported-format documentation and user-facing errors disagree with the parser

**Severity:** Medium
**Confidence:** High
**Status:** Confirmed issue

**Evidence**

- `README.md:33`, `apps/web/src/pages/index.astro:66`, and the invalid-upload message at `apps/web/src/components/upload/FileDropzone.svelte:226` name only CSV, Excel, and PDF.
- The same dropzone advertises and accepts JSON, OFX/QFX, and HTML (`FileDropzone.svelte:97-106,504-507`).
- `apps/web/src/lib/parser/index.ts:84-94` dispatches JSON, OFX, and HTML.
- The server parser's public JSDoc still says only CSV/XLSX/PDF (`packages/parser/src/index.ts:32-39`) despite dispatching the other formats at `:78-94`.

**Failure scenario**

Users with a supported OFX or JSON statement may convert it unnecessarily, while an unrelated invalid upload produces an error falsely claiming those formats are unsupported.

**Fix**

Create one shared supported-format definition for validation and UI text, update README/API JSDoc from it, and keep extension aliases (XLS, TSV, QFX, HTM) explicit.

### DOC-07 — Issuer README “card lists” are incomplete by large, undisclosed margins

**Severity:** Medium
**Confidence:** High
**Status:** Confirmed issue

**Evidence**

- `packages/rules/data/cards/dgb/README.md:5-14` presents one card under “카드 목록,” while the generated issuer record reports 21 (`apps/web/public/data/cards.json:74656-74660`).
- `packages/rules/data/cards/bc/README.md:5-33` lists 11 cards/files, while the catalog reports 22 (`apps/web/public/data/cards.json:71212-71216`).
- `packages/rules/data/cards/shinhan/README.md:5-23` lists 15 cards, while the catalog reports 80 (`apps/web/public/data/cards.json:57-61`).
- Only 18 of the 24 issuer directories have README files at all.

**Failure scenario**

The data directory presents a partial curated sample as a complete catalog. A contributor may conclude a rule is missing and create a duplicate, or overlook an existing card that is absent from the README.

**Fix**

Either generate complete issuer indexes or label these sections “대표 카드” and link to an auto-generated full list/count. Add README presence/completeness checks if per-issuer documentation is intended to be exhaustive.

### DOC-08 — Public architecture and product identity still contain removed/old names

**Severity:** Low
**Confidence:** High
**Status:** Confirmed issue

**Evidence**

- `README.md:86-104` lists `apps/web/src/lib/categorizer-ai.ts`, but no such file exists; production categorization is wired through `MerchantMatcher` in `apps/web/src/lib/analyzer.ts:1-17`.
- The project is branded “CherryPicker” throughout `README.md:3-27`, but CLI/scraper help still says “CardPick” (`tools/cli/src/index.ts:7-12`; `tools/scraper/src/cli.ts:53-69,96`).

**Failure scenario**

Contributors search for a nonexistent extension point, and users reasonably wonder whether the CLI/scraper belong to a different product.

**Fix**

Regenerate the project tree from current paths, describe the actual categorizer module, and standardize user-visible branding while retaining the `cherrypicker` executable name.

### DOC-09 — CI ignores the repository's declared Bun version

**Severity:** Medium
**Confidence:** High
**Status:** Reproducibility risk needing validation

**Evidence**

- `package.json:32` declares `packageManager: "bun@1.2.6"`.
- `.github/workflows/deploy.yml:23-25` installs `bun-version: latest`.

**Failure scenario**

Local reproduction on the declared toolchain and deployment verification run different Bun test/package-manager behavior. A newly released Bun can break or change the build without any repository change.

**Fix**

Pin CI to the declared version or configure setup to read the package-manager field, then document the supported Bun/Node versions in local-development instructions.

## Final missed-issue sweep

The remaining documentation drift is lower severity: several inline cycle/line references have moved, analyzer comments still describe the catalog as “< 500” although it contains 683 cards, and scraper help intentionally lists only the ten configured scrape targets without explaining that this is narrower than the 24-issuer catalog. All relevant documentation, configuration, generated/data interfaces, and product source families were covered.
