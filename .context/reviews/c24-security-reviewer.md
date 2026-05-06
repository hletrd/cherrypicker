# Security Review — cherrypicker (Cycle 24)

**Reviewer:** security-reviewer
**Scope:** OWASP Top 10, injection vectors, unsafe patterns
**Date:** 2026-05-06

---

## Summary

Cycle 23 hardened the HTML sanitization regex. Cycle 24 finds 1 residual sanitization gap and verifies the OFX regex hardening.

---

## New Findings

### [C24-SEC01-LOW] HTML event handler regex misses whitespace-variant attributes

**Files:** `apps/web/src/lib/parser/html.ts:42`
**Confidence:** High
**OWASP Category:** A03:2021 – Injection (XSS via HTML)

The regex `/\son\w+=(?:"[^"]*"|'[^']*')/gi` does not match event handler attributes with whitespace around the equals sign, e.g.:
```html
<div onclick = "alert(document.cookie)">
```

Browsers normalize this to standard attribute syntax, so the event handler would execute if the HTML were rendered in a DOM context. While SheetJS does not execute JavaScript, passing partially-sanitized HTML to downstream consumers (report generation, preview panes) could re-introduce XSS risk.

**Fix:** Add `\s*` around the equals sign in the regex.

---

## Verified Fixed

| Finding | Status | Evidence |
|---------|--------|----------|
| C20-SEC01: OFX dynamic regex without escaping | FIXED | Both server (`packages/parser/src/ofx/index.ts:58-59`) and web (`apps/web/src/lib/parser/ofx.ts:33-35`) now use `escapeRegExp` before RegExp interpolation |
| C20-SEC02: HTML sanitization before SheetJS | PARTIAL | `normalizeHTML` now strips scripts, styles, iframes, objects, embeds, and event handlers. The whitespace gap (C24-SEC01) is the remaining surface. |

---

## Carry-overs

- D-C10-04: CSP implementation (MEDIUM) — deferred
- D-C10-05: OFX regex ReDoS — now fixed (escapeRegExp added)
