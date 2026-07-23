# Review-plan-fix Cycle 7 — performance reviewer

**Review baseline:** `3086a379e31e5b17f82401807f5b3c24325b9962` on
`codex/review-plan-fix-no-deploy-20260723`

## Inventory and coverage

I classified and read all 2,175 tracked paths before the final performance
pass. The inventory contains 1,045 context/planning/review paths, 151 web
paths, 868 package paths (`core` 36, `parser` 87, `rules` 733, `viz` 12), 59
tool paths, 18 scripts, 15 E2E paths, and 19 root/config/vendor/instruction
paths. It includes 320 tracked TS/JS/Svelte/Astro files, 147 test paths, all
683 authored card-rule YAML files, and 72 JSON/CSV inputs or generated
artifacts. A complete tracked-file content read succeeded before this report
was written.

The performance pass covered upload admission and aggregate limits, parser
format detection and every server/browser adapter, worker transfer and
deserialization, two-lane file scheduling, categorization and matcher costs,
reward state projection, greedy optimization and its worker, split catalog
fetch/validation/caching, persistence serialization and restoration,
dashboard/report rendering, CLI and scraper paths, catalog generation, bundle
budgets, workflows, and the tests and historical reviews needed to remove
duplicates. High-volume rules and generated artifacts were covered through
the complete schema/publication checks as well as direct tracked-file reads.
No review-relevant tracked file was skipped.

I did not re-report the already tracked transaction-table virtualization
(`D-25`), incremental optimizer (`D-C1-040`), compiled matcher
(`D-C1-041`), persistence, streaming-parser, whole-workbook, or per-file worker
startup debts. I also excluded Cycle 6's now-fixed redundant UTF-8 decode
passes.

## RPF7-PERF-001 — row diagnostics amplify a small JSON statement into a huge worker response

- **Severity:** Medium
- **Confidence:** High
- **Status:** Confirmed
- **Primary location:** `packages/parser/src/shared/json.ts:232-286`
- **Worker amplification:** `apps/web/src/lib/parser/worker-protocol.ts:48-77,
  113-135`; `apps/web/src/lib/parser/worker-runner.ts:66-115`
- **Retention path:** `apps/web/src/lib/analyzer.ts:156-200,356-399`;
  `apps/web/src/components/ui/AnalysisWarnings.svelte:13-64`
- **Input bound:** `apps/web/src/lib/upload-admission.ts:3-5`
- **Too-late bound:** `apps/web/src/lib/persistence.ts:108-131,446-470`

`parseJSONTransactions()` appends one object to `errors` for every primitive
array row, missing date/amount, invalid amount/date, and every invalid optional
fact. Only the blank-merchant diagnostic has a 100-row counter. The function's
own comment says optional fact diagnostics are bounded, but neither those
diagnostics nor general `json_row_rejected` diagnostics have a shared budget.

The worker then maps every error into another plain object, structured-clones
the complete response, and the main thread maps the response into a fresh
`ParseError` array. An all-invalid file is rejected only after this transfer,
at `analyzer.ts:168-172`. A mixed file with one valid transaction retains the
entire diagnostic array in analysis state and renders one `<li>` per error.
`boundedParseWarnings()` limits the persisted projection to 100 entries, but
it runs after parsing, worker cloning, main-thread reconstruction, analysis,
and initial UI state, so it does not protect the expensive path.

An executable probe at this baseline used an array of 400,000 `null` values:

- input: 2,000,001 bytes;
- produced diagnostics: 400,000;
- serialized diagnostic payload: 39,888,896 bytes;
- maximum resident set size: 199,540,736 bytes on Bun.

The web accepts one 10 MiB file, 50 MiB total, and two concurrent parser
lanes. The same compact JSON shape can therefore contain roughly two million
rows in one admitted file, with two such amplifications overlapping.

**Concrete failure:** a user uploads a syntactically valid 2–10 MiB JSON
export whose wrapper array mostly contains `null` placeholders, plus one valid
transaction. Parsing technically succeeds, but the worker constructs and
clones hundreds of thousands or millions of warning objects. A mobile tab can
stall or be killed before the persistence truncation is reached; if it
survives, expanding warnings asks Svelte to render the same unbounded list.

**Root-cause fix:** introduce one parser-owned diagnostic collector with a
small total per-file budget across every diagnostic code, plus exact omitted
counts (and, where useful, counts by code). Return a compact summary
diagnostic after the budget is exhausted while continuing to parse valid
transactions. Apply the same collector contract to the other row-oriented
parsers, and add a defensive maximum in worker serialization so a future
adapter cannot recreate the amplification. The analyzer/UI should consume
counted summaries instead of materializing repeated rows. Add regressions with
hundreds of thousands of rejected rows and with one accepted row among them;
assert diagnostic count, omitted count, serialized size, and server/browser
parity.

## Verification

- Direct amplification probe: **confirmed** the 2.0 MiB → 39.9 MiB diagnostic
  payload and approximately 199.5 MB maximum RSS described above.
- `bun run data:check`: **passed** for all 683 authored cards, generated
  catalogs/shards/fallback labels, and README catalog.
- `bun run typecheck`: **passed** for parser, rules, core, viz, scraper, CLI,
  and web; Astro reported 0 errors, 0 warnings, and 0 hints.
- No source, test, plan, generated artifact, protected Cycle 42 file, or
  pre-existing review file was modified.

## Final missed-issue sweep

The bounded final sweep revisited input-size/concurrency products, all
unbounded array/string builders, worker structured-clone boundaries, catalog
payloads, optimizer state copies, persistence projections, DOM list/table
rendering, report generation, CLI sinks, and every historically deferred
performance item. No second new, non-duplicate performance issue met the
evidence threshold at this baseline.

Final count: **1 Medium finding**, confirmed with High confidence.
