# Cycle 17 — Code Review

**Date:** 2026-05-05
**Scope:** Code quality, logic correctness, maintainability, parity gaps

## Findings

### C17-CR01 [MEDIUM] — Server-side PDF fallback scanner trailing-minus capture group broken
- **File:** `packages/parser/src/pdf/index.ts:318`
- **Issue:** The fallback amount pattern has `([\d,]*(?:,|\d{5,})[\d,]*)-` where the trailing minus is OUTSIDE the capture group. This means `amountMatch[6]` captures "1,234" without the minus sign. The captured string is then passed to `parseAmountString()` which does NOT see the trailing minus and parses it as a positive amount.
- **Web-side parity:** The web-side pattern at `apps/web/src/lib/parser/pdf.ts:573` correctly wraps the minus INSIDE the capture group: `([\d,]*(?:,|\d{5,})[\d,]*-)`. The web-side `parseAmount()` then handles the trailing minus correctly.
- **Impact:** PDF statements with trailing-minus negative amounts (e.g., "1,234-") will have those amounts parsed as positive values in the server-side fallback scanner, inflating spending totals and producing incorrect optimization results.
- **Fix:** Change the server-side regex to match the web-side: `([\d,]*(?:,|\d{5,})[\d,]*-)` — move the minus inside the capture group.
- **Confidence:** High

### C17-CR02 [MEDIUM] — `findField` uses `in` operator enabling prototype chain traversal
- **File:** `apps/web/src/lib/parser/json.ts:58`, `packages/parser/src/json/index.ts:65`
- **Issue:** `if (alias in obj) return obj[alias];` traverses the prototype chain. If an attacker can pollute `Object.prototype` (via a vulnerable dependency or XSS), they could cause `findField` to return attacker-controlled values for transaction field names.
- **Impact:** Low-Medium — requires prototype pollution capability, which is not currently exposed in the codebase. But the pattern is unsafe by design.
- **Fix:** Use `Object.hasOwn(obj, alias)` for own-property lookup. If targeting older browsers, use `Object.prototype.hasOwnProperty.call(obj, alias)`.
- **Confidence:** Medium

### C17-CR03 [LOW] — `MIGRATIONS` object uses `any` type, bypassing type safety
- **File:** `apps/web/src/lib/store.svelte.ts:115`
- **Issue:** `const MIGRATIONS: Record<number, (data: any) => any>` uses `any` for both input and output of migration functions. When persisted data is loaded from sessionStorage and migrations are applied, type safety is completely bypassed.
- **Impact:** Medium — sessionStorage is same-origin only. However, if an attacker gains XSS access, they could inject malformed data into sessionStorage that passes through migrations without validation.
- **Fix:** Replace `any` with `unknown` and add runtime validation inside each migration function. The current Record is empty (no migrations yet), so fixing this now prevents future migration functions from inheriting the unsafe pattern.
- **Confidence:** Medium

### C17-CR04 [LOW] — `normalizeHTML` only handles 6 specific tags, missing common malformed variants
- **File:** `apps/web/src/lib/parser/html.ts:27`, `packages/parser/src/csv/shared.ts:180`
- **Issue:** The regex `<\/(td|th|tr|table|thead|tbody)\s+>` only normalizes malformed closing tags for 6 specific tags. Korean bank HTML exports may contain malformed closing tags for other elements like `</div   >`, `</span   >`, `</p   >`, `</br   >`, `</li   >`.
- **Impact:** Low — SheetJS may handle some of these gracefully, but unclosed/malformed tags for structural elements could cause table parsing failures.
- **Fix:** Broaden the regex to handle any tag: `<\/([a-z][a-z0-9]*)\s+>`.
- **Confidence:** Low

### C17-CR05 [LOW] — Web-side PDF `parseAmount` missing full-width plus sign `＋` handling
- **File:** `apps/web/src/lib/parser/pdf.ts:246-274`
- **Issue:** The web-side `parseAmount` handles full-width digits, comma, dot, minus, and parentheses, but does NOT normalize the full-width plus sign `＋` (U+FF0B) to ASCII `+`. Some Korean bank exports may use full-width plus signs.
- **Impact:** Very low — plus signs are rarely used and typically indicate positive amounts that would parse correctly even if the plus is preserved.
- **Fix:** Add `.replace(/＋/g, '+')` alongside the other full-width normalizations.
- **Confidence:** Low

### C17-CR06 [LOW] — Server-side `parseAmountString` also missing full-width plus sign
- **File:** `packages/parser/src/csv/shared.ts:142-148`
- **Issue:** Same as C17-CR05 — the shared `parseAmountString` function doesn't normalize full-width plus sign `＋` (U+FF0B).
- **Fix:** Add `.replace(/＋/g, '+')` to the cleaning chain.
- **Confidence:** Low

## Summary

| Severity | Count |
|----------|-------|
| MEDIUM | 2 |
| LOW | 4 |

**Verdict:** REQUEST CHANGES — C17-CR01 is a genuine parity bug that causes incorrect amount parsing in the server-side PDF fallback scanner.
