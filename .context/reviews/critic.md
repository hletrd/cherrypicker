# Repo-wide critical architecture / maintainability review

**Overall verdict: the repo is now running on multiple competing sources of truth.** The product value is real, but the architecture is drifting hard: parser behavior differs between web and CLI, category semantics differ between rules/core/scraper, generated artifacts are committed in conflicting states, and several packages advertise broader responsibility than they actually implement. This will slow every future parser fix, category change, or data refresh because there is no longer one canonical place to change anything.

## Critical

- **There is no single source of truth for parsing behavior anymore.** The browser parser is a fork of the package parser, not a consumer of it.
  - Duplicated parser types and bank signatures exist in both `apps/web/src/lib/parser/types.ts:1-41` / `packages/parser/src/types.ts:1-41` and `apps/web/src/lib/parser/detect.ts:3-161` / `packages/parser/src/detect.ts:5-151`.
  - The web parser openly admits it was copy-ported from the package parser: `apps/web/src/lib/parser/xlsx.ts:5-7`, `apps/web/src/lib/parser/pdf.ts:4-6`, `apps/web/src/lib/parser/pdf.ts:121-123`.
  - The two implementations already behave differently:
    - Web format detection is extension-only: `apps/web/src/lib/parser/detect.ts:107-112`.
    - Package format detection does byte sniffing and content inspection: `packages/parser/src/detect.ts:153-196`.
    - Web generic CSV heuristics scan more rows and a different header vocabulary: `apps/web/src/lib/parser/csv.ts:111-164`.
    - Package generic CSV heuristics are narrower: `packages/parser/src/csv/generic.ts:114-166`.
    - CLI PDF parsing escalates to Anthropic on failure: `packages/parser/src/pdf/index.ts:119-139`.
    - Web PDF parsing does not; it falls back to regex scraping only: `apps/web/src/lib/parser/pdf.ts:267-314`.
  - Hard truth: this is not “shared logic with environment-specific adapters.” It is a fork. Every bug fix now has to be rediscovered and re-applied twice.

- **The rules/category model is weakly enforced, while the scraper prompt already drifts from the canonical taxonomy.**
  - `packages/rules/src/schema.ts:27-31` accepts any `reward.category` as `z.string()`.
  - `tools/scraper/src/prompts/system.ts:46-72` defines category IDs like `convenience`, `transport`, `shopping`, `department`, `apartment`, `utility`, `overseas`, `leisure`, `golf`, `beauty`, `auto`.
  - Canonical taxonomy in `packages/rules/data/categories.yaml:1-472` uses different IDs such as `convenience_store`, `public_transit`, `offline_shopping`, `department_store`, `apartment_mgmt`, `utilities`, `travel_agency`.
  - The scraper validator never checks category IDs against taxonomy; it only validates shape/rates/tier references: `tools/scraper/src/validators.ts:32-99`.
  - `scripts/build-json.ts:212-216` only emits warnings for unknown categories instead of failing the build.
  - Result: the repo can accept semantically invalid category IDs into authored YAML and only “warn” while downstream code keeps going. That is exactly how silent model drift becomes permanent data debt.

- **Committed generated artifacts are already contradicting each other.**
  - Canonical generated rules export says `683` cards and `24` issuers: `packages/rules/data/cards.json:2-6`.
  - The web copy is an exact duplicate of that artifact: `apps/web/public/data/cards.json:1-6`.
  - But the so-called compact export is stale and claims `145` cards and `18` issuers: `packages/rules/data/cards-compact.json:2-6`.
  - Tests are still pinned to the stale world: `packages/rules/__tests__/schema.test.ts:191-195` expects exactly `145` rules.
  - The README and web defaults still hardcode `561` cards: `README.md:12`, `README.md:27`, `README.md:37`, `README.md:79`, `README.md:98`, `apps/web/src/layouts/Layout.astro:15-17`, `apps/web/src/pages/index.astro:7-9`.
  - This is the clearest proof that generated/source boundaries are broken: the repo can no longer tell you which artifact is current.

## High

