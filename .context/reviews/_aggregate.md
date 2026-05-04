# Cycle 18 Aggregate Review

## Summary
6 findings identified after deep review of server + web parsers. 3 are actionable
format diversity / parity fixes, 2 are test coverage gaps, and 1 is a defensive
hardening item.

## Prioritized Findings

### Must Fix (P1)
| ID | Finding | Files |
|----|---------|-------|
| F18-01 | Server-side XLSX `parseAmount()` strips whitespace AFTER parenthesized negative check — `( 1,234)` would fail the `startsWith('(')` check. All other parsers (CSV shared, PDF server, web CSV/XLSX/PDF) strip whitespace first or after trim(). Fix: strip whitespace before parenthesized check. | packages/parser/src/xlsx/index.ts |
| F18-02 | Web-side CSV `parseAmount()` missing `.replace(/\s/g, '')` for whitespace inside amounts (e.g., "1 234" from some bank exports). Server CSV shared has this (C70-04), web CSV does not. | apps/web/src/lib/parser/csv.ts |

### Should Fix (P2)
| ID | Finding | Files |
|----|---------|-------|
| F18-03 | Web-side CSV bank adapter header detection uses strict `includes()` requiring exact keyword matches (e.g., `normalizedCells.includes('이용일') && normalizedCells.includes('가맹점')`). Server-side factory uses flexible `some()` with `normalizeHeader()`. If a bank variant adds parenthetical suffix like "이용금액(원)", web adapters could fail to match while server-side succeeds. | apps/web/src/lib/parser/csv.ts |

### Test Coverage (P3)
| ID | Finding | Files |
|----|---------|-------|
| F18-04 | No test for parenthesized negative amounts `(1,234)` in XLSX parser tests | packages/parser/__tests__/xlsx.test.ts |
| F18-05 | No test for spaced amounts "1 234" or "₩ 1,234" in CSV shared tests | packages/parser/__tests__/csv-shared.test.ts |

### Deferred
| ID | Finding | Reason |
|----|---------|--------|
| D-01 | Web-side CSV factory refactor | Major refactor; out of scope for format diversity cycle |
| D-02 | Duplicate BANK_COLUMN_CONFIGS (web xlsx vs server xlsx/adapters) | Requires shared module between Bun and browser builds |
| D-03 | PDF multi-line header support | Complex PDF layout parsing, low frequency |