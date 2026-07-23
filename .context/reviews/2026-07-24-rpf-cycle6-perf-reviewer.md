# Review-plan-fix Cycle 6 — performance reviewer

**Review baseline:** `449f10a2faffaae2a2c47036070b0e61a5b6eec2` on
`codex/review-plan-fix-no-deploy-20260723`

## Inventory and coverage

I classified all 2,151 tracked paths before reviewing. The inventory contains
1,028 historical/current planning and review files, 147 web files, 865 package
files (`core` 34, `parser` 86, `rules` 733, `viz` 12), 59 tool files, 18
scripts, 15 E2E assets/specs, and 19 root/config/vendor/instruction files.
Review-relevant implementation surfaces include 309 TS/JS/Svelte/Astro files,
145 test paths, 683 card-rule YAML files, and 30 generated JSON/CSV artifacts.

The performance pass covered upload admission and parsing concurrency, all
parser formats and workers, categorization/matcher paths, reward calculation
and optimizer workers, catalog loading and validation, persistence
serialization, dashboard rendering, report/terminal generation, CLI batch
flows, scraper/catalog generation, bundle budgets, workflows, tests, and the
plans/reviews needed to distinguish new findings from tracked debt. Every
review-relevant tracked file was included in the inventory and source/search
pass; no review-relevant file was skipped.

I did not re-report the already tracked transaction-table virtualization
(`D-25`), incremental optimizer (`D-C1-040`), compiled matcher
(`D-C1-041`), persistence, streaming-parser, or whole-workbook debts.

## RPF6-PERF-001 — UTF-8 statement decoding makes three full passes

- **Severity:** Low
- **Confidence:** High
- **Status:** Confirmed
- **Location:** `packages/parser/src/shared/encoding.ts:20-27,209-252,294-302`
- **Reach:** `packages/parser/src/statement.ts:110-138`;
  `apps/web/src/lib/parser/index.ts:99-136`;
  `apps/web/src/lib/parser/workers/{json,ofx,html}-worker.ts:7-12`

`decodeStatementTextBytes()` first calls `detectStatementTextEncoding()`.
For JSON, and for undeclared BOM-less OFX/HTML, detection validates the entire
buffer by decoding it with a fatal UTF-8 `TextDecoder`. The wrapper then calls
`isValidUTF8()` a second time and finally calls `decodeTextBytes()` for a third
full decode. The Cycle 5 input-integrity change therefore added two redundant
whole-input passes to the common UTF-8 path.

Why it matters: the web admits 10 MiB per file and 50 MiB in aggregate
(`apps/web/src/lib/upload-admission.ts:3-5`) and parses two files concurrently
(`apps/web/src/lib/file-parse-queue.ts:1,140-141`). Two maximum-size text files
can consequently perform six decoder passes and create repeated temporary
strings at once. An executable 10,485,011-byte UTF-8 JSON probe at this commit
measured a median 5.80 ms for `decodeStatementTextBytes()` versus 1.97 ms for
one decode on desktop Bun. Workers keep this off the main thread, so the
severity remains Low, but the wasted CPU and allocation scale directly with
accepted input size and are more consequential on low-memory mobile devices.

**Concrete scenario:** a user uploads two 10 MiB UTF-8 JSON statements. Each
worker validates the same bytes twice before producing the decoded string,
while the two-file queue permits both copies of this work to overlap.

**Suggested fix:** make statement detection and decoding one operation. For
UTF-8, use one fatal decoder and return that decoded text; for declared
non-UTF-8 encodings, decode once with the selected decoder. If detection must
remain a public metadata API, return a validation result that the decode path
can reuse, or add a single-pass `detectAndDecodeStatementText()` helper. Add a
10 MiB pass-count/allocation regression test or benchmark for JSON and
undeclared OFX/HTML.

## Verification

- Focused parser/upload/worker unit tests: **67 passed, 0 failed**.
- No browser/E2E run was performed, per review constraints.
- No source, plan, protected Cycle 42 file, or pre-existing review provenance
  file was modified.

## Final missed-issue sweep

The final sweep rechecked recent Cycle 5 diffs, size/concurrency boundaries,
all performance-related historical findings, bundle/toolchain configuration,
and generated-data consumers. It found no other new, non-duplicate performance
issue at this baseline.