- **The categorizer is now a giant override soup, not a coherent taxonomy engine.**
  - `packages/core/src/categorizer/matcher.ts:8-13` merges four massive keyword maps by object spread, so later files silently override earlier ones.
  - I found **471 conflicting duplicate keys** across `packages/core/src/categorizer/keywords*.ts`.
  - Example conflicts:
    - `GS25` → `convenience_store` in `packages/core/src/categorizer/keywords.ts:433`, but `offline_shopping` in `packages/core/src/categorizer/keywords-niche.ts:878`.
    - `이마트` → `grocery.supermarket` in `packages/core/src/categorizer/keywords.ts:364`, but `offline_shopping` in `packages/core/src/categorizer/keywords-niche.ts:872`.
    - `넷플릭스` → `streaming` in `packages/core/src/categorizer/keywords.ts:851`, but `subscription` in `packages/core/src/categorizer/keywords-niche.ts:913`.
    - `카카오택시` → `taxi` in `packages/core/src/categorizer/keywords.ts:707`, but `transportation` in `packages/core/src/categorizer/keywords-niche.ts:860`.
  - There are also **non-canonical target categories** that taxonomy does not define, e.g. `dining.bar` at `packages/core/src/categorizer/keywords-niche.ts:283-300`, `travel.accommodation` at `packages/core/src/categorizer/keywords-niche.ts:816-827`, and `travel.flight` at `packages/core/src/categorizer/keywords-niche.ts:833-848`.
  - On top of that, the keyword corpus is enormous (`keywords.ts` alone is 10,960 lines; total keyword tables are 13k+ entries), and matching still performs broad O(n) scans per transaction: `packages/core/src/categorizer/matcher.ts:40-52`, `packages/core/src/categorizer/taxonomy.ts:67-89`.
  - Hard truth: this is not maintainable categorization logic; it is a large, fragile exception pile with undocumented precedence rules.

- **The web app has drifted into locally re-declaring core/rules models and then casting around the mismatch.**
  - `apps/web/src/lib/cards.ts:3-37` redefines `CardRuleSet` instead of consuming a shared browser-safe type.
  - `apps/web/src/lib/cards.ts:109-115` defines `CategoryNode` with a required `label` field that is not present in `apps/web/public/data/categories.json` (which has `labelKo`/`labelEn`).
  - `apps/web/src/lib/analyzer.ts:31-37` and `apps/web/src/lib/analyzer.ts:97-99` then paper over that with `as unknown as` casts.
  - This means type safety has already been traded away exactly where cross-package drift is highest.

- **Optimization is presented as more principled than it really is.**
  - `packages/core/src/optimizer/index.ts:23-35` exposes an `ilp` method.
  - `packages/core/src/optimizer/ilp.ts:1-48` is a stub that delegates straight back to greedy.
  - `packages/core/src/optimizer/greedy.ts:59-113` scores cards using synthetic one-category transactions, then greedily locks assignments in `packages/core/src/optimizer/greedy.ts:134-159`.
  - Only afterwards does it recompute per-card summaries/caps in `packages/core/src/optimizer/greedy.ts:177-205`; assignments are **not** revisited.
  - So global/monthly cap coupling is fundamentally under-modeled. The API suggests “optimization”; the implementation is “independent category ranking with a post-hoc summary.”

- **Rate semantics are not crisp, and the tests prove maintainers are confused about them.**
  - `tools/scraper/src/prompts/system.ts:76` says percentages must be converted to decimals.
  - `packages/rules/__tests__/schema.test.ts:44` still uses `rate: 5.0` as valid fixture data.
  - `packages/core/__tests__/calculator.test.ts:48-70` contains a long comment thread essentially admitting uncertainty about whether `rate` means decimal, percentage, or capped multiplier.
  - When the test suite itself documents semantic confusion, the data model is not stable.

## Medium

- **The support matrix is scattered and misleading.**
  - `packages/parser/src/types.ts:1-2` advertises 24 `BankId`s.
  - CSV adapters only exist for 10 issuers in `packages/parser/src/csv/index.ts:16-27` (and likewise only 10 duplicated adapters in `apps/web/src/lib/parser/csv.ts:215-842`).
  - The scraper CLI only supports 10 issuers: `tools/scraper/src/cli.ts:61-69`, `tools/scraper/src/cli.ts:81-84`.
  - Meanwhile `packages/rules/data/issuers.yaml:1-120` and `packages/rules/data/cards.json:2-6` operate on 24 issuers.
  - Adding one new issuer means touching unions, bank detection, xlsx configs, CSV adapters, CLI help text, scraper targets, and possibly duplicated web parser code. That is the opposite of scalable monorepo boundaries.

