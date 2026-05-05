# Debugger — cherrypicker (Cycle 20)

**Reviewer:** debugger (sonnet)
**Scope:** Root-cause analysis, edge cases, failure modes
**Date:** 2026-05-05

---

## Summary

Cycle 19 fixed BankId validation and monthly spending consistency. Cycle 20 review finds 3 new failure modes: OFX amount parsing divergence between server and web, a potential regex exception in tag extraction, and a stale forward-fill edge case in HTML parsing.

---

## New Findings

### [C20-DB01-MEDIUM] Server/web OFX amount parsing diverges on edge cases

**Files:** `packages/parser/src/ofx/index.ts:108-114` vs `apps/web/src/lib/parser/ofx.ts:79-81`
**Confidence:** High

Server-side OFX amount parsing is minimal (strip commas, parseFloat). Web-side uses full `parseAmountString` which handles full-width digits, Won signs, 마이너스 prefix, etc. A malformed OFX with full-width amounts would parse differently between server and web.

**Failure scenario:** User exports OFX from a legacy Korean bank that uses full-width digits. Web app parses correctly. CLI tool (server-side) fails to parse amounts, returning null and skipping transactions silently.

**Fix:** Unify on `parseAmountString` in both parsers.

---

### [C20-DB02-MEDIUM] Regex syntax error if OFX tag contains metacharacters

**Files:** `packages/parser/src/ofx/index.ts:59-69`
**Confidence:** Medium

```ts
const xmlRe = new RegExp(`<${tagName}[^>]*>\\s*([^<]+?)\\s*</${tagName}>`, 'i');
```

If an OFX file contains `<DTPOSTED+20240115>` (malformed but possible), the regex construction throws `SyntaxError: Invalid regular expression`. The parser catches no exceptions around this line, so the entire parse would fail with an unhandled exception.

**Fix:** Wrap regex construction in try/catch, or escape tagName before interpolation.

---

### [C20-DB03-LOW] HTML forward-fill may propagate summary row values to merged cells

**Files:** `apps/web/src/lib/parser/html.ts:141-244`
**Confidence:** Medium

If the first data row after a header is a summary row (e.g., "총합계" with an amount), the forward-fill `lastAmount` gets set to the summary amount. Subsequent merged cells in the same column would forward-fill this summary value.

**Failure scenario:** Malformed HTML export where a subtotal row appears immediately after the header, before actual data rows. Merged cells below would inherit the subtotal amount.

**Fix:** Guard the fallback path with `isSummaryRow` check, as suggested in code-reviewer C20-04.

---

## Previously Reported — Status

| ID | Status | Notes |
|----|--------|-------|
| D-DEB-03: OFX date parser strips timezone | **OPEN** | Still uses `replace(/[^0-9].*$/, '')` |
| D-DEB-05: HTML forward-fill mutates array | **OPEN** | Still in-place mutation |

---

## Verdict

**FIX AND SHIP** — C20-DB01 and C20-DB02 are bounded, high-confidence fixes.
