# Cycle 5 — Critic

**Review target:** `e3aa4241bbdc9c9b1dc3abff0df78e0cc9f8d715`
**Comparison base:** `e6fe49bb5d981d422f5b55bd855e87f0234ac13e` (`origin/main`)
**Lens:** independent multi-perspective critique of whether the current product gives users, data curators, and downstream consumers a truthful, feasible, recoverable result.

## Inventory and approach

This lens used the same pre-built **1,107-artifact** current-code inventory as the Code Reviewer: root/config/docs 14; web 142; E2E 15; core 34; parser 83; rules 732; viz 10; scripts 18; CLI 26; scraper 33. The `origin/main...HEAD` change surface contains 1,084 paths, including 707 card-rule sources, 109 tests/E2E files, 68 web runtime files, 28 generated web artifacts, and all parser/core/CLI/scraper/publication work.

Every review-relevant runtime, build, config, test, fixture, and documentation path was inventoried. Handwritten paths were inspected through the complete user/data flows; all 683 YAML files and every generated catalog projection were exercised through exhaustive validation and publication checks rather than sampling. The authoritative `.claude/AGENTS.md`, `.claude/CLAUDE.md`, README product claims, terminal output, web dashboard/report, standalone report, and both changed screenshots were checked. Historical review files were consulted only to exclude closed findings.

## Findings

### C5-CT-001 — “Savings” optimize an imaginary 683-card, zero-cost portfolio and can include a discontinued card

- **Severity:** High
- **Confidence:** High
- **Validation status:** Confirmed by full-catalog query, executable optimizer probe, and web/CLI/UI trace; no manual validation required
- **Location:** annual-fee/discontinued contract `packages/rules/src/schema.ts:233-247`; optimizer objective `packages/core/src/optimizer/greedy.ts:255-401`; full-catalog web call `apps/web/src/lib/analyzer.ts:203-224`; default UI call without `cardIds` `apps/web/src/components/upload/FileDropzone.svelte:287-319`; CLI call `tools/cli/src/commands/optimize.ts:76-101` and `tools/cli/src/commands/report.ts:81-119`; benefit claims `apps/web/src/components/dashboard/SavingsComparison.svelte:189-245`, `apps/web/src/components/report/ReportContent.svelte:63-79`, `packages/viz/src/report/generator.ts:253-269`; discontinued projection loss `scripts/catalog-publication.ts:193-240` and `apps/web/src/lib/cards.ts:21-34,62-76`

The card contract carries domestic/international annual fees and a `discontinued` flag, but neither participates in the optimization universe or objective. Web analysis loads all optimizer rules unless an internal `cardIds` option is supplied; the upload UI supplies only bank and previous spending. CLI optimization likewise loads the complete compiled catalog. Adding another card is therefore free, ownership/acquisition is assumed, and availability is not enforced.

A complete artifact query found:

- 683 cards in the default optimizer catalog;
- 541 with a positive domestic annual fee;
- annual fees up to 2,000,000 won;
- one explicitly discontinued rule, `bc-goat`, still present in the optimizer, details, and card-summary population.

The summary projection drops `discontinued`, and the card grid has no way to label or exclude that card.

**Concrete failure scenario:** Two 100,000-won-fee cards each give 1% in a different category, while one free card gives 0.5% in both. For two 10,000-won transactions, the current optimizer assigns both paid cards and reports 200 won of monthly benefit plus 100 won/1,200 won of monthly/annual “additional savings” over one card. The extra annual fee is 100,000 won, so the incremental net is **-98,800 won**, not +1,200 won. A user has no ownership/card-count input and no disclosure that these are gross rewards before annual fees.

This contradicts the README's “내 소비에 맞는 카드 조합,” “가장 이득,” and “얼마나 더 아낄 수 있는지” claims (`README.md:19-35`) and the UI's “추가 절약”/“실효 혜택률” labels.

**Suggested fix:** Make the feasible portfolio explicit. At minimum, ask for owned/eligible cards and exclude discontinued cards from acquisition recommendations. If the product recommends new cards, model annual fees as fixed costs over a stated horizon and support a card-count/acquisition constraint. Until then, label every output “gross monthly rewards before annual fees,” remove net-savings language, and disclose that the calculation assumes access to every included card. Add tests where a marginal reward is lower than the fee and where a discontinued card cannot enter a recommendation or unlabeled list.

### C5-CT-002 — The transaction editor's advertised fallback writes phantom top-level categories

- **Severity:** Medium
- **Confidence:** High
- **Validation status:** Confirmed through deterministic component control flow plus an executable downstream reward comparison; real-browser interaction validation is still recommended
- **Location:** `apps/web/src/components/dashboard/TransactionReview.svelte:24-45,51-58,71-117,177-194,298-314`; downstream matching `packages/core/src/calculator/reward.ts:228-243`

The fallback dropdown contains qualified subcategory values such as `dining.cafe`, but `subcategoryToParent` starts empty and is populated only after a successful taxonomy fetch. Both documented fallback branches install options/groups/labels without installing that parent map. `changeCategory()` therefore treats `dining.cafe` as a top-level category and writes:

