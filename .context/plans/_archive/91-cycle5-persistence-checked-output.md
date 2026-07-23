# Plan 91 — Cycle 5 Persistence and Checked Output

**Findings:** C5-003, C5-006, C5-017
**Status:** complete
**Deploy mode:** none

## Outcome

Persisted analysis is fully validated before use, reset never claims to clear
data that remains durable, and every public financial summary uses checked
integer aggregation before emitting output.

## Implementation

1. Replace the partial persisted-transaction predicate with a complete runtime
   schema for optional subcategory, confidence, installments, payment/channel
   enums, exclusion-tag arrays, provenance records, memo/raw category, and
   other optimizer facts. Validate statement period object shape and real ISO
   date order at the same boundary.
2. Quarantine or remove malformed persisted records with the existing visible
   corruption warning; no accepted value may crash reoptimization.
3. Make reset durable-clear-first. If deletion fails, preserve the coherent
   in-memory result and present an actionable failure. Clear visible state only
   after the analysis key is gone; handle the noncritical dismissal key
   separately.
4. Expose one checked nonnegative-money aggregation path and use it in terminal
   category/grand totals, standalone HTML report totals, and CLI `analyze`.
   Validate before any partial table/report output.

## Tests and evidence

- Table-driven persisted optional-field and period validation, including the
  object-shaped exclusion-tag crash reproduction.
- Reset deletion-failure → same-session and reload tests with an injected
  storage adapter.
- Terminal/report/CLI tests for exact-safe sums, same/cross-category overflow,
  zero/refund filtering, nonzero exit, stable Korean diagnostics, and no
  partial output.
- Web, core, viz, CLI, type, lint, build, and browser gates.

## Acceptance

- [x] Every persisted optional field is shape- and range-validated.
- [x] Malformed persisted facts cannot reach calculator or formatter methods.
- [x] A failed durable clear leaves the current result visible and recoverable.
- [x] Unsafe visualization aggregates fail before any exact-looking output.

## Evidence

- Focused persistence, core, web, and disclosure coverage passed 115 tests;
  the visualization/output lane passed 128 tests and the CLI overflow lane
  passed 2 focused tests.
- Current-version persisted records now validate required counts, optional
  transaction facts, warning/container shapes, periods, and nested optimizer
  data, while legacy migrations retain their sanitizing behavior.
- Reset failure injection preserves the current result, and terminal, report,
  CLI, persistence, and cross-month public totals all use checked aggregation
  before rendering.
