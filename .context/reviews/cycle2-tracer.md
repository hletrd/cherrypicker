# Cycle 2 Tracer Review — Causal Tracing of Suspicious Flows

---

## F-TRC-01: Tracing column-matcher adoption gap across parsers
**Severity: High | Confidence: High**

**Observation**: Cycle 1 created `column-matcher.ts` with shared pattern constants and `findColumn()`. Tracing its adoption:

| Parser | Uses ColumnMatcher? | Uses shared patterns? |
|--------|-------------------|---------------------|
| Server CSV adapter-factory | YES | YES |
| Server CSV generic | NO (inline regex) | NO |
| Server XLSX | NO (inline regex) | NO |
| Web CSV adapters | NO (indexOf) | NO |
| Web XLSX | NO (inline regex) | NO |
| Server PDF | N/A (date cells, not headers) | N/A |
| Web PDF | N/A (date cells, not headers) | N/A |

Only 1 out of 5 header-detection-capable parsers uses the shared column-matcher. The generic CSV parser and XLSX parser have their own inline regexes that could drift from the column-matcher constants.

**Causal chain**: ColumnMatcher created -> adapter-factory adopted -> generic/XLSX parsers not updated -> pattern drift risk.

---

## F-TRC-02: Tracing header keyword set duplication
**Severity: Medium | Confidence: High**

The HEADER_KEYWORDS array (list of all known Korean column header names) is duplicated in:
1. `packages/parser/src/csv/generic.ts` lines 38-42
2. `packages/parser/src/xlsx/index.ts` lines 124-128
3. `apps/web/src/lib/parser/csv.ts` lines 149-153
4. `apps/web/src/lib/parser/xlsx.ts` lines 360-364

These are 4 independent copies of the same vocabulary. Adding a new keyword (e.g., '승인번호') requires updating 4 files.

**Root cause**: No shared header keyword vocabulary module.

---

## F-TRC-03: Tracing the category-based header detection propagation
**Severity: Medium | Confidence: High**

The "require 2+ keyword categories" fix was implemented independently in 3 places:
1. Server generic CSV (generic.ts lines 73-79) - uses `Set.has()` on trimmed cells
2. Web generic CSV (csv.ts lines 176-179) - uses `Set.has()` on trimmed cells
3. Web XLSX (xlsx.ts lines 378-386) - uses `Set.has()` on trimmed cells

NOT implemented in:
4. Server XLSX (xlsx/index.ts lines 161-169) - only checks matchCount >= 2
5. Server adapter-factory (adapter-factory.ts line 79) - only checks one keyword match

**Failure path**: Server-side XLSX file with summary row containing two amount keywords -> misidentified as header -> all rows parsed with wrong column mapping -> zero or wrong transactions returned.

---

## F-TRC-04: Tracing the web-side adapter fallthrough behavior
**Severity: Low | Confidence: High**

When the web-side CSV parser encounters a bank-specific adapter failure:
1. It tries the matched adapter (csv.ts line 983)
2. On throw, catches and falls through to generic parser (line 988)
3. But it does NOT try other bank adapters via signature detection (line 998)
4. The generic parser is tried last

This means if `detectBank` incorrectly identifies the bank, the wrong adapter is tried first, fails, and the generic parser is used. The server-side has the same behavior but also tries all adapters via signature detection (index.ts lines 63-76).

**Impact**: Minimal — the generic parser handles most cases. But the server-side has a better recovery path.