# Cycle 2 end-to-end trace review

Date: 2026-07-23
Role: tracer
Result: 2 new findings (1 High, 1 Medium)

## Scope and inventory

I inventoried and inspected the full tracked implementation path rather than sampling it:

- Web: 56 `apps/web/src` files, 3 public runtime scripts, 24 web tests, and 9 E2E files.
- Domain packages: core 22 source/5 test files; parser 25 source/48 test files; rules 11 source/5 test files plus all 683 card YAML records and 24 issuer indexes; viz 5 source/1 test file.
- Tools: CLI 9 source/2 test files; scraper 11 source/9 test files; 16 scripts and their test cases.
- Boundaries/config/docs: root and workspace manifests, lockfile, TypeScript configs, Astro/Playwright/Bun config, deployment workflow, root/issuer READMEs, and repository instructions.

The principal traces were:

```text
file bytes -> format/bank detection -> parser -> raw transaction
  -> merchant categorization -> constraint construction -> optimizer
  -> terminal summary / generated HTML

web upload(s) -> shared analysis context
  -> valid-date partition -> latest calendar month
  -> per-card previous-month basis -> optimizer -> session-backed results UI
```

Cycle 1's broad reward matching, unsupported prose-condition handling, PDF sign handling, stale PDF cell state, reoptimization scope, and path-containment fixes are present and were not re-reported.

## Findings

### C2-TR-01 — CLI optimization/reporting pool every input month into one monthly-cap run

- Severity: **High**
- Confidence: **High**
- Status: **Confirmed**
- Location:
  - `packages/parser/src/json/index.ts:174-180,241-248`
  - `packages/parser/src/index.ts:47-59,79-82`
  - `tools/cli/src/commands/optimize.ts:99-132`
  - `tools/cli/src/commands/report.ts:106-146`
  - `packages/core/src/calculator/reward.ts:372-377,457-458,514-541`
  - Contrast: `apps/web/src/lib/analysis-context.ts:98-116,143-153` and `apps/web/src/lib/analyzer.ts:373-395`

End-to-end evidence:

1. The supported JSON format accepts an arbitrary direct transaction array, including records from multiple months.
2. Both CLI paths map **all** `parseResult.transactions` into one `categorized` array and pass it to one `buildConstraints`/`optimize` invocation. Neither validates a single calendar month nor partitions the data.
3. The reward calculator creates one `ruleMonthUsed` map and one `globalMonthUsed` accumulator for the entire supplied array. It does not key either tracker by transaction month.
4. A focused probe with one January and one February ₩10,000 transaction and a 10%/₩1,000 monthly cap produced:

   ```json
   {"pooledTotalReward":1000,"pooledTotalSpending":20000,"perMonthRewards":[1000,1000],"perMonthTotal":2000}
   ```

5. The web path already establishes the correct contract: it partitions valid dates, selects `latestTransactions`, derives the exact previous calendar month, and optimizes only the latest month.

Failure scenario:

A user passes a multi-month JSON export (or any statement containing a wider date range) to `cherrypicker optimize` or `report`. January can consume February's monthly category/global caps, all months are labeled as one spending total, and one previous-spending value is applied to the combined run. The recommended card and reported savings can therefore differ materially from either month's valid result.

Competing hypothesis:

The CLI may have been intended for one monthly statement at a time. That constraint is neither validated nor documented at the boundary, while the accepted JSON contract explicitly permits arrays without a period restriction. Silently applying monthly rules to a multi-month array is unsafe even if single-month files are the common case.

Suggested fix:

Move the web's calendar partitioning contract into a shared package and use it from CLI and web. For `optimize`/`report`, either optimize the latest valid month and derive the previous calendar month's per-card basis, or reject multi-month input with an explicit actionable error/flag. Add integration tests for adjacent months, month gaps, out-of-order rows, monthly category caps, global caps, and report totals.

### C2-TR-02 — Invalid-date rows are warned about but still influence CLI recommendations and reports

- Severity: **Medium**
- Confidence: **High**
- Status: **Confirmed**
- Location:
  - `packages/parser/src/json/index.ts:141-148,241-248`
  - `packages/parser/src/csv/adapter-factory.ts:153-174`
  - `packages/parser/src/csv/generic.ts:238-265`
  - `packages/parser/src/ofx/index.ts:179-182,205-243`
  - `tools/cli/src/commands/optimize.ts:84-87,99-132`
  - `tools/cli/src/commands/report.ts:91-94,106-146`
  - Contrast: `apps/web/src/lib/analysis-context.ts:98-106`

End-to-end evidence:

1. These parser paths add a `ParseError` for an invalid nonempty date but still construct and append the transaction.
2. CLI `optimize` and `report` print the warning, then map the complete transaction array and continue to produce recommendations/totals.
3. The calculator validates dates only for rules that specifically require calendar semantics; ordinary category/rate rules still add the amount and reward.
4. A focused JSON probe with `2026-02-30` returned:

   ```json
   {"transactions":1,"errors":1,"date":"2026-02-30","amount":100000,"error":"날짜를 해석할 수 없습니다: 2026-02-30"}
   ```

5. The web analysis-context boundary explicitly separates `invalidDateTransactions` and excludes them from the optimization set, so identical logical input has different financial semantics by surface.

Failure scenario:

A malformed or OCR-derived date accompanies a large valid amount. The user sees a warning but still receives a normal-looking CLI recommendation and HTML report whose spending/reward totals include that row. The row may dominate the selected card even though no trustworthy statement month can be assigned to it.

Competing hypothesis:

Retaining a row can be useful for manual review or for date-agnostic summaries. It is not benign at the optimization boundary because rewards use monthly/daily/weekday conditions and the CLI offers no review or exclusion decision before proceeding.

Suggested fix:

At the shared analysis boundary, quarantine invalid-date transactions and report an excluded-row count; abort if no valid rows remain. Keep raw quarantined rows available for diagnostics, but do not pass them to constraints/reward math. Align JSON, CSV-adapter, generic CSV, and OFX behavior with XLSX/HTML or add an explicit parser policy, and add CLI integration tests proving warned invalid rows cannot affect recommendations or reports.

## Missed-issue and file-coverage sweep

I repeated the trace from every parser return through every web/CLI caller, compared analyze/optimize/report behavior, followed monthly/global/day/occurrence state in core, and checked result serialization, restore, reoptimization, HTML, and terminal consumers. I also revisited every source/test/config area in the inventory and reconciled candidate matches with prior completed or explicitly deferred work. No additional independent broken trace survived the final sweep.
