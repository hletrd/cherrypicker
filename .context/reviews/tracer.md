# Cycle 5 causal tracer review

Date: 2026-07-23
Baseline: `e3aa4241bbdc9c9b1dc3abff0df78e0cc9f8d715`

## Scope

After inventorying all tracked files, I traced every current user-input path
through its parser, normalizer, domain boundary, aggregation, persistence, and
output consumer. The sweep specifically rechecked the Cycle 4 safe-money
changes through web, optimize, report, and analyze call graphs instead of
assuming the shared-core fix covered every command. Historical Cycle 4
findings were compared against current code and are not repeated below.

## Finding

### C5-TRACE-001 — `analyze` bypasses the checked analysis aggregate and silently rounds a valid statement total

- **Severity:** Medium
- **Confidence:** High
- **Status:** Confirmed
- **Location:** `packages/parser/src/shared/amount.ts:52-54,57-63`;
  `tools/cli/src/analysis.ts:31-55`;
  `tools/cli/src/commands/analyze.ts:55-68`;
  `packages/viz/src/terminal/summary.ts:25-50,61-74`;
  same public-report aggregation at
  `packages/viz/src/report/generator.ts:267-324`;
  safe comparison path at
  `packages/core/src/numeric.ts:1-20` and
  `packages/core/src/analysis/context.ts:87-147`

Confirmed causal chain:

1. The canonical parser deliberately accepts each integer amount through
   `Number.MAX_SAFE_INTEGER`.
2. `categorizeRawTransactions` copies that validated amount unchanged.
3. `runAnalyze` categorizes the rows and calls `printSpendingSummary`
   directly. Unlike `optimize` and `report`, it never calls
   `prepareCliAnalysis`/`buildAnalysisContext`.
4. The visualization function independently recomputes category and grand
   totals using `existing.total += tx.amount` and
   `grandTotal += tx.amount`, with no safe-integer assertion.
5. The rounded number is formatted as if it were exact Won and printed to the
   user. No warning or failure is produced.

A direct current-HEAD probe with two individually valid rows,
`[Number.MAX_SAFE_INTEGER, 2]`, produced:

```text
mathematical total (BigInt): 9007199254740993
printed terminal total:      9,007,199,254,740,992원
```

The report generator repeats the unchecked aggregation in its exported
`generateHTMLReport` API. The normal CLI `report` command is protected because
it first calls `prepareCliAnalysis`, whose monthly checked sum fails closed;
the direct public viz API is not. The normal CLI `analyze` command remains
reachable because it bypasses that boundary.

Competing hypotheses eliminated:

- **“Cycle 4 made all aggregates safe.”** False. The fixed core paths use
  `addSafeNonnegativeIntegers`, but `analyze` does not enter them.
- **“Visualization only formats already-computed totals.”** False. Both
  terminal and HTML visualization code perform their own independent sums.
- **“The parser rejects the triggering rows.”** False. Both inputs are safe
  integers and the parser intentionally accepts the maximum boundary.
- **“This is only a direct-library misuse.”** False for terminal output:
  `runAnalyze` calls the vulnerable public function directly. It is true for
  the HTML variant under the current CLI call graph, which narrows that part
  of the impact.
- **“Annual fees have the same hole.”** False. Although the schema text uses
  `z.number().int().nonnegative()`, Zod's integer check rejected
  `Number.MAX_SAFE_INTEGER + 1` in a direct probe before publication or scraper
  output could proceed.

Failure scenario:

A malformed, synthetic, or hostile statement contains two individually valid
positive amounts whose aggregate crosses the safe-integer boundary. The
`analyze` command reports an incorrect category and grand total as exact
currency. This requires unrealistic values, but it violates the repository's
explicit fail-closed monetary invariant and can silently corrupt financial
output rather than returning an actionable boundary error.

Suggested fix:

- Give viz one shared checked positive-money aggregator (export the core
  helper or expose an analysis-summary API) and use it for category and grand
  totals in both terminal and HTML report generation.
- Keep the command behavior explicit: `analyze` may summarize all parsed
  months, but it must still validate every amount and every cross-row sum.
- Fail before printing partial tables when any category or grand total is
  unsafe.
- Add regressions for `MAX_SAFE_INTEGER + 2` across two rows, separate-category
  overflow, the exact-safe boundary, zero/refund filtering, the CLI analyze
  command, and direct terminal/report APIs.

## Validation and final sweep

The focused probe reproduced the one-Won discrepancy. All 2,457 current
unit/integration tests and 93 browser regressions still passed, confirming that
the existing suite does not guard this call graph. A final search of every
production `+=`, additive reduction, and monetary consumer found other web
reductions protected by checked core results; only the two viz recomputations
above remained outside that invariant.
