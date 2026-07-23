# Cycle 5 — Debugger

**Review target:** `e3aa4241bbdc9c9b1dc3abff0df78e0cc9f8d715`
**Result:** two confirmed Medium defects

## Method

I audited current error paths, malformed input handling, date/number normalization, state transitions, cancellation, persistence, async cleanup, and filesystem/process ownership across all production packages and their tests. Candidates were challenged against downstream validation and reproduced through both server and browser implementations where applicable. Historical fixed findings and documented deferred work were removed before the final sweep.

## Findings

### C5-DBG-001 — Timezone-bearing OFX timestamps normalize invalid components into a different valid date

- **Severity:** Medium
- **Confidence:** High
- **Status:** confirmed
- **Location:** `packages/parser/src/ofx/index.ts:86-118,178-184`; mirrored browser implementation `apps/web/src/lib/parser/ofx.ts:55-87,135-139`
- **Concrete failure scenario:** An OFX transaction contains `DTPOSTED=20241340120000[0:GMT]` (month 13, day 40). Both parsers return the transaction dated `2025-02-09` with no parse error. The malformed statement row can therefore select the wrong analysis month and receive rewards as if that invented date were authoritative.
- **Evidence:** The regex captures numeric components but validates neither their ranges nor a calendar round-trip. The timezone branch passes them to `Date.UTC()`, whose overflow normalization turns month 13/day 40 into a later year/month; the formatted result then passes `isValidISODate()`. The executable server/browser probe produced identical `{date:"2025-02-09", merchant:"INVALID", amount:1000}` rows and empty error arrays. Existing conformance coverage rejects the bare date `20241340`, but that path uses `parseDateStringToISO()` and never exercises `Date.UTC()`. The [OFX 2.2 specification](https://financialdataexchange.org/common/Uploaded%20files/OFX%20files/OFX%202.2.pdf) defines bounded date/time components rather than overflow normalization.
- **Suggested fix:** Require a full-string match, validate month/day against the actual calendar and hour/minute/second/offset ranges before constructing a timestamp, then verify the constructed UTC components round-trip. Reject the row with a line-scoped parse error. Add mirrored server/browser tests plus a conformance table for invalid month, day, leap day, hour, minute, second, offset, and trailing junk.

### C5-DBG-002 — The OFX required-field guard reports neither independently missing date nor missing amount

- **Severity:** Medium
- **Confidence:** High
- **Status:** confirmed
- **Location:** `packages/parser/src/ofx/index.ts:168-203`; mirrored browser implementation `apps/web/src/lib/parser/ofx.ts:127-150`; downstream calendar handling `packages/core/src/analysis/context.ts:100-118`
- **Concrete failure scenario:** A transaction has `TRNAMT=-1000` and `NAME=MISSING` but no `DTPOSTED`. Both parsers emit `{date:"", amount:1000}` without an error. In a mixed statement the row is later excluded from optimization as an invalid-date transaction; if it is the only row, analysis fails with a generic no-valid-date error instead of identifying the malformed OFX record. Conversely, a row with a date but no `TRNAMT` silently disappears with no transaction and no error.
- **Evidence:** `if (!dtPosted && !trnAmt) continue` handles only the case where both required values are absent. With only the date absent, `parseOFXDate("")` returns `""`, and `if (!isValidISODate(date) && dateRaw)` is bypassed because `dateRaw` is falsy. With only the amount absent, parsing returns `null`, but the error is conditional on `trnAmt.trim()` being nonempty. Executable probes reproduced both behaviors; server and browser copies agree.
- **Suggested fix:** Validate `DTPOSTED` and `TRNAMT` independently before parsing. Emit a line-scoped missing-required-field error and skip the row when either is absent; do not use a truthiness guard to suppress diagnostics for empty required values. Add server/browser and conformance tests for each missing field, both missing fields, and a mixed valid/invalid statement so partial-import diagnostics remain visible.

## Final missed-issue sweep

The closing pass covered every parser format's required-field behavior, `Date`/numeric normalization, swallowed catches, worker and navigation ownership, stale persistence, timer/listener cleanup, and CLI/report failure surfaces. The OFX implementations are duplicated under a known deferred parser-consolidation item, so this review reports the current behavioral defects and calls for mirrored fixes rather than re-reporting duplication itself. No additional debugger issue met the evidence threshold.
