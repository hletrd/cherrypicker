# Review-plan-fix Cycle 9 — debugger

- Date: 2026-07-24
- Baseline: `c5c6eab9b421e547d66716e989e08c747cc36aa1`
- Branch: `codex/review-plan-fix-no-deploy-20260723`
- Lens: latent failures, malformed boundaries, promise settlement, and test
  gaps

## Inventory and coverage

The debugger pass inventoried all 2,232 tracked paths: 1,153 active
non-context paths plus 1,079 historical plan/review paths used to exclude
fixed or deferred findings. Active coverage included all web, core, parser,
rules, viz, CLI, scraper, script, E2E, root/config/workflow/vendor, authored
YAML, generated JSON, fixture, and test families. The inventory contains 159
tracked test/spec paths. Six protected untracked Cycle 42 files were left
untouched.

I exercised or traced malformed, empty, partial, exact-boundary, overflow,
cancelled, stale, clone/serialization, tied-order, unsupported-rule,
persistence, and output paths across parser → categorizer → context →
calculator → optimizer → web/CLI/report. Plans 108–113 and historical closure
state were checked before classifying the findings below.

## RPF9-DBG-001 — shared date parsing accepts arbitrary trailing or surrounding text

- **Severity:** Medium
- **Confidence:** High
- **Classification:** Confirmed
- **Primary defect:** `packages/parser/src/date-utils.ts:95-115,165-193`
- **Confirmed JSON consumer:** `packages/parser/src/shared/json.ts:239-244`
- **Other consumers:** `packages/parser/src/csv/generic.ts:335-351`;
  `packages/parser/src/csv/adapter-factory.ts:230`;
  `packages/parser/src/shared/date-cell.ts:43-69`;
  `packages/parser/src/shared/pdf-text.ts:226,340`;
  `apps/web/src/lib/parser/csv.ts:88`

The four-digit date regex is start-anchored but not end-anchored. The Korean
full/short patterns are anchored at neither end. This is used intentionally
to accept a time suffix, but it also accepts any suffix or surrounding text,
normalizes only the matched date, and then passes the normalized value through
`isValidISODate()`.

Direct probes at this baseline returned:

```text
parseDateStringToISO("2024-01-15oops")  -> "2024-01-15"
parseDateStringToISO("x2024년 1월 15일z") -> "2024-01-15"
```

The JSON path accepts the resulting ISO date with no diagnostic. Generic CSV
does the same when a recognized header already identifies the date column.
Existing tests assert valid space-separated datetime suffixes but do not
distinguish them from arbitrary junk.

**Concrete scenario:** a damaged export emits `2024-01-15승인취소` or PDF
extraction glues a neighboring token to a Korean date. The row is silently
assigned January 15 rather than being rejected for review. That row can enter
month selection, previous-spending qualification, optimization, persistence,
and reports with false date provenance.

**Root-cause fix:** parse either an anchored plain-date grammar or an anchored,
explicitly supported datetime grammar; do not rely on prefix extraction.
Anchor Korean full/short forms as well. If product requirements include
timezone-bearing timestamps, enumerate their suffix grammar deliberately.
Add shared server/browser conformance cases for valid timestamps, arbitrary
alphabetic/Korean prefixes and suffixes, extra numeric tokens, punctuation,
and PDF-adjacent text.

## RPF9-DBG-002 — worker `messageerror` leaves parser/optimizer promises unsettled

- **Severity:** Low
- **Confidence:** Medium
- **Classification:** Likely; browser fault-injection/manual validation needed
- **Parser worker runner:**
  `apps/web/src/lib/parser/worker-runner.ts:10-21,66-118`
- **Optimizer worker runner:**
  `apps/web/src/lib/optimizer/worker-runner.ts:12-23,48-97`
- **Test gap:** `apps/web/__tests__/parser-worker.test.ts`;
  `apps/web/__tests__/optimizer-worker.test.ts:16-67`

Both owned-worker wrappers settle on `message`, `error`, synchronous
`postMessage` failure, or caller abort. Neither interface registers the
standard `messageerror` event, which is emitted when a posted message cannot
be deserialized at the receiving endpoint. If that is the only event observed
on the main side, the promise remains pending and cleanup never terminates the
worker. The current fake workers cannot emit this event, so the branch is
untested.

**Concrete scenario:** a browser/runtime fault or memory-pressure failure
prevents deserialization of a large parser result or optimizer result. The
analysis remains in its loading state indefinitely until the user navigates,
resets, or otherwise aborts; the owned worker also remains live.

**Rationale for classification:** production messages are deliberately plain
serialized graphs, so this is not expected during normal operation. The
settlement hole is real in the state machine, but reproducing it reliably
requires browser fault injection and is therefore not classified as a
confirmed ordinary-input failure.

**Root-cause fix:** add typed `messageerror` listeners to both worker
interfaces, reject with a sanitized worker-communication error, and remove
the listener in the common cleanup path. Extend both fake-worker suites to
emit `messageerror` and assert one rejection, listener removal, and exactly
one termination. A bounded watchdog can provide defense in depth but should
not replace event handling.

## Verification and final sweep

- Executable date probes confirmed both malformed strings normalize to a
  valid ISO date.
- 170 focused tests passed across date, parser archive, optimizer, analyzer,
  upload, worker, PDF lifecycle, and transaction-review suites; neither
  malformed suffix nor `messageerror` behavior is covered.
- Existing wall-clock short-date inference and upload name/size identity were
  not re-reported because they are already historical deferred/previously
  tracked items.
- The final sweep rechecked malformed external values, parser parity,
  fail-open/fail-closed branches, worker settlement, abort cleanup, partial
  multi-file success, exact cap/occurrence boundaries, persisted graph
  validation, CLI/report sinks, scraper failures, and recent Cycle 8 fixes.
- No browser/E2E run, product-source edit, generated-artifact edit, commit, or
  deployment was performed.

Final count: **1 Medium confirmed finding and 1 Low likely finding**.
