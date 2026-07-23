# Debugger — Cycle 3

**Reviewer:** debugger
**Date:** 2026-07-23
**Baseline:** `614ce5c`
**Result:** 3 confirmed Medium findings and 1 confirmed Low finding.

## Method

I audited error paths, state transitions, timers, cancellation, malformed
inputs, numeric/string conversion, persistence, and filesystem behavior across
all current production source and their tests. Each candidate was challenged
with an alternative explanation and, where a pure boundary allowed it, a safe
local minimal reproduction.

## Findings

### C3-DBG-001 — A failed replacement analysis clears memory but leaves the prior persisted result

- **Severity:** Medium
- **Confidence:** High
- **Status:** Confirmed
- **Locations:** `apps/web/src/lib/store.svelte.ts:160-228,232-263,335-384,
  480-492`; `apps/web/__tests__/store-persistence.test.ts:84-297`

On a successful analysis, the store assigns `result` and writes it to
`sessionStorage`. On a later current (non-abort) failure, the catch block sets
`error` and `result = null`, but does not clear or replace the storage entry.
The singleton now says no result exists while the same tab's storage still
contains the previous analysis. A reload constructs the store with
`loadFromStorage()` and resurrects that older result as though it were current.

**Failure scenario:** Analysis A succeeds. The user tries to replace it with
malformed statement B. B fails and the upload page shows an error. A refresh or
direct results/dashboard navigation restores A, which can be mistaken for B's
result.

**Competing hypotheses:** Preserving the last good result can be a valid product
policy, but the catch explicitly clears only the in-memory result and the UI
presents the new attempt as failed. Preserving A would require preserving it in
both state and storage with clear “last successful” labeling. Clearing B's
failed replacement would require clearing both. The current split is not a
coherent policy.

**Suggested fix:** Make the transition atomic. Either retain the prior result
in memory and storage on failure, or clear both result and storage before/when
beginning a replacement. Add a runtime store test and built-app test for
success A -> failure B -> reload/direct navigation.

### C3-DBG-002 — Invalid numeric character entities crash HTML report generation

- **Severity:** Medium
- **Confidence:** High
- **Status:** Confirmed
- **Location:** `packages/viz/src/report/generator.ts:46-63,65-267`;
  `packages/viz/__tests__/report.test.ts:56-119`

The HTML escape helper first decodes decimal/hex numeric entities with
`String.fromCodePoint(parseInt(...))`. Values outside the Unicode scalar range
throw `RangeError`. A safe local call to `generateHTMLReport` with a card name
containing `&#1114112;` reproduced:
`RangeError: Arguments contain a value that is out of range of code points`.
Card names, tier labels, taxonomy labels, cap categories, and alternatives can
all reach this helper.

**Failure scenario:** A malformed but schema-valid display string in a
developer-supplied/scraped catalog causes `cherrypicker report` to abort before
writing its report. The main CLI catches and prints the error, but the requested
artifact is unavailable.

**Competing hypothesis:** The predecode comment says double-encoded numeric
entities become executable HTML. HTML entity parsing is not recursive:
escaping `&` to `&amp;` renders the original entity text, not a second-stage
tag. Predecoding is unnecessary for injection prevention; the subsequent
standard escaping is the relevant defense.

**Suggested fix:** Remove entity predecoding and escape the original string
directly. If normalization is retained, accept only valid scalar values and
replace invalid entities without throwing. Test maximum valid code point,
maximum+1, huge decimal/hex strings, surrogates, incomplete entities, and
literal `&#x3C;script...` output.

### C3-DBG-003 — A second drop during the success countdown does not invalidate the old navigation

- **Severity:** Medium
- **Confidence:** High
- **Status:** Confirmed
- **Location:** `apps/web/src/components/upload/FileDropzone.svelte:27-33,
  52-92,162-169,196-236,278-351,439-509`

After an analysis succeeds, the component sets `uploadStatus = "success"` and
schedules dashboard navigation after 1,200 ms. Page-wide drop handling remains
active. `addFiles()` calls `cancelActiveAnalysis()`, but that function returns
unless status is exactly `"uploading"`; it neither invalidates
`analysisRuns` nor clears `navigateTimeout` in the success state. Adding a file
then changes the visible list/status to idle, while the old run remains current.
The timer subsequently navigates to the dashboard with the old analysis.

**Failure scenario:** During the “analysis complete” countdown, the user drops
another statement intending to analyze it. The form briefly returns for the new
selection, then the old timer takes the user to A's dashboard. The new file was
never analyzed.

**Competing hypothesis:** The success UI hides local file inputs, but the
document-level drop listener at lines 55-92 stays active and calls the same
`addFiles` path, so the overlap is reachable.

**Suggested fix:** Centralize transition cancellation: any mutation after
success should clear the pending timer and invalidate the old run, or disable
drop admission until navigation completes. Add a fake-timer component test and
an E2E drop test inside the 1.2-second success window.

### C3-DBG-004 — Three main CLI parsers silently ignore unknown or incomplete options

- **Severity:** Low
- **Confidence:** High
- **Status:** Confirmed
- **Locations:** `tools/cli/src/commands/analyze.ts:17-48`;
  `tools/cli/src/commands/optimize.ts:30-74`;
  `tools/cli/src/commands/report.ts:31-80`;
  contrast `tools/cli/src/commands/scrape.ts:19-73`

Analyze, optimize, and report have no final `else` in their option loops.
Unknown flags, stray values, and known options with a missing value are simply
skipped. The scraper parser correctly rejects both classes.

**Failure scenario:** A typo in `--prev-spending`, `--cards`, `--categories`,
or `--output` silently selects a default. Recommendations may use the wrong
performance basis/catalog, or a report may be written to the default filename
instead of the requested one. Some downstream disclosures help, but argument
acceptance itself incorrectly signals success.

**Suggested fix:** Use one strict shared option parser or make every loop reject
unknown arguments and require the next token for valued options. Add a table of
unknown, missing-value, duplicate, and stray-positional tests for all four
commands.

## Error paths verified as sound

- Operation epochs block stale analyze/reoptimize/reset/cancel commits.
- Parse queues preserve settled order, stop dequeueing after cancellation, and
  pass abort to active workers.
- Browser PDF cleanup/destroy executes exactly once on success, failure, and
  abort.
- Empty/partial multi-file parses retain actionable parser diagnostics and file
  identity.
- Invalid calendar rows are quarantined from month selection and optimization.
- Calculator boundaries reject non-finite/unsafe transaction amounts, and
  catalog publication rejects unsupported executable reward shapes.
- Generated artifacts fail closed when empty, malformed, duplicate, or from a
  mismatched publication generation.

## Final missed-issue sweep

The final sweep inspected every `catch`, timer, mutable module cache,
`JSON.parse`, numeric parse/code-point conversion, filesystem write, abort
boundary, and result-reset path. I also compared the Cycle 1/2 closed findings
against current source to avoid reopening fixed bugs. No additional
well-evidenced Critical/High debugger finding remained.
