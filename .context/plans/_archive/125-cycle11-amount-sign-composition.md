# Plan 125 — Cycle 11 Amount Sign Composition

**Findings:** C11-001 (Low/High)
**Status:** completed
**Deploy mode:** none
**Archived:** 2026-07-24 during Cycle 12 Prompt 2

## Evidence

- The shared amount kernel returns positive `1000` for `-1000-`,
  `마이너스-1000`, and equivalent full-width compositions.
- Generic CSV and JSON paths accept the result without a diagnostic, so a
  refund becomes positive spending before categorization and optimization.
- The fixed Cycle 40–42 `(-1234)` branch handles only parentheses. Existing
  tests cover other negative forms separately, not in composition.

## Outcome

Every accepted combination of negative markers has one negative polarity.
Redundant negative notation may be normalized or rejected, but it can never
become positive spending.

## Implementation

1. Add a table-driven red regression to the canonical amount tests covering
   ASCII and full-width leading minus combined with Korean-minus and
   trailing-minus notation.
2. Add generic CSV and JSON boundary regressions proving the compositions
   cannot create a positive transaction.
3. Replace the decorator-specific double-negation branches with one sign
   rule: detect supported negative markers, parse the numeric payload, and
   apply negative polarity once to its absolute safe-integer magnitude.
4. Preserve ordinary positive, leading-minus, trailing-minus, Korean-minus,
   accounting-parentheses, decimal-rounding, currency, garbage-rejection, and
   safe-integer behavior.
5. Run the focused parser/server-browser parity matrix before repository-wide
   gates.

## Acceptance

- [x] `-1000-`, `마이너스-1000`, and full-width variants never return a
      positive value.
- [x] Generic CSV and JSON never admit the reproduced refund as spending.
- [x] `(-1000)`, `-1000`, `1000-`, and `마이너스1000` remain negative.
- [x] Positive, invalid, rounding, and safe-integer boundary cases remain
      unchanged.
- [x] Server and browser entry points continue to use the one shared kernel.

## Execution note

The requested `ralph` skill is not registered in the available skill roots.
Prompt 3 used the approved manual test-first fallback: add the focused
regressions, capture the expected red result, implement the shared-kernel
repair, then rerun the focused and repository-wide gates. No deployment was
part of this plan.

## Completion evidence

- Commit: `c848436de7339511db697f49864e0c6e539623d2`
  (`🐛 fix(parser): normalize composed negative signs`).
- Expected red: 35 tests passed and 6 failed. Four composed forms returned
  positive `1000`; the CSV and JSON controls each admitted three transactions
  instead of only the positive control.
- Focused green: 260 tests and 437 expectations passed across the canonical
  amount, non-spending parity, shared CSV, browser amount, XLSX parity, and
  browser-boundary suites.
- The shared amount kernel now detects negative polarity once and applies it
  to the absolute rounded safe-integer magnitude.
