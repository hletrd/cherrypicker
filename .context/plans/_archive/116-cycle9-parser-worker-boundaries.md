# Plan 116 — Cycle 9 Date Grammar and Worker Settlement

**Findings:** C9-006 (Medium/High), C9-007 (Low/Medium)
**Status:** completed (archived)
**Deploy mode:** none

## Evidence

- The shared four-digit date regex is not end-anchored and Korean forms are
  unanchored at both ends. Arbitrary adjacent text is silently discarded.
- Valid statement datetime suffixes and known trailing formatting delimiters
  are intentional, but the parser does not distinguish them from junk.
- Parser and optimizer worker wrappers settle on `message`, `error`, abort,
  and synchronous send failure, but not the standard `messageerror` event.

## Outcome

Date parsing accepts only explicit plain-date/datetime grammars, and every
owned worker terminal event settles exactly once and releases listeners and
the worker.

## Implementation

1. Replace prefix extraction with anchored grammars for supported separated,
   compact, Korean full/short, and explicitly supported time suffixes.
   Preserve documented trailing date delimiters without allowing arbitrary
   alphabetic, Korean, numeric, or punctuation payloads.
2. Keep server/browser parser parity by using the package-owned date utility
   and extend shared conformance cases across JSON, CSV, XLSX/date-cell, and
   PDF consumers.
3. Add `messageerror` to parser and optimizer worker interfaces. Reject with a
   sanitized communication error, remove the listener in common cleanup, and
   terminate exactly once.
4. Extend fake-worker tests to emit `messageerror`, then assert one rejection,
   listener removal, termination, and no later resolve/reject after another
   event or abort.

## Acceptance

- [x] Valid statement dates, explicit datetimes, and known trailing delimiters
      retain current behavior.
- [x] Arbitrary prefixes/suffixes are rejected with parser diagnostics.
- [x] Parser and optimizer promises settle and clean up on `messageerror`.
- [x] Server/browser date behavior remains conformant.

## Execution note

`ralph` is unavailable. Prompt 3 will use focused grammar tables and fake
worker state-machine tests as the manual iterative fallback.

## Completion evidence

- Anchored date and datetime grammars reject junk prefixes and suffixes while
  preserving supported formats, including PDF token boundaries.
- Parser and optimizer worker tests prove sanitized `messageerror` rejection,
  common listener cleanup, exact-once settlement, and termination. The parser
  and browser suites plus the full gate matrix passed.
