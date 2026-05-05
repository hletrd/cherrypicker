# Code Review — cherrypicker (Cycle 20)

**Reviewer:** code-reviewer
**Scope:** Full repository — correctness, maintainability, type safety
**Date:** 2026-05-05

---

## Summary

Cycle 19 fixed several consistency issues (monthly spending normalization, BankId validation, esc() double-encoding). Cycle 20 review identifies 4 new findings: a server/web OFX amount parsing parity gap, a dynamic regex construction vulnerability in OFX tag extraction, a stale cache invalidation edge case in the analyzer, and a missing negative-zero guard in the web-side amount validator.

---

## New Findings

### [C20-01-MEDIUM] Server-side OFX amount parser lacks full-width normalization

**Files:** `packages/parser/src/ofx/index.ts:108-114` vs `apps/web/src/lib/parser/ofx.ts:79-81`
**Confidence:** High

The server-side `parseOFXAmount` uses a minimal implementation:
```ts
function parseOFXAmount(raw: string): number | null {
  if (!raw.trim()) return null;
  const cleaned = raw.trim().replace(/,/g, '');
  const n = parseFloat(cleaned);
  if (Number.isNaN(n) || !Number.isFinite(n)) return null;
  return Math.round(n);
}
```

The web-side delegates to `parseAmountString` which handles full-width digits, full-width parentheses, Won signs, 마이너스 prefix, trailing minus, and KRW prefix. If a Korean bank exports OFX with full-width amounts (rare but possible in legacy systems), the server-side parser would return null while the web-side would succeed.

**Fix:** Replace server-side `parseOFXAmount` with `parseAmountString` (already exported from `csv/shared.ts`), or extract a shared `normalizeAmount` utility.

---

### [C20-02-MEDIUM] Dynamic regex construction in OFX extractTag without sanitization

**Files:** `packages/parser/src/ofx/index.ts:59-69`, `apps/web/src/lib/parser/ofx.ts:34-40`
**Confidence:** High

Both server and web OFX parsers construct RegExp from user-provided content:
```ts
const xmlRe = new RegExp(`<${tagName}[^>]*>\\s*([^<]+?)\\s*</${tagName}>`, 'i');
```

The `tagName` comes from hardcoded strings in the parser (`'DTPOSTED'`, `'TRNAMT'`, etc.), so it's not directly user-controlled. However, if this pattern is ever copied/modified to accept dynamic tag names from parsed content, it becomes a ReDoS vector. More immediately, if an OFX file contains tags with special regex characters (e.g., `<DTPOSTED+>`, `<TRNAMT.>`), the regex construction could throw or behave unexpectedly.

**Fix:** Add a regex escape helper for tagName before interpolation:
```ts
function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
```

---

### [C20-03-LOW] Web-side `isValidAmount` comment claims negative amounts are accepted but code rejects them

**Files:** `apps/web/src/lib/parser/csv.ts:169-180`
**Confidence:** High

The comment says:
```ts
// Skip zero-amount rows (balance inquiries) but accept negative amounts
// (refunds/credits) by letting callers take absolute value (C100-02).
```

But the actual code:
```ts
if (amount === 0) return false;
return true;
```

This returns `true` for negative amounts, which then passes to the caller where `if (amount <= 0) continue;` skips them. The comment is misleading — negative amounts are NOT accepted into the transaction stream. They're passed through the type guard then immediately filtered. The server-side `isValidCSVAmount` is clearer: it explicitly rejects `amount <= 0`.

**Fix:** Align web-side `isValidAmount` with server-side: change to `if (amount <= 0) return false;` and remove the misleading comment.

---

### [C20-04-LOW] Stale `lastAmount` forward-fill in HTML parser could propagate summary row values

**Files:** `apps/web/src/lib/parser/html.ts:197-204`
**Confidence:** Medium

The HTML parser forward-fills amount column values (`lastAmount`) but applies `isSummaryRow()` guard when updating the last-value. However, the `isSummaryRow` check on line 200 tests the raw cell value, not the row context. If a data cell happens to contain text that matches `isSummaryRow` (e.g., a merchant named "총합계마트" — though the boundary constraints make this unlikely), the forward-fill would skip updating `lastAmount`.

More realistically: if a summary row has non-empty cells in non-tracked columns (e.g., a memo column), the `row.every((c) => !c)` check at line 143 won't skip it because some cell is non-empty. Then `isSummaryRow(rowText)` at line 146 catches it. But if the summary row has an amount cell, the `isSummaryRow(String(rawAmountValue))` at line 200 returns true, so `lastAmount` is NOT updated — good. But the `amountRaw` at line 204 uses `isNonEmpty(rawAmountValue) ? rawAmountValue : lastAmount`, meaning it falls back to the previous `lastAmount`. This is correct behavior for merged cells.

The real issue: there's no guard against `lastAmount` itself being a summary-row value from earlier in the document. If the first data row after the header is a summary row (unusual but possible in malformed HTML), `lastAmount` gets set to the summary amount, and subsequent merged cells would forward-fill that summary value.

**Fix:** Add `isSummaryRow` check to the fallback path:
```ts
const amountRaw = String(amountCol !== -1 ? (isNonEmpty(rawAmountValue) && !isSummaryRow(String(rawAmountValue)) ? rawAmountValue : lastAmount) : '').trim();
```

---

## Verified Fixed (from previous cycles)

| Finding | Status | Evidence |
|---------|--------|----------|
| C19-CR01: Monthly spending uses net in reoptimize | FIXED | `store.svelte.ts:509` uses `tx.amount > 0` |
| C19-CR02: Unsafe cast `options?.bank as BankId` | FIXED | `analyzer.ts:110` validates against `VALID_BANK_IDS` |
| C19-SEC01: esc() double-encoding bypass | FIXED | `generator.ts:35-37` pre-decodes numeric entities |

---

## Verdict

**FIX AND SHIP** — 2 MEDIUM and 2 LOW findings. The OFX amount parsing parity gap (C20-01) and dynamic regex construction (C20-02) are the most actionable.
