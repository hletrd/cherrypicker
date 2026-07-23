# Review–Plan–Fix Cycle 6 — Verifier Review

- Date: 2026-07-24
- Baseline: `449f10a2faffaae2a2c47036070b0e61a5b6eec2`
- Lens: independent end-to-end verification, boundary consistency, executable failure cases, and regression-test adequacy
- Scope: review only; no product source, tests, plans, generated artifacts, or protected prior-cycle evidence changed

## Inventory and coverage

I built an independent tracked-file inventory before reviewing implementation details:

- 2,151 tracked paths
- 1,056 Markdown files, 685 YAML files, 280 TypeScript files, 59 JSON files, 14 Svelte files, 13 JavaScript files, 13 CSV files, and 6 Astro files
- Main implementation areas: 733 rules paths (including 683 card YAML files), 147 web-app paths, 86 parser paths, 34 core paths, 33 scraper paths, 26 CLI paths, 18 scripts, and 12 visualization paths

I read the repository instructions and product contract first: `.claude/CLAUDE.md`, `.claude/AGENTS.md`, `README.md`, the root and workspace manifests, TypeScript/test/build configuration, and the deploy workflow. I then traced the supported statement formats and authoring/publication paths through:

- parser server/browser entry points, format detection, CSV/XLSX/PDF/JSON/OFX helpers, amount/date normalization, and parser tests;
- CLI analyze/optimize/report preparation, card-catalog selection, validation, output rendering, and command tests;
- web upload, worker, analyzer, persistence/store, results, catalog-reader, and optimizer boundaries;
- core categorization, analysis context, calculator/optimizer, performance qualification, and tests;
- rules schema, loader, semantic validation, artifact loaders, authored catalog, and publication checks;
- scraper extraction, validation, network policy, writer flow, and tests;
- visualization aggregation/terminal/report sinks, scripts, generated-artifact gates, and end-to-end regression coverage.

Generated and high-volume data was reviewed by schema/semantic boundaries, inventory queries, representative sampling, and the existing deterministic data gates. Cycle 5 review/plan evidence was checked before recording findings so closed historical findings were not repeated.

## Findings

### C6-VR-001 — OFX statement currency is discarded and every amount is later treated as Korean won

- Severity: High
- Confidence: High
- Status: Confirmed
- Code regions:
  - `packages/parser/src/ofx/index.ts:43-169`
  - `apps/web/src/lib/parser/ofx.ts:24-127`
  - `tools/cli/src/analysis.ts:31-55`
  - `apps/web/src/lib/analyzer.ts:125-153`

Both OFX implementations extract transaction date, amount, name, memo, and type, but never read the statement-level `<CURDEF>` field. `RawTransaction` therefore carries no currency. The CLI and web conversion boundaries then unconditionally add `currency: 'KRW'`.

This crosses a correctness boundary, not just a display boundary. The parser describes OFX as supporting international-bank exports, while the product contract and reward engine interpret numeric amounts as integer Korean won. A valid foreign-currency statement is silently accepted and its raw numeric amount is optimized as won.

Executable failure case:

```text
Input: <CURDEF>USD ... <TRNAMT>-100.00 ... <NAME>FOREIGN STORE
Actual parse result:
{"date":"2026-07-23","merchant":"FOREIGN STORE","amount":100,"category":"출금"}
errors: []
```

The subsequent CLI/web conversion labels that transaction `KRW`, so USD 100 becomes KRW 100 rather than being rejected or converted.

Suggested fix:

1. Parse and retain statement/account currency at the shared OFX boundary.
2. Because there is no trusted exchange-rate contract, fail closed with an actionable parse error when currency is absent or is not KRW; alternatively add an explicit, auditable conversion contract before accepting it.
3. Remove unconditional KRW assignment where the upstream format can declare another currency.
4. Add server/browser parity tests for KRW, USD, missing `<CURDEF>`, bank statements, and credit-card statements, plus CLI/web integration tests proving foreign currency cannot reach optimization.

### C6-VR-002 — `analyze` reports successful analysis for a statement with zero parsed transactions

- Severity: Medium
- Confidence: High
- Status: Confirmed
- Code regions:
  - `tools/cli/src/commands/analyze.ts:32-68`
  - `tools/cli/src/index.ts:53-78`
  - `packages/viz/src/terminal/summary.ts:19-50`
  - Contrast: `tools/cli/src/analysis.ts:58-70`

