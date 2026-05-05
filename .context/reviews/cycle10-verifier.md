# Cycle 10 Verifier Review — Evidence-Based Correctness

**Reviewer:** verifier  
**Cycle:** 10  
**Date:** 2026-05-05

---

## Findings

### [P1-HIGH] Server/web parser parity: Infinity handling mismatch
**Description:** The server-side `parseAmountString` (packages/parser/src/csv/shared.ts:160) and web-side `parseAmount` (apps/web/src/lib/parser/csv.ts:148) both have the Infinity bug. Both should be fixed together to maintain parity.
**Evidence:** Comparing the two files shows identical `Math.round(parseFloat(cleaned))` pattern without finite check.
**Fix:** Fix both simultaneously.
**Confidence:** High

### [P2-MEDIUM] Server/web JSON parser parity: web-side has `description` in MEMO_ALIASES, server-side doesn't
**Description:** apps/web/src/lib/parser/json.ts:52 has `'description'` in MEMO_ALIASES. packages/parser/src/json/index.ts:56 does NOT.
**Evidence:** Server JSON parser MEMO_ALIASES ends with `'승인번호'`. Web JSON parser has `'description'` added after.
**Impact:** JSON files with `description` field parsed differently between server and web.
**Fix:** Add `'description'` to server-side MEMO_ALIASES for parity.
**Confidence:** High

### [P2-MEDIUM] Server/web OFX parser: memo deduplication logic parity
**Description:** Both server (C99-03) and web-side OFX parsers have `memo && memo !== tx.merchant` dedup. Verified consistent.
**Evidence:** packages/parser/src/ofx/index.ts:189-191 and apps/web/src/lib/parser/ofx.ts:143-145 both implement identical logic.
**Status:** Correctly matched. No fix needed.
**Confidence:** High

### [P2-MEDIUM] Server/web HTML parser: normalizeHTML function duplicated
**Description:** Both packages/parser/src/html/index.ts:41 and apps/web/src/lib/parser/html.ts:27 define `normalizeHTML`. The web-side uses `TextEncoder().encode()`, server-side uses `Buffer.from()`.
**Evidence:** Different binary encoding paths. SheetJS should handle both, but it's a parity gap.
**Impact:** Potential encoding issues with non-ASCII content in web vs server.
**Fix:** Document the intentional difference (Buffer not available in browser) or use a shared approach.
**Confidence:** Medium

---

## Summary Table

| Severity | Count |
|----------|-------|
| P1-HIGH | 1 |
| P2-MEDIUM | 3 |

**Verdict:** FIX AND SHIP
