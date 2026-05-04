# Cycle 17 Aggregate Review

## Summary
10 findings identified. 3 are actionable this cycle, 4 are low-severity and
should be fixed for consistency, and 3 are test coverage gaps.

## Prioritized Findings

### Must Fix (P1)
| ID | Finding | Files |
|----|---------|-------|
| F17-01 | `normalizeHeader()` misses tab/newline chars | column-matcher.ts (server+web) |
| F17-02 | PDF summary row pattern missing `누계`, `잔액`, `이월`, `소비`, `당월`, `명세` | pdf/index.ts (server+web) |
| F17-04 | XLSX summary row pattern same gap | xlsx/index.ts (server+web) |
| F17-05 | CSV summary row pattern same gap | csv/adapter-factory.ts, csv/generic.ts (server+web) |

### Should Fix (P2)
| ID | Finding | Files |
|----|---------|-------|
| F17-06 | PDF `parseAmount()` missing whitespace stripping | pdf/index.ts (server+web) |
| F17-10 | PDF fallback scanner missing parenthesized negatives | pdf/index.ts (server+web) |

### Test Coverage (P3)
| ID | Finding | Files |
|----|---------|-------|
| F17-08 | No test for tabs in headers | column-matcher.test.ts |
| F17-09 | No test for summary row variants | csv/xlsx/pdf tests |
| F17-10 | No test for parenthesized negatives in PDF fallback | table-parser.test.ts |

### Deferred
| ID | Finding | Reason |
|----|---------|--------|
| F17-03 | PDF fallback false-match on card numbers | Low risk; date+amount co-occurrence makes this unlikely |
| F17-07 | PDF error line tracking | UX improvement, not parser correctness |
| D-01 | Web-side CSV factory refactor | Major refactor, out of scope for format diversity cycle |