`runAnalyze` prints parse warnings but does not reject an empty transaction set. It categorizes the empty array and calls the visualization sink, whose unconditional total row renders `0원`, zero transactions, and `100.0%`. Because no exception is thrown, the CLI exits successfully. The optimize/report preparation path already rejects inputs with no valid transaction dates, so the three statement commands disagree about what constitutes a successful parse.

Executable failure case:

```text
$ bun tools/cli/src/index.ts analyze /dev/null
파싱 경고:
  빈 파일입니다.
파싱된 거래 수: 0건
...
합계  0원  0  100.0%
exit status: 0
```

This can make a malformed, empty, or unsupported export appear successfully analyzed to a person or automation that relies on the process status. The `100.0%` total further gives a false-success presentation.

Suggested fix:

1. After surfacing parse diagnostics, throw an actionable error when `parseResult.transactions.length === 0`.
2. Keep empty-state rendering defensive, but do not use a normal 100% total row for no data.
3. Add fresh-process CLI tests asserting exit status 1 and absence of a spending summary for empty and fully unparseable inputs, while preserving status 0 for a valid statement.

### C6-VR-003 — Future `lastUpdated` values bypass the shared authoring and custom-CLI catalog boundary

- Severity: Medium
- Confidence: High
- Status: Confirmed
- Code regions:
  - `packages/rules/src/schema.ts:12-23,246-260`
  - `packages/rules/src/loader.ts:11-59`
  - `packages/rules/src/catalog-validation.ts:17-45,74-391`
  - `tools/cli/src/card-catalog.ts:30-58,76-83`
  - Inconsistent stricter boundaries: `scripts/catalog-publication.ts:148-172` and `tools/scraper/src/validators.ts:23-64`

The shared schema checks only that `lastUpdated` is a real ISO calendar date. The shared loader and semantic catalog validator add no clock-aware rule. Therefore the CLI's `--cards` authoring path accepts future-dated rules even though it tells the user those YAML files were recursively validated. Publication and scraper validation independently reject future dates, so authoring tools do not share one semantic trust boundary.

Executable failure case used the existing `kdb/choice-check.yaml`, changed only `card.lastUpdated` to `2099-01-01`, then ran `cardRuleSetSchema.parse` and `validateCardCatalog`:

```json
{"accepted":true,"lastUpdated":"2099-01-01"}
```

An accidental year typo or misleading freshness claim can therefore enter custom CLI optimization and appear validated. It may also survive any tooling that relies on `loadAllCardRules` plus `validateCardCatalog`, even though the publication-only path would later reject the same object.

Suggested fix:

1. Put the future-date rule in one clock-aware semantic validation boundary used by publication, scraper output, and custom CLI authoring catalogs.
2. Inject the clock for deterministic tests; reject an invalid clock and dates after the injected current day.
3. Add loader/catalog and CLI `--cards` tests, then make the publication and scraper checks delegate to the shared rule rather than carrying independent copies.

## Executed verification

| Check | Result | Relevance |
|---|---:|---|
| `bun test packages/parser/__tests__/ofx.test.ts apps/web/__tests__/ofx-parser.test.ts` | 24 pass, 0 fail (the named web test path does not exist, so Bun ran the server suite) | Existing OFX coverage omits currency |
| `bun test tools/cli/__tests__/commands.test.ts tools/cli/__tests__/analysis.test.ts` | 34 pass, 0 fail | Existing CLI tests omit empty fresh-process `analyze` |
| `bun test packages/rules/__tests__/schema.test.ts packages/rules/__tests__/catalog-validation.test.ts` | 75 pass, 0 fail | Existing shared validation tests omit future dates |
| USD `<CURDEF>` OFX probe | accepted; amount 100; no errors | Confirms C6-VR-001 |
| `analyze /dev/null` fresh-process probe | exit 0; zero-row 100% summary | Confirms C6-VR-002 |
| future-date schema + semantic-validator probe | accepted `2099-01-01` | Confirms C6-VR-003 |

Passing tests were treated as evidence about covered behavior, not evidence that adjacent boundaries were correct. Comments claiming parity or validation were checked against executable paths.

## Final missed-issue sweep

The bounded final sweep rechecked currency creation sites, zero/empty success paths, swallowed exceptions, unsafe casts and suppression markers, parser date inference, publication/scraper/CLI validator divergence, terminal aggregation, and recent Cycle 5 fix regions. I also compared these candidates with prior review findings to avoid stale duplicates. No additional issue met the threshold for a distinct, evidence-backed finding; intentional short-date year inference remains a documented heuristic and was not promoted without a stronger product contract.

Final count: 3 findings — 1 High, 2 Medium; all confirmed with High confidence.
