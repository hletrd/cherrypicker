# Cycle 10 Debugger Review — Latent Bug Surface

**Reviewer:** debugger  
**Cycle:** 10  
**Date:** 2026-05-05

---

## Findings

### [P0-CRITICAL] Infinity amount propagation across all parsers
**Files:** packages/parser/src/csv/shared.ts:160, packages/parser/src/ofx/index.ts:111, apps/web/src/lib/parser/csv.ts:148, apps/web/src/lib/parser/pdf.ts:271, apps/web/src/lib/parser/ofx.ts:79
**Description:** `parseFloat("1e309")` returns `Infinity`. `Math.round(Infinity)` returns `Infinity`. `Number.isNaN(Infinity)` is `false`. The amount parsing functions return `Infinity` instead of `null`.
**Trigger:** Upload a CSV/JSON/OFX/PDF/XLSX with amount string `"1e309"` or any value exceeding float max.
**Impact:** Infinity transaction amounts propagate. The greedy optimizer filters them with `Number.isFinite`, but they still appear in parsed transaction lists, error reports, and could break downstream consumers that don't guard.
**Fix:** Add `!Number.isFinite(n)` check after `Math.round(parseFloat(...))` in all amount parsers.
**Confidence:** High

### [P1-HIGH] Web-side JSON parser stores negative amounts without taking abs — apps/web/src/lib/parser/json.ts:97-99
**Description:** After the C99 fix, JSON parser says "Negative amounts (refunds/credits) are preserved — the optimizer's positive-only filter handles them." But the web-side JSON parser stores negative amounts directly.
**Trigger:** JSON with negative amount values.
**Impact:** Inconsistent with CSV/OFX/HTML parsers which convert negative amounts to positive (spending). The server-side JSON parser does the same (preserves negatives). Need to verify this is intentional parity.
**Fix:** If parity with CSV is intended, add `Math.abs(amount)` for negative amounts. Otherwise document the intentional difference.
**Confidence:** Medium

### [P2-MEDIUM] SplitCSVContent may mishandle escaped quotes at line boundaries — apps/web/src/lib/parser/csv.ts:53-95
**Description:** The quote-counting logic in `splitCSVContent` counts unescaped quotes by checking `i+1 < rawLine.length`. If an escaped quote (`""`) is the last character of a line, the logic may miscount.
**Trigger:** CSV with `""` at the very end of a line within a multi-line quoted field.
**Impact:** Line reassembly may be incorrect for edge-case CSV files.
**Fix:** Add test cases for escaped quotes at line boundaries.
**Confidence:** Low

### [P2-MEDIUM] OFX date parsing timezone offset doesn't handle fractional offsets — packages/parser/src/ofx/index.ts:75-101
**Description:** `parseInt(m[7], 10)` parses timezone offsets as integers. OFX spec allows fractional offsets like `[+5:30]` for IST.
**Trigger:** OFX file from a bank using non-integer timezone offsets.
**Impact:** Date off by 30 minutes for IST transactions.
**Fix:** Use `parseFloat` instead of `parseInt` for timezone offset.
**Confidence:** Low

---

## Summary Table

| Severity | Count |
|----------|-------|
| P0-CRITICAL | 1 |
| P1-HIGH | 1 |
| P2-MEDIUM | 2 |

**Verdict:** FIX AND SHIP
