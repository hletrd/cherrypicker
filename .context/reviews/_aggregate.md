# Cycle 14 Aggregate Review

## Summary
After 13 cycles of parser improvements, the core parsing infrastructure is mature. Remaining actionable findings focus on: (1) XLSX formula error cell handling, (2) PDF text extraction parity between server and web, (3) error message consistency, and (4) test coverage gaps for edge cases.

## Prioritized Findings

### Actionable This Cycle
| ID | Source | Severity | Finding |
|---|---|---|---|
| F-CR-4 | code-reviewer | Medium | `extractPages` missing space insertion logic |
| F-CR-5 | code-reviewer | Medium | Web PDF text extraction loses positional info |
| F-CR-2 | code-reviewer | Low | CSV generic parser uses English error messages |
| F-CR-1 | code-reviewer | Medium | XLSX formula error cells produce confusing messages |
| F-TEST-1 | test-engineer | Medium | No test for XLSX formula error cells |

### Deferred (from prior cycles + this cycle)
| ID | Finding | Reason |
|---|---|---|
| F-ARC-4 | Server/web column-matcher duplication | Different build systems |
| F-CR-3 | Web splitLine duplicates server splitCSVLine | Acknowledged in NOTE(C70-04) |
| F-CR-8 | PDF DATE_PATTERN lookahead edge case | Works correctly, low priority |
| F-ARC-5 | XLSX percentage cells | Unlikely in credit card statements |

## Plan
1. Fix XLSX formula error detection in both server and web parsers
2. Fix `extractPages` to add space insertion (parity with `extractPagesFromBuffer`)
3. Fix web PDF text extraction to use Y-coordinate line breaks
4. Fix English error messages in server CSV generic parser to Korean
5. Add tests for XLSX formula error cells
6. Add test for extractPages space insertion
