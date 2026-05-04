# Cycle 71 Architect Review

## A71-01: Leading-plus amount pattern gap (FORMAT DIVERSITY)

The leading-plus amount format (`+1,234`) was added to parse functions in C66-02 but the column-detection patterns were not updated. This is a consistency gap between the two stages of parsing (detection vs extraction). Fix is straightforward: add the pattern to all 4 relevant regex arrays.

## Deferred Items (unchanged)

- PDF multi-line headers: architecturally complex, marginal benefit
- Historical amount display format: not a parser concern
- Card name suffixes: not a parser concern
- Global config integration: not blocking
- CSS dark mode: not a parser concern

## Architecture is mature and stable after 70 cycles.