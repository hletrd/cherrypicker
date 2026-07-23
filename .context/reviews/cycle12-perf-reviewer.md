# Cycle 12 Performance Review

**Baseline:** `e72a4c69f7c0eab7053c61a587c2d040760c236c` on
`codex/review-plan-fix-no-deploy-20260723`
**Finding count:** 1

## Inventory and duplicate control

I inventoried the repository before reviewing implementation details. The
locked snapshot has 2,291 tracked paths: 1,129 tracked historical/current
`.context` paths and 1,162 active paths. The active paths break down as follows,
with the root/other bucket covering manifests, lockfiles, vendor input, and
top-level documentation:

| Family | Paths |
| --- | ---: |
| `apps/web` | 168 |
| `packages/core` | 43 |
| `packages/parser` | 86 |
| `packages/rules` | 734 |
| `packages/viz` | 14 |
| `tools/cli` | 28 |
| `tools/scraper` | 35 |
| `scripts` | 19 |
| `e2e` | 16 |
| Root/other | 19 |

The cross-cutting inventory includes 359 TypeScript/JavaScript/Svelte/Astro/CSS
source or test paths, 209 non-test source paths, 174 test/E2E paths, 20
configuration/manifests, 29 active Markdown documents, 685 rules YAML files
(683 authored card files), and 30 generated/public catalog paths. I inspected
the active source, tests, configuration, documentation, authored data, and
generated artifacts, including parser/worker lifecycles, optimizer and
calculator loops, matcher construction and lookup, catalog loading, persistence,
UI list/render work, scraper bounds, CLI orchestration, build scripts, and
bundle budgets.

For duplicate control, I read all 1,135 current and archived plan/review files
(5,496,143 bytes, including the six protected untracked Cycle 42 artifacts) and
searched the full ledger for each candidate. I did not re-report the incremental
optimizer (`D-C1-040`), full-corpus matcher (`D-C1-041`), transaction-table
virtualization, streaming CSV/whole-workbook XLSX parsing, large-PDF assembly,
persistence serialization, parser-diagnostic amplification, or optimizer
catalog cloning. The rejected leading-NUL/prefixed-XLSX ZIP-inflation hypothesis
remains rejected; this review found no new reproducible evidence for it.

## Finding

### RPF12-PERF-001 — Consent-byte binding copies every CLI statement before an ordinary local parse

**Severity:** Medium
**Confidence:** High
**Status:** Confirmed; genuinely new regression after the Cycle 2 single-read
dispatcher fix

**Locations:**

- `tools/cli/src/parse-statement.ts:43-69` — every production invocation eagerly
  reads the complete statement, copies the `fs.readFile` buffer at lines 52-54,
  exposes another full copy at lines 55-60, and pays both costs even when the
  local result returns immediately.
- `packages/parser/src/statement.ts:48-89` — the dispatcher retains the
  parser-facing full buffer and then decodes it for CSV parsing.
- `tools/cli/src/commands/analyze.ts:28-37`,
  `tools/cli/src/commands/optimize.ts:45-54`, and
  `tools/cli/src/commands/report.ts:49-59` — all ordinary statement commands
  enter the copying wrapper.
- `tools/cli/src/validation.ts:18-66` — CLI file validation has no byte-size
  ceiling, so the amplification is not bounded at admission.

`Buffer.from(await readStatementBytes(...))` makes an owned full-file snapshot,
then the injected `readFile` returns `Buffer.from(capturedBytes)` to the
dispatcher. Thus a successful local CSV parse still allocates an initial read
buffer, the captured snapshot, and the parser-facing copy before adding the
decoded string and parsed records. The remote-consent path needs stable bytes,
but CSV and every other locally successful input pay this cost even though
lines 68-69 return without consent or a retry.

This is distinct from historical `C2-PERF-04`. Plan 76 fixed the former repeated
disk read by making `packages/parser/src/statement.ts:53-74` cache one complete
read. `git blame` identifies the later consent-binding commit `bdbde3d5` as the
source of the copies at `parse-statement.ts:50-60`; no archived/current finding
records this post-fix memory regression.

**Measurement and failure scenario:** I ran fresh Bun processes against the
current dependency seam with a parser that performs exactly one injected full
read, and compared it with a same-import single-buffer control. No decoding,
transaction construction, categorization, or optimization was included:

| Input | Current wrapper max RSS | Single-buffer control max RSS |
| ---: | ---: | ---: |
| 32 MiB | 129.5 MiB | 66.0 MiB |
| 64 MiB | 226.0 MiB | 97.3 MiB |
| 128 MiB | 417.2 MiB | 161.5 MiB |

The current boundary therefore adds 255.7 MiB of peak RSS at 128 MiB and shows
approximately three-input-buffer growth versus one-input-buffer growth in the
control. These are lower-bound measurements because the real CSV path next
creates a decoded string and logical records. Running `analyze`, `optimize`, or
`report` on a large annual export can consequently reach memory pressure or an
out-of-memory failure before categorization/optimization, even with remote LLM
fallback disabled.

**Suggested fix:** preserve the security invariant while giving the dispatcher
one owned, read-only byte snapshot. Add a byte-oriented statement entry point
that accepts that snapshot and reuses it for local parsing, consent identity,
and an authorized remote retry. Adopt the production `fs.readFile` buffer when
it is already owned rather than copying it, return read-only views for complete
and prefix reads, and copy only inside an adapter that is proven to mutate or
detach input. Compute/retain the consent digest before parsing and fail closed
if the snapshot-integrity contract is violated. Add regression coverage proving
that path replacement still cannot change remote bytes while a normal local
CSV parse performs one full allocation/read and does not create a second
statement-sized parser buffer.

## Final missed-issue sweep

The final sweep rechecked loop nesting, sorting/allocation sites, worker
creation/termination and listener cleanup, abort paths, parser byte/string
ownership, PDF/XLSX limits, scraper response bounds, catalog cache ownership,
optimizer worker cloning, timers/animation frames, reactive list rendering,
startup imports, and build/bundle budgets. A suspected matcher-wrapper
allocation regression did not reproduce: compiled-pattern reuse remained the
fast path, while the current convenience wrapper was faster than the replaced
regex construction in the focused probe. Plural-cap telemetry remains
per-transaction by design and did not introduce a separate unbounded
collection. No additional genuinely new issue cleared the reporting threshold.

This was a review-only pass. I did not implement, stage, commit, push, serve,
run browser/E2E tests, or deploy.
