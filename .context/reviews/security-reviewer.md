# Security Review — cherrypicker (Cycle 20)

**Reviewer:** security-reviewer
**Scope:** OWASP Top 10, injection vectors, unsafe patterns, secrets
**Date:** 2026-05-05

---

## Summary

Cycle 19 fixed the esc() double-encoding bypass (C19-SEC01). Cycle 20 review identifies 2 security-related findings: dynamic regex construction in OFX parsing (latent ReDoS) and insufficient input validation in the HTML parser's SheetJS path.

---

## New Findings

### [C20-SEC01-MEDIUM] Dynamic RegExp construction in OFX extractTag without escaping

**Files:** `packages/parser/src/ofx/index.ts:59-69`, `apps/web/src/lib/parser/ofx.ts:33-40`
**Confidence:** High
**OWASP Category:** A03:2021 – Injection (Regex Injection)

```ts
const xmlRe = new RegExp(`<${tagName}[^>]*>\\s*([^<]+?)\\s*</${tagName}>`, 'i');
```

While `tagName` is currently hardcoded to safe values (`'DTPOSTED'`, `'TRNAMT'`, `'NAME'`, `'MEMO'`, `'TRNTYPE'`, `'ORG'`), this pattern is fragile. If future maintenance adds dynamic tag extraction from parsed content (e.g., supporting custom OFX extensions), unescaped tag names containing regex metacharacters would cause:
1. Unexpected ReDoS from `.` or `+` in tag names
2. Syntax errors from unbalanced `[` or `(`
3. Unintended match behavior from `$` or `^`

**Fix:** Apply `escapeRegExp` to `tagName` before interpolation. This is defense-in-depth even with current hardcoded values.

---

### [C20-SEC02-LOW] HTML parser passes unsanitized content to SheetJS

**Files:** `apps/web/src/lib/parser/html.ts:38-42`, `packages/parser/src/html/index.ts`
**Confidence:** Medium
**OWASP Category:** A03:2021 – Injection (HTML/XXE)

The HTML parser normalizes malformed closing tags then passes the content directly to `xlsx.read()`:
```ts
workbook = xlsx.read(encoder.encode(normalized), { type: 'array', cellDates: false });
```

SheetJS parses HTML tables by converting them to an internal representation. While SheetJS is not a full browser DOM and doesn't execute JavaScript, passing unsanitized HTML content to any parser carries risk. A malicious HTML file could contain:
1. Entity expansion bombs (`&#x3C;` repeated millions of times) causing memory exhaustion
2. Nested table structures causing deep recursion in SheetJS
3. `<iframe>` or `<object>` tags that SheetJS might handle unexpectedly

The `normalizeHTML` function only fixes spacing in closing tags — it does NOT strip script tags, event handlers, or other dangerous content.

**Fix:** Pre-process HTML to strip `<script>`, `<style>`, event handlers (`on*=` attributes), and `<iframe>`/`<object>` tags before passing to SheetJS. This is a lightweight sanitization step that doesn't need a full HTML parser.

---

## Verified Fixed

| Finding | Status | Evidence |
|---------|--------|----------|
| C19-SEC01: esc() double-encoding bypass | FIXED | Pre-decodes numeric entities before escaping |
| C19-SEC02: Dynamic regex in OFX | PARTIAL | Still present; pattern unchanged from cycle 19 |

---

## Verdict

**FIX AND SHIP** — Address C20-SEC01 with escape helper. C20-SEC02 is defense-in-depth; prioritize if HTML files come from untrusted sources.
