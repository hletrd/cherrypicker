# Cycle 22 — Security Reviewer

**Date:** 2026-05-05
**Scope:** packages/parser/, apps/web/src/lib/parser/
**Previous:** 21 cycles completed

---

## Finding C22-SEC01: HTML event handler sanitization regex gap [LOW — Defense in Depth]

**File:** `apps/web/src/lib/parser/html.ts:39-40`

**Problem:** The `normalizeHTML` function strips event handlers with two regexes:
```ts
.replace(/\son\w+=["'][^"']*["']/gi, '')  // removes onclick="..." and onclick='...'
.replace(/\son\w+=\w+/gi, '')              // removes onclick=foo (no quotes)
```

The second regex `/\son\w+=\w+/gi` only matches when the attribute value consists entirely of word characters (`\w+`). Values like `onclick=alert(1)` are NOT stripped because `alert(1)` contains parentheses `(` and `)` which are not matched by `\w+`.

**Impact:** SheetJS (the HTML table parser) does not execute JavaScript, so this is not a direct XSS vector in the parsing pipeline. However, the sanitized output may be passed to other consumers in the future. The current gap means malformed event handlers survive normalization and could cause unexpected behavior if SheetJS or downstream code ever evaluates them.

**Concrete failure scenario:** A user uploads an HTML file containing `<td onclick=alert(1)>10000</td>`. The `onclick=alert(1)` attribute survives normalization. If the app ever renders raw HTML from parsed table cells (it currently does not — Svelte auto-escapes text), this would execute JavaScript.

**Fix:** Replace the two regexes with a single more robust pattern:
```ts
.replace(/\son\w+=[^>\s]*/gi, '')  // matches onclick=..., onclick="...", onclick='...', onclick=alert(1)
```
Or use a proper HTML sanitizer library if the parsing pipeline ever renders raw HTML.

**Confidence:** High

---

## Finding C22-SEC02: JSON.parse without reviver in format detection [LOW — Defense in Depth]

**File:** `packages/parser/src/detect.ts:288`

**Problem:** `JSON.parse(sniffBuffer.toString('utf-8').replace(/^﻿/, ''))` is used to validate JSON content during format detection. There is no reviver function or depth limit. While the input is limited to the first 1024 bytes and comes from the user's own file, a maliciously crafted JSON file with prototype pollution payloads (e.g., `{"__proto__": {"isAdmin": true}}`) could theoretically affect downstream code if the parsed object is ever merged with application objects.

**Impact:** Very low. The parsed object is immediately discarded (only used to verify it's valid JSON). The `format` variable is set but the parsed data is not returned or stored.

**Fix:** No fix needed given the current usage pattern, but document that `JSON.parse` here is validation-only and the result must never be merged with application state.

**Confidence:** Low

---

## Commonly Missed Issues Sweep

- No path traversal vulnerabilities in file handling (validated paths, no `..` segments).
- No SQL injection (no SQL queries).
- No command injection (no shell execution with user input).
- The `escapeRegExp` function in OFX parser correctly escapes all regex metacharacters.
- Zod schemas in `packages/rules/` use `.nonnegative()` and `.min(1)` for validation.

---

## Regressions

None found.