```ts
{ category: "dining.cafe", subcategory: undefined, confidence: 1 }
```

instead of the canonical `{ category: "dining", subcategory: "cafe" }`.

**Concrete failure scenario:** A restored result is opened while `data/categories.json` temporarily fails. The fallback selector remains enabled, so the user corrects a transaction to “카페.” When connectivity recovers and the edit is applied, normal `category: dining` / `subcategory: cafe` rules do not match. A direct reward probe produced 1,000 won for the canonical pair and 0 won for the fallback-written pair.

**Suggested fix:** Materialize options, groups, labels, and the parent map together from either fetched taxonomy or fallback data. Initialize the fallback map before mount and use the same helper in both fallback branches. Add a component/E2E test that fails the taxonomy request, selects a subcategory, applies it after recovery, and asserts both the canonical stored pair and unchanged reward.

### C5-CT-003 — Scraper `--force` truncates the canonical rule before a replacement is durable

- **Severity:** Medium
- **Confidence:** High
- **Validation status:** Confirmed from the exact `open(2)` flags and write ordering; fault-injection integration/manual validation remains recommended
- **Location:** `tools/scraper/src/writer.ts:73-90,121-155`; default canonical destination `tools/scraper/src/cli.ts:80-85`; incomplete regression `tools/scraper/__tests__/writer.test.ts:95-145`; repository-safe comparison `tools/cli/src/report-output.ts:84-127`

The overwrite path opens the destination itself with `O_TRUNC`, then writes content directly. Truncation occurs when `open()` succeeds, before `writeFile()` completes and without a sync/rename commit boundary.

**Concrete failure scenario:** A curator uses `--force` to refresh an existing rule under `packages/rules/data/cards`. The process is killed, the disk fills, or a write error occurs after the destination is opened. The previous valid canonical YAML is already empty or partially overwritten; the next catalog build fails and the only prior rule is lost.

The CLI report writer in the same repository already demonstrates the appropriate pattern: exclusive sibling temp file, complete write and sync, destination recheck, atomic rename, and cleanup.

**Suggested fix:** Write and `fsync` an exclusive temporary file in the issuer directory, revalidate the destination immediately before atomic rename, and clean up on every failure. Preserve the current no-symlink/containment checks. Add injected pre-write, partial-write, sync, and pre-rename failures proving the original bytes survive.

### C5-CT-004 — The LLM scraper accepts impossible/future freshness dates and can publish them as catalog generation time

- **Severity:** Medium
- **Confidence:** High
- **Validation status:** Confirmed by direct validator execution and publication trace; current 683-card data is clean, so no manual remediation is required for existing artifacts
- **Location:** prompt requirement `tools/scraper/src/prompts/system.ts:15-24`; regex-only tool schema `tools/scraper/src/prompts/schemas.ts:76-85`; regex-only canonical schema `packages/rules/src/schema.ts:233-246`; validation boundary `tools/scraper/src/validators.ts:23-170`; conflicting writer date `tools/scraper/src/writer.ts:46-66`; publication metadata `scripts/build-json.ts:284-294`

The prompt tells the model to use today's date, but both schemas check only `YYYY-MM-DD` shape and the scraper's business validation performs no calendar/future check. The writer adds a trustworthy current `# 추출일` comment while serializing the model-authored `card.lastUpdated` unchanged. Publication then chooses the lexicographically greatest `lastUpdated` as `generatedAt`.

**Concrete failure scenario:** Direct validation accepts both `2026-99-99` and `2999-01-01`. One hallucinated value can therefore make all generated catalog metadata claim an impossible or far-future generation date, undermining freshness comparisons and release auditing even though the header records a different real date.

**Suggested fix:** Validate a real calendar date and reject future dates in the canonical schema/business layer. Prefer replacing `lastUpdated` at the trusted ingestion boundary with one injected clock value used by both YAML and header; do not trust the LLM to author provenance. Add invalid-day, leap-day, future-date, clock-injection, and header/YAML/publication consistency tests.

## Multi-perspective closure

- **End user:** Default recommendations are not a feasible or net-cost card portfolio, and a fallback edit can silently erase a valid subcategory benefit.
- **Data curator:** A forced scraper refresh is not failure-atomic, so routine maintenance can destroy the canonical prior rule.
- **Auditor/release consumer:** Model-authored dates can falsify catalog freshness metadata despite a contradictory trusted header.
- **Maintainer:** These are boundary-contract failures: portfolio feasibility is absent from the domain model, fallback taxonomy state is constructed piecemeal, durable replacement is implemented as in-place truncation, and provenance is accepted from the untrusted generator.

The final adversarial sweep checked whether disclosures elsewhere cured CT-001 (none mention annual fees, ownership, or gross-vs-net), whether cached taxonomy made CT-002 unreachable (restored/direct-route and transient-failure flows remain reachable), whether `--force` semantics authorized data loss (authorization to replace does not make in-place truncation atomic), and whether downstream Zod/domain checks rejected CT-004 (they retain the same regex-only rule). All four findings survived falsification. No source, plan, generated artifact, protected Cycle 42 file, or git state was modified.
