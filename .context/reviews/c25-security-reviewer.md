# Cycle 25 — Security Reviewer (2026-05-06)

## Finding 1: HTML event handler sanitization parity gap (unquoted pattern) [C25-SEC01] — LOW

**File:** `apps/web/src/lib/parser/html.ts:43`
**Current regex:** `/\son\w+=[^>\s]*/gi`
**Server parity:** `packages/parser/src/csv/shared.ts:192` uses `/\son\w+\s*=\s*[^>\s]*/gi`

The web-side `normalizeHTML` function uses a regex for unquoted event handlers that does NOT permit whitespace around the equals sign. An attacker could craft HTML like:

```html
<td onclick = alert(document.cookie)>value</td>
```

This would survive web-side sanitization but be stripped by the server-side implementation.

**Attack vector:** Limited. The HTML is parsed by SheetJS, which does not execute JavaScript. The sanitization is defense-in-depth against unexpected SheetJS behavior or future execution paths. Still, parity matters.

**Fix:** Update line 43 to `/\son\w+\s*=\s*[^>\s]*/gi`.

## Verification

- C20-SEC02 (normalizeHTML defense-in-depth) remains intact.
- C24-SEC01 (quoted pattern whitespace) was fixed at line 42.
- No other security findings in this cycle.
