# Plan 85 - Cycle 4 Parser and Worker Performance

**Findings:** C4-006, C4-007, C4-008, C4-009, C4-010
**Status:** completed
**Archived:** 2026-07-23 during Cycle 5 planning
**Deploy mode:** none

## Outcome

Make admitted large statements independent of JavaScript argument limits, keep
all worker-backed text decoding off the window thread, and give browser/server
format and row acceptance one tested contract.

## Tasks

- [x] Replace `push(...transactions)` with a limit-independent linear merge or
  preallocated fill in multi-file analysis. Add an analyzer regression with
  more than 130,000 normalized transactions.
- [x] Change every worker request to own a transferable `ArrayBuffer`. Decode
  JSON, OFX, and HTML bytes in their workers, retain a local decode fallback
  when workers are unavailable, and keep abort/termination behavior unchanged.
- [x] Extend protocol/transfer tests across CSV, XLSX, JSON, OFX, and HTML,
  including two concurrent maximum-admission text files and main-thread
  heartbeat/readiness coverage in the blocking browser suite.
- [x] Replace both full-input delimiter samplers with one bounded browser-safe
  scanner, or equivalent identical implementations, that stops after 30
  non-empty lines. Add parity and consumed-range coverage with a multi-megabyte
  suffix.
- [x] Align browser and server content detection. A valid complete JSON payload
  must remain JSON under `.csv`, `.tsv`, `.txt`, or unknown names. A
  brace/bracket-prefixed payload with an explicit CSV/TSV extension that is not
  valid JSON must fall back to delimited parsing. An unknown-extension malformed
  JSON-looking payload must still reach the JSON parser and report syntax.
- [x] Keep detection work compatible with the worker ownership change so the
  window does not decode and clone an entire maximum-size text file merely to
  route it.
- [x] Reject a browser OFX row immediately after an invalid `DTPOSTED`, matching
  the server parser. Add one shared-fixture parity test.

## Acceptance

- [x] A valid 130,000-plus-row statement merges without `RangeError`, retains
  input order, and produces the expected row count.
- [x] JSON, OFX, and HTML worker calls transfer the original buffer and do not
  post a string. Local fallbacks still parse the same bytes.
- [x] Delimiter sampling examines no content after the thirtieth non-empty
  sample and browser/package results remain identical.
- [x] The brace-prefixed CSV reproduction parses its transaction as CSV, long
  valid JSON remains JSON under mismatched extensions, and malformed unknown
  JSON-looking input preserves its syntax error.
- [x] Browser and server OFX adapters both return zero transactions for the
  invalid-date fixture and equivalent diagnostics.
- [x] Parser, web analyzer, worker, type, build, and focused E2E gates pass.

## Coverage

| Finding | Required evidence |
|---|---|
| C4-006 | analyzer-level 130,000-plus-row merge regression |
| C4-007 | all-format transferable-buffer tests and browser responsiveness proof |
| C4-008 | bounded delimiter consumed-range and parity tests |
| C4-009 | mismatched-extension CSV/JSON routing matrix in both adapters |
| C4-010 | invalid-date OFX shared-fixture parity |

## Expected implementation surface

- `apps/web/src/lib/analyzer.ts`
- `apps/web/src/lib/parser/index.ts`
- browser parser workers, protocol, runner, detection, OFX, and focused tests
- `packages/parser/src/detect.ts` or a shared browser-safe detection helper
- server/browser parser parity tests
- one focused E2E responsiveness assertion if unit instrumentation cannot prove
  the main-thread boundary
- this plan for completion evidence

No rule-data, optimizer, CLI/scraper, UI layout, deploy, commit, or push work
belongs to this plan.

## Implementation evidence

- Focused parser/analyzer/worker/routing/conformance/bundle-contract gate:
  164 passed, 0 failed.
- Complete parser package suite: 1,620 passed, 0 failed.
- Parser TypeScript: `tsc --noEmit` passed.
- Web TypeScript/Astro diagnostics: 97 files, 0 errors, 0 warnings, 0 hints.
- The production browser path admitted two concurrent 10 MiB CSV files,
  transferred both buffers to named workers, and observed a main-thread
  `MessageChannel` heartbeat before either worker completed. The focused
  repository-owned browser gate passed twice.
- The final workspace build passed 7/7 without warnings. The exact blocking
  browser gate passed 93/93, followed by a clean owned-process and port
  postflight.
