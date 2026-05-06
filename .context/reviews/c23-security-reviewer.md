# Security Review — cherrypicker (Cycle 23)

**Reviewer:** security-reviewer
**Scope:** OWASP Top 10, injection vectors, unsafe patterns
**Date:** 2026-05-05

---

## Summary

Cycle 22 fixed the Korean regex range and strengthened HTML event handler sanitization. Cycle 23 review finds that the C22-SEC01 fix introduced a NEW vulnerability: the web-side event handler regex fails when attribute values contain spaces, leaving executable code in the normalized output.

---

## New Findings

### [C23-SEC01-HIGH] HTML event handler regex fails on spaces in quoted values

**Files:** `apps/web/src/lib/parser/html.ts:40`
**Confidence:** High
**OWASP Category:** A03:2021 – Injection (XSS via HTML parsing)

The C22-SEC01 fix changed the event handler regex from two explicit patterns (matching server-side) to a single simplified pattern:

```ts
.replace(/\son\w+=[^>\s]*/gi, '')
```

The character class `[^>\s]*` stops matching at ANY whitespace character (space, tab, newline). When an event handler attribute value contains spaces — which is common in real JavaScript — the regex strips only the prefix and leaves the remainder:

**Failure scenario:**
```html
<td onclick="alert(1); console.log(2)">value</td>
```
After regex: `<td console.log(2)">value</td>` — the `console.log(2)` remains, and the malformed tag may still execute or cause unexpected SheetJS behavior.

**Another failure:**
```html
<td onclick="alert(1);
console.log(2)">value</td>
```
After regex: `<td\nconsole.log(2)">value</td>` — newline also terminates the match.

**Fix:** Replace the single regex with the server-side's two-pattern approach, which correctly handles spaces within quoted values:

```ts
.replace(/\son\w+=["'][^"']*["']/gi, '')  // quoted values
.replace(/\son\w+=\w+/gi, '')             // unquoted word values
```

Or, even better, use a more robust single regex that captures the full quoted string:
```ts
.replace(/\son\w+=["'][^"']*["']/gi, '')
.replace(/\son\w+=[^\s"'>]+/gi, '')
```

---

## Verified Fixed (from previous cycles)

| Finding | Status | Evidence |
|---------|--------|----------|
| C22-SEC01: Event handler regex gap | PARTIAL | Fixed for simple cases, but broken for spaces in values |
| C19-SEC01: esc() double-encoding | FIXED | Pre-decodes numeric entities |
| C20-SEC02: HTML sanitization | FIXED | Script/style/iframe stripping present |

---

## Verdict

**FIX IMMEDIATELY** — C23-SEC01 is a regression in the security boundary. The C22-SEC01 fix was incomplete and created a new bypass.