- **Static presentation metadata duplicates taxonomy instead of deriving from it.**
  - `packages/core/src/optimizer/greedy.ts:7-50` hardcodes `CATEGORY_NAMES_KO`; it already misses canonical IDs like `general`, `travel_agency`, and `apartment_mgmt`.
  - `apps/web/src/lib/formatters.ts:73-98` hardcodes category icons and misses 24 canonical categories/subcategories.
  - This is avoidable drift: the repo already has a canonical taxonomy file.

- **CLI command boundaries are copy-pasted, not modular.**
  - `tools/cli/src/commands/analyze.ts:34-80`, `tools/cli/src/commands/optimize.ts:56-113`, and `tools/cli/src/commands/report.ts:62-122` repeat the same parse → categorize → map types pipeline.
  - They also all carry the same ugly type-level workaround around `parseStatement`: `tools/cli/src/commands/analyze.ts:39`, `tools/cli/src/commands/optimize.ts:61`, `tools/cli/src/commands/report.ts:67`.
  - `tools/cli/src/commands/scrape.ts:51-65` shells out to `tools/scraper/src/cli.ts` via a relative path instead of importing a library API. That is a boundary smell, not a reusable tool design.

- **The rules loader can silently downgrade the catalog.**
  - `packages/rules/src/loader.ts:32-45` uses `Promise.allSettled`, logs warnings, and returns partial success.
  - In a 683-card dataset, partial loading is not a recoverable detail; it can materially change optimization results while still “working.”

## Structural risks

1. **Every domain concept exists in 2–4 places.** Bank IDs, parser types, category IDs, category labels, icons, card counts, and card schemas are duplicated across rules, core, web, scraper prompts, tests, and docs.
2. **Generated data is checked in as if it were source, but without source-of-truth discipline.** That guarantees drift unless generation is enforced and artifacts are either authoritative or disposable. Right now they are both.
3. **The repo is biased toward additive patching, not substitution.** Instead of one parser surface with environment adapters, it grew a second parser. Instead of one category model, it grew prompt-local and keyword-local variants. Instead of one card metadata source, it grew YAML + generated JSON + web JSON + stale compact JSON + hardcoded counts.
4. **Keyword tables are already too large for manual reasoning.** Once a classification system reaches thousands of overlapping literals without machine-checked conflict rules, future edits become roulette.
5. **The optimization layer is not ready for more realistic benefit rules.** As soon as card interactions, cross-category caps, online/offline splits, exclusions, or issuer-specific edge cases expand, the current greedy/synthetic architecture will become harder to trust than to rewrite.

## Most urgent refactors

1. **Kill the parser fork.** Extract a shared parser core with thin environment adapters (Node file IO vs browser `File`/`ArrayBuffer`, pdf extraction backend, optional LLM fallback). Stop maintaining `apps/web/src/lib/parser/*` as a manual clone of `packages/parser/src/*`.
2. **Make category IDs a hard contract.** Validate `reward.category` against taxonomy in `@cherrypicker/rules`; fail builds on unknown categories; make the scraper prompt consume/generated from canonical taxonomy instead of embedding its own category glossary.
3. **Choose what generated artifacts are authoritative.** If `cards.json` is the published build artifact, generate it once and copy it in CI; do not commit multiple independently drifting snapshots. Remove or regenerate `packages/rules/data/cards-compact.json` immediately.
4. **Replace giant raw keyword tables with a compiled categorizer asset.** Keep authored sources structured, detect duplicate keys/conflicting targets in CI, and compile to one canonical lookup table with explicit precedence rules.
5. **Stop duplicating display metadata.** Category labels/icons should derive from taxonomy, not from `packages/core/src/optimizer/greedy.ts` and `apps/web/src/lib/formatters.ts`.
6. **Be honest about the optimizer.** Either expose only greedy and document the limitation, or build a real constrained solver. The current `ilp` surface is misleading.
7. **Move shared CLI workflows into libraries.** `analyze`, `optimize`, and `report` should share one transaction-loading/categorization pipeline; `scrape` should call a library, not a subprocess.

## Final hard truth

Right now the repo still works mostly because the maintainers carry a lot of tribal knowledge and keep patching all the copies by hand. That does not scale. The next major feature wave will not be slowed by TypeScript or Astro or YAML; it will be slowed by the repo no longer knowing which layer owns the truth.
