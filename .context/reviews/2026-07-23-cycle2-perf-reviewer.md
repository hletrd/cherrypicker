# Performance Review — Cycle 2

## Coverage

I inventoried all 2,029 tracked files before reviewing the current implementation. The performance sweep covered the 132 production/build TypeScript files, 21 Svelte/Astro/CSS UI files, 23 configuration files, all 683 authored card YAML files, the generated catalogs and 24 detail shards, the CLI/parser/scraper paths, and their tests. I also checked the Cycle 1 findings and did not repeat the deferred optimizer (`C1-040`) or matcher (`C1-041`) work.

## Findings

### C2-PERF-01 — Cancellation stops queue admission but not active parsers or PDF workers

**Severity:** High
**Confidence:** High
**Status:** Confirmed

**Locations:** `apps/web/src/lib/file-parse-queue.ts:90-151`, `apps/web/src/lib/analyzer.ts:282-298`, `apps/web/src/lib/parser/index.ts:10-60`, `apps/web/src/lib/parser/pdf.ts:8-45`, `apps/web/src/components/upload/FileDropzone.svelte:168-175`

The queue deliberately passes an `AbortSignal` to each worker, but the analyzer callback ignores its third argument. `parseFile` has no signal parameter, and the PDF adapter neither aborts the PDF.js loading task nor calls `cleanup()`/`destroy()` on the document. `runFileParseQueue` waits for both active lanes to settle even after cancellation.

**Failure scenario:** cancel two active 10 MB, many-page PDFs and immediately start another analysis. The old page walks continue, their PDF.js worker resources are not explicitly released, and the new work competes with work the UI reports as canceled.

**Suggested fix:** propagate the signal through `parseAndCategorize`, `parseFile`, and each format adapter. For PDF, retain the loading task and use `try/finally` to destroy the loading task/document on success, failure, and abort. Make active workers reject with `AbortError`, then add a real adapter-level cancellation/cleanup test.

**Cross-role clue:** the existing cancellation test proves only “between items”; see `C2-TE-02`.

### C2-PERF-02 — The 50 MB aggregate limit is warning-only, so total work remains unbounded

**Severity:** Medium
**Confidence:** High
**Status:** Confirmed

**Locations:** `apps/web/src/components/upload/FileDropzone.svelte:158-165,202-253`, `apps/web/src/lib/file-parse-queue.ts:97-99,140-151`, `apps/web/src/lib/analyzer.ts:305-315`

Each file is limited to 10 MB, but `MAX_TOTAL_SIZE` only produces a warning. There is no aggregate-byte or file-count admission limit. The two-lane queue bounds simultaneous parser buffers, but the queue, settled outcomes, merged transactions, and total CPU time still grow with every accepted file.

**Failure scenario:** a drop containing hundreds of individually valid files is accepted after one warning. The app then retains the whole file list and attempts every item, allowing minutes of main-thread work and unbounded result growth.

**Suggested fix:** enforce a product-level aggregate-byte and file-count ceiling before mutating `uploadedFiles`; explain which files were rejected. Keep the two-lane concurrency cap as a separate control.

**Cross-role clue:** upload contract tests do not exercise either aggregate bytes or file count; see `C2-TE-04`.

### C2-PERF-03 — The server parser root eagerly loads every format and the Anthropic SDK for CSV CLI work

**Severity:** Medium
**Confidence:** High
**Status:** Confirmed

**Locations:** `packages/parser/package.json:6-22`, `packages/parser/src/index.ts:5-22`, `packages/parser/src/pdf/index.ts:1-7`, `packages/parser/src/pdf/llm-fallback.ts:1`, `tools/cli/src/parse-statement.ts:1-2`

The package root statically imports and re-exports CSV, XLSX, PDF, JSON, OFX, and HTML. The PDF entry statically reaches the remote fallback, which statically imports `@anthropic-ai/sdk`. The CLI imports `parseStatement` from that root, so even a one-shot CSV command initializes optional heavy adapters.

On this host, fresh Bun processes measured:

- parser root: 0.06 s, 64.3 MB maximum RSS;
- CSV entry only: 0.01 s, 35.8 MB maximum RSS;
- browser-safe entry: 0.03 s, 47.8 MB maximum RSS.

The relative root-versus-CSV cost was about 28.5 MB RSS and 50 ms before parsing any statement.

**Suggested fix:** add a lightweight `@cherrypicker/parser/statement` entry whose switch dynamically imports only the detected adapter. Put remote PDF fallback behind its own optional entry. Preserve the broad root only for callers that explicitly request all concrete parsers.

**Cross-role clue:** the browser has a blocking import-graph budget, but the server/CLI boundary has none; see `C2-ARCH-04` and `C2-TE-06`.

### C2-PERF-04 — A normal CSV CLI parse reads the entire file twice

**Severity:** Medium
**Confidence:** High
**Status:** Confirmed

**Locations:** `packages/parser/src/detect.ts:196-289`, `packages/parser/src/index.ts:55-67`

For a known `.csv`, `detectFormat` reads the complete file at line 282 to detect encoding/bank. It returns metadata but not the bytes. `parseStatement` then calls `readFile` again at line 61 and decodes the same content again. Unknown-extension JSON also incurs validation/parsing work in detection before being read and parsed again.

**Failure scenario:** a large annual CSV causes two full reads and two resident byte/string representations before categorization, magnifying both I/O and peak memory in the CLI path.

**Suggested fix:** return a bounded sniff or reusable buffer/content from the detection boundary, or let `parseStatement` read once and pass bytes into a pure detector plus the selected adapter. Detection should inspect only the bytes it needs.

## Validation and final sweep

`data:check`, `docs:check`, and `migrations:check` passed for all 683 cards. The focused loader/queue/publication/bundle tests passed 42/42, and core/rules tests passed 206/206. The local `toolchain:check` correctly refused Bun 1.3.12 because the repository pins 1.2.6; this is environmental, not a source finding. A final sweep of timers, listeners, animation frames, fetch lifecycles, parser loops, caches, and unbounded collections found no additional current performance issue above the reporting threshold.
