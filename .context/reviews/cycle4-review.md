# Cycle 4 Review (2026-05-04)

## Scope
Deep review focusing on: deferred items from cycles 1-3, server/web consistency, format diversity (XLSX, PDF, CSV), encoding, test coverage gaps, architecture quality.

## Method
- Read all parser source files (server-side + web-side)
- Read previous cycle aggregate reviews (c3-aggregate.md, cycle3-review.md)
- Cross-reference server-side vs web-side implementations

---

## HIGH SEVERITY FINDINGS

### F-C4-01: Web-side bank adapters use includes() for header detection, not category-based validation
**Severity: HIGH | Confidence: HIGH**
**File**: apps/web/src/lib/parser/csv.ts (10 adapters)
Server-side adapter-factory.ts requires keywords from >= 2 categories (date, merchant, amount). Web-side adapters use bare cells.includes('exact header').

### F-C4-02: Remaining console.warn in server-side csv/index.ts
**Severity: MEDIUM | Confidence: HIGH**
**File**: packages/parser/src/csv/index.ts:72

## MEDIUM SEVERITY FINDINGS

### F-C4-03: Generic CSV merchant inference picks first non-date column blindly
### F-C4-04: XLSX merged cell handling missing
### F-C4-05: XLSX date cells with Korean locale spacing
### F-C4-06: splitLine non-comma path lacks RFC 4180 quoting
### F-C4-07: Header keyword constants duplicated 4 times
### F-C4-08: CATEGORY/MEMO keywords not in header detection arrays
### F-C4-09: detectFormat reads CSV file twice

## TOTAL FINDINGS: 9 (2 High, 5 Medium, 2 Low)
