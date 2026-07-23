# Cycle 4 — Performance Reviewer

**Review target:** `555c56a633f9` on `codex/review-plan-fix-no-deploy-20260723`
**Mode:** read-only performance review; no browser, Chrome, Playwright, deployment, or source mutation.

## Inventory and method

I inventoried all 2,112 tracked paths before reviewing content. The inventory includes 1,009 historical plan/review files, 683 card-rule YAML files, 24 issuer README files, and 349 source/config/test artifacts outside the bulk card-rule tree; 102 files are test/spec files. I ran an inventory-led content pass across every current source, config, test, workflow, and relevant documentation file, then traced the complete startup, catalog, parser, scraper, CLI, report, analysis, worker, persistence, and UI-rendering flows. Bulk rules and historical material were structurally searched and used to distinguish current defects from already-fixed or explicitly deferred work.

Validation was deliberately browser-free:

- 109 targeted parser, queue, upload, catalog, bundle-contract, CLI-process, and performance tests passed with zero failures.
- A valid 126,000-row CSV fixture parsed without errors from 2,394,033 bytes, demonstrating that one admitted 10 MiB file can produce an array above common V8 call-argument limits.
- Local V8 reproduced `RangeError: Maximum call stack size exceeded` for `array.push(...source)` at 125,000 elements.
- Five-run delimiter probes scaled with the complete input despite the documented 30-line limit: at 1/5/10 MiB, the web copy took 1.33/7.83/13.21 ms median and the package copy took 1.31/6.64/13.95 ms median.

## Findings

### C4-PERF-001 — The multi-file merge can crash on a valid large statement because it spreads every transaction as a call argument

- **Severity:** Medium
- **Confidence:** High
- **Status:** confirmed
- **Location:** `apps/web/src/lib/analyzer.ts:342-372`; admission boundary at `apps/web/src/lib/upload-admission.ts:3-5`
- **Concrete failure scenario:** A user imports one compact CSV containing at least roughly 125,000 valid rows. The file is well below the advertised 10 MiB per-file limit and parsing/categorization can return all rows, but aggregation executes `allTransactions.push(...parsed.transactions)`. V8 treats every element as a separate function argument and can throw `RangeError` before optimization or the report is shown.
- **Evidence:** A 126,000-row valid fixture occupied only 2.28 MiB and produced 126,000 transactions with no parse errors. The same spread-call shape failed at 125,000 elements in the local V8 runtime. The ECMAScript call shape has an engine-dependent argument ceiling, while upload admission constrains bytes rather than transaction count, so there is no invariant keeping `parsed.transactions` below that ceiling.
- **Root fix:** Replace argument spreading with a limit-independent linear merge. A direct `for...of` push is sufficient; precomputing the fulfilled outcome sizes and filling a preallocated array would also avoid repeated capacity growth. Add an analyzer-level regression with more than 130,000 normalized transactions rather than testing only the queue order.

### C4-PERF-002 — JSON, OFX, and HTML worker paths still materialize and clone complete strings on the window side

- **Severity:** Medium
- **Confidence:** High
- **Status:** confirmed
- **Location:** `apps/web/src/lib/parser/index.ts:65-102`; `apps/web/src/lib/parser/worker-protocol.ts:6-16`; `apps/web/src/lib/parser/worker-runner.ts:112-115`; limits at `apps/web/src/lib/upload-admission.ts:3-5`
- **Concrete failure scenario:** A user analyzes two 10 MiB HTML, OFX, or JSON statements in the two permitted parse lanes. Each lane first materializes a complete JavaScript string in the window realm, then posts that non-transferable string to a worker. The worker therefore starts only after clone serialization and temporarily needs another complete copy, increasing UI-thread work and peak memory on the devices that benefit most from worker isolation.
- **Evidence:** These three branches call `file.text()` before checking the worker path and the protocol restricts their payload to `string`. `parseWithWorker()` supplies a transfer list only for `ArrayBuffer`, so all three inputs take the structured-clone path. The maximum admitted workload is two active 10 MiB files and 50 MiB overall. Existing worker tests assert transferable buffers only for CSV/XLSX (`apps/web/__tests__/parser-worker.test.ts:99-134`) and do not cover any text-format payload.
- **Root fix:** Make every worker-backed parser request carry the original `ArrayBuffer`, transfer it, and decode inside the selected worker before calling the format parser. Keep a no-worker fallback that decodes locally. Extend the protocol/ownership tests to JSON, OFX, and HTML and add a maximum-size two-lane heartbeat or long-task browser regression when E2E is next run.

### C4-PERF-003 — The claimed 30-line delimiter sample still splits, trims, and filters the entire CSV

- **Severity:** Low
- **Confidence:** High
- **Status:** confirmed
- **Location:** `apps/web/src/lib/parser/detect.ts:198-203`; `packages/parser/src/detect.ts:172-176`; downstream full parsing at `apps/web/src/lib/parser/csv.ts:275-282` and `packages/parser/src/csv/generic.ts:91-94`
- **Concrete failure scenario:** Parsing a maximum-size CSV first builds and transforms an array for every line solely to retain 30 non-empty samples, then the actual CSV parser performs its own complete split. This adds a linear pass, thousands of short-lived strings, and avoidable GC work for every CSV in both browser-worker and CLI/server paths.
- **Evidence:** Both implementations call `content.split('\n').map(...).filter(...).slice(0, 30)`. Because `slice` is last, it bounds delimiter counting but not the expensive split/map/filter work. Five-run probes grew almost linearly from about 1.3 ms at 1 MiB to 13–14 ms at 10 MiB in both copies. This is narrower than the already-documented streaming-parser work: it is an incomplete implementation of the existing bounded-sampling intent.
- **Root fix:** Scan newline boundaries until 30 non-empty lines have been collected, or first compute a bounded prefix and split only that prefix. Keep the web/package implementations in parity and add a regression that instruments the scanner's consumed range so a trailing multi-megabyte suffix cannot silently reintroduce a full scan.

## Missed-issue sweep and coverage statement

- Cycle 3's CSV `ArrayBuffer` transfer and default compiled CLI catalog are present and their focused tests pass; those fixed findings were not repeated.
- The deferred incremental optimizer (`D-C1-040`) and compiled merchant matcher (`D-C1-041`) remain evident but were intentionally not re-reported. Earlier findings for transaction-list virtualization, persistence serialization, streaming CSV parsing, and whole-workbook XLSX loading were also excluded absent a new regression.
- I checked parser worker creation/termination, queue concurrency and release ordering, scraper response/input/output caps, CLI startup/RSS coverage, catalog projection sizes, initial/dynamic bundle graph checks, timer/listener cleanup, caches, repeated sorting, synchronous filesystem/network work, and large-array operations. Per-file worker startup remains a profiling opportunity, but it did not meet the evidence threshold for a finding without a browser trace.
- Coverage is complete for the performance lens: every tracked path was inventoried; every current source/config/test artifact was content-scanned; all production hot paths and their cross-file consumers were read in full; bulk rules and documentation were structurally validated; and the final missed-issue searches found no additional current issue above the reporting threshold.
