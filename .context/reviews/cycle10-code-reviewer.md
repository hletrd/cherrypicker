# Cycle 10 Code Review — Code Quality, Logic, Maintainability

**Reviewer:** code-reviewer  
**Cycle:** 10  
**Date:** 2026-05-05  
**Scope:** Full repository (packages/*, apps/web, tools/*)

---

## Findings

### [P1-HIGH] Infinity propagation in parseAmountString — packages/parser/src/csv/shared.ts:160
**Description:** `parseAmountString` does `const n = Math.round(parseFloat(cleaned)); if (Number.isNaN(n)) return null;`. For inputs like `"1e309"`, `parseFloat` returns `Infinity`, `Math.round(Infinity)` returns `Infinity`, and `Number.isNaN(Infinity)` is `false`. The function returns `Infinity` instead of `null`.
**Impact:** Malicious or malformed bank statements with very large numbers can produce `Infinity` transaction amounts that propagate through the system. The optimizer filters with `Number.isFinite`, but other consumers (report tables, direct API calls) may not.
**Fix:** Add `!Number.isFinite(n)` check: `if (Number.isNaN(n) || !Number.isFinite(n)) return null;`
**Confidence:** High
**Also affects:** apps/web/src/lib/parser/csv.ts:148, apps/web/src/lib/parser/pdf.ts:271

### [P1-HIGH] Infinity propagation in parseOFXAmount — packages/parser/src/ofx/index.ts:111
**Description:** Same pattern: `const n = parseFloat(cleaned); if (Number.isNaN(n)) return null; return Math.round(n);`. `parseFloat("1e309")` returns `Infinity`, passes the NaN check.
**Impact:** OFX files with extreme amount values produce Infinity amounts.
**Fix:** Add `!Number.isFinite(n)` check before returning.
**Confidence:** High
**Also affects:** apps/web/src/lib/parser/ofx.ts:79

### [P2-MEDIUM] Web-side JSON parser delegates Infinity risk to parseCSVAmount — apps/web/src/lib/parser/json.ts:67-75
**Description:** `normalizeAmount` checks `Number.isFinite(raw)` for number inputs, but for string inputs it delegates to `parseCSVAmount` which has the Infinity bug above.
**Impact:** JSON files with string amounts like `"1e309"` bypass the finite check.
**Fix:** Guard the return value of `parseCSVAmount` with `Number.isFinite` in `normalizeAmount`.
**Confidence:** High
**Also affects:** packages/parser/src/json/index.ts:79-87 (server-side)

### [P2-MEDIUM] XLSX parseAmount delegates string parsing to buggy parseAmountString — packages/parser/src/xlsx/index.ts:157-160
**Description:** For number inputs it checks `Number.isFinite`, but for string inputs it directly returns `parseAmountString(raw)` without guarding.
**Impact:** XLSX cells with string values like `"1e309"` produce Infinity.
**Fix:** Guard `parseAmountString` result with `Number.isFinite`.
**Confidence:** High

### [P2-MEDIUM] Missing explicit `any` type guards in store.svelte.ts — apps/web/src/lib/store.svelte.ts:114, 273, 312
**Description:** Three instances of `any` type: `Record<number, (data: any) => any>` and callback parameters.
**Impact:** Type safety erosion in migration and store hydration logic. `any` bypasses the entire type system.
**Fix:** Replace with proper types or `unknown` with runtime validation.
**Confidence:** Medium

### [P3-LOW] esc() over-escapes forward slash — packages/viz/src/report/generator.ts:42
**Description:** `.replace(/\//g, '&#47;')` escapes forward slash in HTML text content. Forward slash does not need escaping in HTML text.
**Impact:** Unnecessary entity encoding. URLs or paths with slashes in card names will display as `&#47;`.
**Fix:** Remove the forward slash replacement line.
**Confidence:** Medium

### [P3-LOW] console.warn in production parser code — packages/parser/src/csv/index.ts:101
**Description:** `console.warn(\`[cherrypicker] Bank adapter ${adapter.bankId} (detect) failed:\`, err);` logs to stderr in production.
**Impact:** Pollutes production logs. Should use a proper logging mechanism or silently collect errors in ParseResult.
**Fix:** Remove console.warn; adapter failures are already collected in `signatureFailures` and returned in the result.
**Confidence:** Low

---

## Summary Table

| Severity | Count | Categories |
|----------|-------|------------|
| P1-HIGH | 2 | Infinity bugs in amount parsing |
| P2-MEDIUM | 4 | JSON/XLSX Infinity delegation, any types |
| P3-LOW | 2 | Over-escaping, console.warn |

**Verdict:** FIX AND SHIP
