# Cycle 3 — Performance Reviewer

**Review target:** `614ce5c` on `codex/review-plan-fix-no-deploy-20260723`
**Mode:** read-only performance review. Cycle 1/2 closures were checked first; the deferred Cycle 1 optimizer and merchant-matcher work (`D-C1-040`, `D-C1-041`) is intentionally not re-reported.

## Inventory and method

The review used the shared Cycle 3 inventory of 2,072 tracked paths / 1,067 current non-historical artifacts. I traced startup, catalog publication/loading, browser parse and analysis queues, worker boundaries, persistence, reports, CLI defaults, and build budgets. Validation included a production web build/budget check, decoded/gzip asset sizing, a 10 MiB text-preprocessing microbenchmark, and fresh-process catalog-load probes.

## Findings

### C3-PERF-001 — CSV worker parsing still performs the full-file decode and bank scan on the main thread

- **Severity:** Medium
- **Confidence:** High
- **Status:** confirmed
- **Location:** `apps/web/src/lib/parser/index.ts:29-58`; `packages/parser/src/shared/encoding.ts:3-46,49-59`; `apps/web/src/lib/parser/detect.ts:156-197`; `apps/web/src/lib/parser/worker-runner.ts:112-116`
- **Concrete failure scenario:** A user selects one or two 10 MiB CSV statements on a lower-powered phone. Before either worker can parse, the UI thread reads and decodes every byte, tests the complete decoded string against every bank signature, clones that string into the worker, and later scans it again for replacement characters. Two permitted parse lanes can enter this path together, producing visible input/animation delay even though the feature is presented as worker-backed.
- **Evidence:** The CSV branch calls `file.arrayBuffer()`, `detectTextEncoding()`, `decodeTextBytes()`, and `detectBankFromText()` before `parseWithWorker()`. UTF-8 detection itself performs a fatal full-buffer decode; the next call decodes the buffer again. Bank detection loops over all signature regexes against the full string. Unlike XLSX, the CSV payload is a string, so `postMessage()` cannot transfer it and must structured-clone it. A seven-run 10 MiB probe of the pre-worker encoding/decode/bank/replacement path on this desktop measured **14.66–16.24 ms, 15.63 ms median** in Bun; that already consumes essentially a 60 Hz frame before browser cloning, worker startup, or mobile slowdown.
- **Suggested fix:** Transfer the original `ArrayBuffer` to the CSV worker and perform encoding detection, decoding, bank detection, replacement counting, and parsing there. Return the detected bank/encoding warning with the parse result. If bank detection must remain outside the parser, limit it to a bounded header sample. Add a browser test with a heartbeat/long-task assertion for the maximum per-file size and two concurrent lanes.

### C3-PERF-002 — Default CLI optimize/report startup reparses all 683 YAML rules instead of using the compiled catalog

- **Severity:** Medium
- **Confidence:** High
- **Status:** confirmed
- **Location:** `tools/cli/src/commands/optimize.ts:97-127`; `tools/cli/src/commands/report.ts:104-133`; `packages/rules/src/loader.ts:17-52`; generated artifact `scripts/build-json.ts:424`
- **Concrete failure scenario:** Every ordinary `optimize` or `report` invocation recursively enumerates 683 rule files, launches one read/YAML-parse/Zod-validation promise per file, and retains the resulting graph before doing any user analysis. Repeated CLI use and constrained CI/container runs pay this source-authoring cost even though the repository already publishes a compact optimizer artifact.
- **Evidence:** Both commands select `DEFAULT_CARDS_DIR` when `--cards` is absent and call `loadAllCardRules()`. That loader recursively collects every YAML path and feeds the entire array to `Promise.allSettled()` without a concurrency bound. Three fresh-process probes loaded 683 rules in **305/313/339 ms** and peaked at approximately **184–186 MiB RSS**. Reading and parsing the generated optimizer JSON took approximately **6 ms** and **33 MiB RSS** in the comparison probe. The custom `--cards` path legitimately needs source YAML; the default path does not.
- **Suggested fix:** Make the generated, schema-validated optimizer catalog the default CLI runtime input, while retaining YAML loading for explicit `--cards` development overrides. If source loading remains supported, bound read/parse concurrency. Add a CLI startup/RSS budget test that exercises the default 683-card catalog.

## Build and missed-issue sweep

- `bun run web:build:check` passed. The initial client graph was 181.9 KiB decoded / 62.5 KiB gzip; compact catalog and optimizer budgets also passed.
- Large parser chunks were confirmed lazy/worker-scoped (PDF worker 1.38 MiB raw; analyzer 451.7 KiB; XLSX/HTML workers about 390 KiB each), so they were not reported as initial-load regressions.
- Cycle 2 cancellation, PDF cleanup, aggregate upload limits, parser entry isolation, and CSV double-file-read fixes remain present.
- Final searches covered synchronous full-file operations, `Promise.all` fan-out, worker transfer lists, cache lifetime, storage serialization, timers/listeners, generated-data loading, and bundle-budget coverage. No additional performance issue met the evidence threshold.
