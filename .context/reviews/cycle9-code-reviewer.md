# Cycle 9 — Code Reviewer

**Reviewer:** code-reviewer (manual)
**Scope:** Code quality, logic, correctness, parity
**Date:** 2026-05-06

---

## Verified Fixes (from Cycle 8)

### C8-01 FIXED: Web-side PDF, XLSX, CSV negative amount handling
- `apps/web/src/lib/parser/pdf.ts:432` — `if (amount <= 0) continue;` (was Math.abs)
- `apps/web/src/lib/parser/xlsx.ts:611` — `if (amount <= 0) continue;` (was Math.abs)
- `apps/web/src/lib/parser/csv.ts:433,554` — `if (amount <= 0) continue;` (was Math.abs)

### C8-02 FIXED: SUMMARY_ROW_PATTERN ReDoS
- `packages/parser/src/csv/column-matcher.ts:101` — `isSummaryRow` caps input at 500 chars via `text.slice(0, 500)`

### C8-03 FIXED: build-json.ts exits with code 1 on validation errors
- `scripts/build-json.ts:292-294` — `process.exit(1)` when errors exist

---

## New Findings

### C9-01 [LOW] Web-side HTML parser imports `parseCSVAmount` instead of `parseAmountString`

**File:** `apps/web/src/lib/parser/html.ts:10`
**Confidence:** Medium

The web-side HTML parser imports `parseCSVAmount` from `./csv.js` while the server-side imports `parseAmountString` from `../csv/shared.js`. These are functionally equivalent (`parseCSVAmount` is an alias for `parseAmount` which duplicates `parseAmountString` logic), but the divergence means:

1. If `parseAmountString` gains new format support, the web HTML parser won't benefit
2. Two code paths to maintain for the same functionality

**Fix:** Either export `parseAmountString` from the web-side csv module, or import `parseCSVAmount` on the server side for consistency.

---

### C9-02 [LOW] Web-side JSON parser missing `'description'` in MEMO_ALIASES

**File:** `apps/web/src/lib/parser/json.ts:51-54`
**Confidence:** Medium

Server-side JSON parser (`packages/parser/src/json/index.ts:56-59`) includes `'description' /* fallback */` in MEMO_ALIASES. The web-side JSON parser does not. While `description` is also in MERCHANT_ALIASES, the memo fallback allows it to be used when merchant is missing.

**Fix:** Add `'description' /* fallback */` to web-side MEMO_ALIASES.

---

### C9-03 [LOW] Server-side OFX memo/merchant deduplication check uses wrong field

**File:** `packages/parser/src/ofx/index.ts:189-191`
**Confidence:** Medium

```ts
const memo = extractTag(block, 'MEMO');
if (memo && memo !== tx.memo) {
  tx.memo = memo;
}
```

`tx.memo` is `undefined` at this point (not set in the initial `RawTransaction` object), so `memo !== tx.memo` is always true for non-empty memo values. When `name` is empty, `tx.merchant` falls back to the MEMO value (line 183), and then `tx.memo` is also set to the same value — duplicating the data.

The web-side correctly checks `memo !== tx.merchant` (line 144).

**Fix:** Change `tx.memo` to `tx.merchant` in the server-side OFX parser.

---

## Still Open from Previous Cycles

| ID | Description | Severity | Status |
|----|-------------|----------|--------|
| C8-05 | esc() missing DEL (\x7f) and U+FFFE/U+FFFF | MEDIUM | **OPEN** |
| C8-06 | build-json.ts duplicates Zod schemas from @cherrypicker/rules | MEDIUM | **OPEN** |
| C8-07 | No web-side parser-level tests for negative amounts | MEDIUM | **OPEN** |
| C8-04 | No parity test suite between server and web parsers | HIGH | **OPEN** |
| C6-01 | isValidHeaderRow doesn't normalize headers before keyword matching | HIGH | **OPEN** |

---

## Verdict

**FIX NOW:** C9-03 (OFX memo deduplication bug — one-line fix)
**FIX SOON:** C9-01, C9-02 (parity micro-divergences)
**MONITOR:** Parser parity drift continues despite 8+ cycles of fixes
