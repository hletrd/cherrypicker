# Verifier -- Cycle 27

**Date:** 2026-05-05

## Previous cycle verification

- Cycle 26 F1 (PDF reversed column order merchant extraction): **CONFIRMED FIXED** -- Math.min/Math.max scanning
- Cycle 26 F2 (reversed column order tests): **CONFIRMED FIXED** -- tests in table-parser.test.ts

## Current cycle findings

- F1 (PDF AMOUNT_PATTERN year false-positive): **CONFIRMED** -- regex `[\d,]+` matches "2024"
- F2 (missing year-value rejection tests): **CONFIRMED** -- no year-value amount tests exist