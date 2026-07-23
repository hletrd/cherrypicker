# Plan 90 — Cycle 5 Parser and Input Integrity

**Findings:** C5-002, C5-004, C5-005, C5-014, C5-015
**Status:** complete
**Deploy mode:** none

## Outcome

Every byte-oriented parser uses one encoding contract, delimiter detection
agrees with quote-aware parsing, bank adapters enforce the same required
merchant contract, and malformed OFX timestamps or missing fields fail with
specific, parity-tested diagnostics.

## Implementation

1. Route server and browser JSON/OFX/HTML/HTML-as-XLS text bytes through the
   shared BOM/strict-UTF-8/CP949 decoder. Honor declared OFX/HTML charset when
   present and reject unsupported JSON encoding explicitly rather than
   returning mojibake.
2. Replace raw delimiter character totals with quote-aware logical-record
   sampling and stable-column scoring. Ignore candidate punctuation inside
   quoted and multiline fields.
3. Define one required date/merchant/amount contract for generic CSV,
   bank-specific CSV, and XLSX. Reject a missing merchant header and emit
   bounded row diagnostics for blank required merchant values in both server
   and browser implementations.
4. Make OFX timestamp parsing require a full match, validate calendar,
   time-zone, and clock component ranges before construction, and verify the
   result round-trips.
5. Validate `DTPOSTED` and `TRNAMT` independently before parsing; skip malformed
   rows with line-scoped missing-field errors while retaining valid rows.

## Tests and evidence

- CP949 and UTF-16 server/browser fixtures for OFX, HTML, and HTML-as-XLS,
  including Korean merchant categorization.
- Competing quoted punctuation, escaped quote, and multiline logical-record
  delimiter parity tests.
- Missing merchant header and blank-cell CSV/XLSX parity fixtures.
- OFX conformance tables for month/day/leap-day/hour/minute/second/offset,
  trailing junk, each missing field, both missing fields, and mixed valid rows.
- Parser package, browser parser, conformance, type, lint, build, and E2E gates.

## Acceptance

- [x] Valid legacy Korean text is decoded identically on server and browser.
- [x] Quoted punctuation cannot change delimiter selection.
- [x] Every adapter reports missing merchant data consistently.
- [x] Invalid timezone-bearing timestamps never normalize into accepted dates.
- [x] Every missing OFX required field has a stable, line-scoped diagnostic.

## Evidence

- The parser matrix passed 656 tests across 13 files with 1,699 assertions;
  browser parser parity passed 161 tests across 7 files with 330 assertions.
- Regression probes cover BOM and declared charset decoding, bounded
  HTML-as-XLS sniffing, quoted and multiline delimiter selection, physical
  line diagnostics, required date/merchant fields, and strict OFX timestamps.
- Parser typechecks and the Astro/Svelte production compile passed with zero
  diagnostics.
