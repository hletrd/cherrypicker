# Plan 74 — Cycle 2 Parser and CLI Completeness

**Findings:** C2-005, C2-006, C2-007, C2-008, C2-009, C2-022
**Deploy mode:** none
**Status:** completed
**Archived:** 2026-07-23 after Cycle 2 closure

## Outcome

Prevent partial or calendar-invalid statement data from looking complete or
influencing financial recommendations, and render all CLI diagnostics safely.

## Tasks

- [x] Extract a runtime-neutral calendar partition helper used by web and CLI.
  Quarantine invalid dates, choose the latest valid month, and derive only the
  exact previous calendar month.
- [x] Use that helper in `optimize` and `report`; abort when no valid current
  rows remain and disclose every excluded row. Add adjacent-month, gap,
  out-of-order, monthly-cap, and global-cap integration tests.
- [x] Align remote PDF input limits with actual behavior: reject input beyond
  the supported complete-request ceiling, or chunk it without omission. This
  cycle must not silently truncate.
- [x] Reject an entire malformed remote PDF response or return structured
  row-level errors that the caller exposes. Assert input/output/rejected counts.
- [x] Preserve actionable parser errors when a web parse yields zero
  transactions; use the generic empty message only when the parser supplied no
  diagnostic.
- [x] Add one terminal-safe renderer for C0/C1, CSI/OSC, carriage-return, and
  bidi controls. Apply it to analyze/optimize/report warnings and test CSI,
  OSC-8, OSC-52, CR, and bidi payloads.

## Acceptance

- [x] Invalid-date or non-latest-month rows cannot change a CLI recommendation.
- [x] Remote PDF fallback cannot succeed with undisclosed omitted input/rows.
- [x] Zero-row uploads surface the parser’s first actionable error.
- [x] Crafted statement data cannot emit terminal control sequences.
- [x] Parser, web, CLI, and report integration tests pass.

## Coverage

| Finding | Completion evidence |
|---|---|
| C2-005 | shared calendar partition and cap integration tests |
| C2-006 | invalid-date quarantine and excluded-row disclosure |
| C2-007 | complete-input limit test after character 8,000 |
| C2-008 | malformed-row failure/disclosure test |
| C2-009 | analyzer zero-row error propagation test |
| C2-022 | terminal control/bidi sanitizer tests |
