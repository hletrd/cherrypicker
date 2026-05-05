# Cycle 8 Code Review

**Agent:** code-reviewer
**Date:** 2026-05-06
**Scope:** Full repository — cherrypicker Korean credit card optimizer

---

## Findings

### C8-01: Web-side PDF, XLSX, and CSV parsers convert refunds to spending via Math.abs

**Confidence:** High
**Severity:** High

**Files:**
- `apps/web/src/lib/parser/pdf.ts:436` — `amount: Math.abs(amount)`
- `apps/web/src/lib/parser/pdf.ts:620` — `amount: Math.abs(amount)`
- `apps/web/src/lib/parser/xlsx.ts:633` — `amount: Math.abs(amount)`
- `apps/web/src/lib/parser/csv.ts:432` — `amount = Math.abs(amount)`
- `apps/web/src/lib/parser/csv.ts:552` — `amount = Math.abs(amount)`

**Problem:** The web-side PDF, XLSX, and CSV parsers unconditionally apply `Math.abs()` to all non-zero amounts. This converts negative amounts (refunds, credits, chargebacks) into positive spending. The server-side equivalents skip negative amounts entirely:

- Server PDF (`packages/parser/src/pdf/index.ts:208`): `if (amount <= 0) continue;`
- Server XLSX (`packages/parser/src/xlsx/index.ts:409`): `if (amount <= 0) continue;`
- Server CSV adapters (`packages/parser/src/csv/generic.ts:228+`): `if (amount <= 0) continue;`

The web-side HTML parser was fixed in Cycle 7 to match server-side behavior (`if (amount <= 0) continue;` at `apps/web/src/lib/parser/html.ts:214`), but PDF, XLSX, and CSV were missed.

**Failure scenario:** A user uploads a statement containing a 50,000 won refund. On the web app, this becomes +50,000 won spending, inflating totals and producing incorrect optimization results. On the server CLI, the same file correctly skips the refund.

**Fix:** Replace `Math.abs(amount)` with `if (amount <= 0) continue;` in all three web parsers, matching server-side behavior and the already-fixed web HTML parser.

---

### C8-02: Comments claim parity where behavior diverges

**Confidence:** High
**Severity:** Medium

**File:** `apps/web/src/lib/parser/pdf.ts:614-616`

```
// Accept non-zero amounts (including refunds) and take absolute value
// for spending optimization parity with other parsers (C100-02).
```

This comment is false. Server-side parsers do NOT take absolute value of refunds — they skip them. The comment misleads maintainers into believing the behavior is correct.

Same issue in `apps/web/src/lib/parser/csv.ts:430-431`:
```
// Skip zero-amount rows (balance inquiries) but accept negative amounts
// (refunds/credits) by taking absolute value (C100-02).
```

**Fix:** Remove false parity claims from comments. If preserving refunds is intentional, document the deviation from server-side behavior with a clear rationale.

---

### C8-03: build-json.ts exits 0 despite validation errors

**Confidence:** High
**Severity:** Medium

**File:** `scripts/build-json.ts:278-283`

The script collects validation errors from YAML parsing but exits with code 0 regardless. CI pipelines that run this script will not detect card rule validation failures.

**Fix:** Add `process.exit(errors.length > 0 ? 1 : 0)` after reporting.

---

## Verified Fixes from Cycle 7

| Issue | File | Status |
|-------|------|--------|
| C7-01 Web JSON Math.abs | `apps/web/src/lib/parser/json.ts` | Fixed — no Math.abs, preserves negatives |
| C7-02 Web HTML Math.abs | `apps/web/src/lib/parser/html.ts` | Fixed — uses `amount <= 0` skip |
| C7-03 Web OFX timezone | `apps/web/src/lib/parser/ofx.ts` | Fixed — has KST conversion |
| C7-04 FALLBACK_CATEGORY_LABELS | `apps/web/src/lib/category-labels-fallback.ts` | Fixed — auto-generated from YAML |
| C7-05 esc() control chars | `packages/viz/src/report/generator.ts` | Fixed — strips control chars |
| C7-06 JSON negative tests | `packages/parser/__tests__/json.test.ts` | Fixed — test at line 106 |

---

## Final Sweep

- Checked all web-side parsers for Math.abs on amounts
- Verified server-side parity for each format
- Checked comment accuracy against actual code behavior
- No additional logic bugs found in core engine
