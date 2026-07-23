# Review-plan-fix Cycle 8 — performance reviewer

**Review baseline:** `3fd993d471a8676170031f20715f6a53c99e8a9f`

## Inventory and lens coverage

The locked snapshot contains 2,199 tracked paths: 151 under `apps/web`, 37
under `packages/core`, 89 under `packages/parser`, 733 under
`packages/rules`, 14 under `packages/viz`, 59 under `tools`, 19 scripts, 16
E2E paths, 1,062 context paths, and 19 root/config paths. The active inventory
includes 203 non-test TS/JS/Svelte/Astro/CSS/HTML paths, 151 tracked test
paths, 686 YAML files, 59 JSON files, and 1,090 Markdown files.

The performance pass traced upload admission, format sniffing and every
server/browser parser family, worker transfer, two-lane file scheduling,
categorization, calculator and optimizer loops, generated catalog loading,
persistence, dashboard/report rendering, CLI warning sinks, scraper and
publication scripts, package/test-runner configuration, and data artifacts.
The 683-card authored catalog and all generated publication families were
covered through the full data parity gate. Historical reports and plans were
searched before the final sweep to distinguish current residuals from fixed
findings.

I did not relabel the explicitly deferred transaction-table virtualization,
streaming parser, whole-workbook XLSX, compiled matcher
(`D-C1-041`), or incremental optimizer (`D-C1-040`) work as new findings.
In particular, the current 12,047-entry merchant substring scan and the
quadratic optimizer remain known deferred debts. The finding below is the
unfixed tabular half of Cycle 7's diagnostic-bound outcome, not a repeat of
the fixed JSON/worker form.

## RPF8-PERF-001 — tabular parsers build the full diagnostic graph before the worker cap

- **Severity:** Medium
- **Confidence:** High
- **Classification:** Confirmed
- **Primary locations:** `packages/parser/src/csv/generic.ts:255-356`;
  `apps/web/src/lib/parser/csv.ts:403-481`
- **Other affected parsers:** `packages/parser/src/csv/adapter-factory.ts:179-247`;
  `packages/parser/src/xlsx/index.ts:237-377`;
  `apps/web/src/lib/parser/xlsx.ts:390-532`;
  `packages/parser/src/html/index.ts:103-285`;
  `apps/web/src/lib/parser/html.ts:89-263`;
  `packages/parser/src/ofx/index.ts:130-174`;
  `apps/web/src/lib/parser/ofx.ts:104-146`
- **Too-late defense:** `apps/web/src/lib/parser/worker-protocol.ts:85-117`
- **Scale/concurrency:** `apps/web/src/lib/upload-admission.ts:3-5`;
  `apps/web/src/lib/file-parse-queue.ts:1,90-152`
- **Unbounded CLI sink:** `tools/cli/src/commands/analyze.ts:39-43`;
  `tools/cli/src/commands/optimize.ts:56-60`;
  `tools/cli/src/commands/report.ts:61-65`
- **Stated contract:** `.context/plans/102-cycle7-parser-direction-diagnostics.md:39-42,57-62`

The new parser-owned bound applies to shared JSON diagnostics, and
`MAX_REQUIRED_FIELD_ROW_ERRORS` separately limits blank merchant/date
examples. The remaining row diagnostics still call `errors.push()` once per
row. This includes incoming/non-spending rows, ambiguous debit/credit rows,
invalid amounts, and nonblank invalid dates in generic and configured CSV,
XLSX, HTML, and OFX paths.

`serializeParserWorkerResult()` retains at most 100 diagnostics for
`postMessage`, but it receives a completed `ParseResult`. By that point the
parser worker has already allocated every `ParseError`, retained many raw row
strings, iterated the full array, and incurred the associated garbage
collection. Server/CLI callers do not pass through that defense and print the
full array.

An executable probe generated 20,000 CSV rows with both `debit` and `credit`
populated. Both entry points returned one diagnostic per row:

```text
server: transactions=0, errors=20000, elapsed=290 ms
web:    transactions=0, errors=20000, elapsed=286 ms
```

The first and last diagnostics were
`ambiguous_amount_direction` at the expected row numbers. This directly
contradicts the completed Plan 102 acceptance statement that parser and worker
diagnostic graphs are bounded. It is a current residual after the JSON source
collector and worker serialization cap landed.

**Concrete scenario:** a user uploads an admitted 10 MiB CSV whose export
contains populated incoming and outgoing columns on every row, or malformed
amount/date values on every row. Each of two concurrent workers can retain a
large diagnostic graph and raw row payloads before reducing the response to
100 objects. The UI may appear stuck while workers allocate and collect the
graph; the same input through the CLI can also spend substantial time and
terminal I/O printing every warning.

**Root-cause fix:** route every row diagnostic in every parser through one
shared source-level collector with 99 examples plus one exact counted summary.
The budget must cover all codes, not only required fields, and must stop
retaining raw payloads after the example budget is exhausted. Keep the worker
bound as defense in depth. Add large mixed-input tests for CSV, configured
CSV, XLSX, HTML, OFX, JSON, and PDF-table consumers that assert retained
diagnostic count, exact affected count, valid-row preservation,
server/browser parity, and bounded serialized size.

## Verification

- The 20,000-row server/browser CSV probe confirmed the source arrays remain
  unbounded.
- `bun run test`: passed all workspace and script tests at this snapshot.
- `bun run lint`: passed; Astro reported 0 errors, 0 warnings, and 0 hints.
- `bun run typecheck`: passed all seven workspaces; Astro reported 0 errors,
  0 warnings, and 0 hints.
- `bun run data:check`: passed for all 683 authored cards, 24 issuers,
  generated catalogs/shards/fallback labels, and README catalog parity.
- No browser or E2E run was performed, as required by the assignment.

## Final missed-issue sweep

The bounded final sweep revisited input-size/concurrency products, all
row-oriented error builders, worker clone boundaries, categorizer and
optimizer costs, persistence projections, generated catalog memory, reactive
UI lists, CLI sinks, and historically deferred performance items. No second
current, non-duplicate performance issue met the evidence threshold.

Final count: **1 Medium finding**, confirmed with High confidence.
