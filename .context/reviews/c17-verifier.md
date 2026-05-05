# Cycle 17 — Verifier Review

**Date:** 2026-05-05
**Scope:** Evidence-based correctness check against stated behavior

## Findings

### C17-VER01 [HIGH] — Verified: server-side PDF fallback trailing-minus bug exists
- **Evidence:**
  - Server regex (packages/parser/src/pdf/index.ts:318): `([\d,]*(?:,|\d{5,})[\d,]*)-`
  - Web regex (apps/web/src/lib/parser/pdf.ts:573): `([\d,]*(?:,|\d{5,})[\d,]*-)`
  - Server capture group 6 captures "1,234" (without minus)
  - Web capture group 6 captures "1,234-" (with minus)
  - Server passes "1,234" to `parseAmountString` which returns `1234` (positive)
  - Web passes "1,234-" to `parseAmount` which returns `-1234` (negative)
- **Conclusion:** Confirmed bug. The server-side incorrectly parses trailing-minus amounts as positive.

### C17-VER02 [MEDIUM] — Verified: `findField` uses `in` operator
- **Evidence:** `apps/web/src/lib/parser/json.ts:58`: `if (alias in obj) return obj[alias];`
- **Conclusion:** Confirmed. Should use `Object.hasOwn`.

### C17-VER03 [MEDIUM] — Verified: `MIGRATIONS` uses `any`
- **Evidence:** `apps/web/src/lib/store.svelte.ts:115`: `const MIGRATIONS: Record<number, (data: any) => any>`
- **Conclusion:** Confirmed. Should use `unknown`.

### C17-VER04 [LOW] — Verified: `normalizeHTML` regex is narrowly scoped
- **Evidence:** `apps/web/src/lib/parser/html.ts:27`: `html.replace(/<\/(td|th|tr|table|thead|tbody)\s+>/gi, '</$1>')`
- **Conclusion:** Confirmed. Only handles 6 specific tags.

## Summary

All reported findings verified against actual code. C17-VER01 is the highest-confidence bug with direct evidence of behavioral divergence.
