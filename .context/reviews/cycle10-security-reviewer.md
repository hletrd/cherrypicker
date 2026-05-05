# Cycle 10 Security Review

**Reviewer:** security-reviewer  
**Cycle:** 10  
**Date:** 2026-05-05

---

## Findings

### [P1-HIGH] Dynamic regex with unescaped tagName in OFX extractTag — packages/parser/src/ofx/index.ts:61
**Description:** `new RegExp(\`<${tagName}[^>]*>\s*([^<]+?)\s*</${tagName}>\`, 'i')` constructs a regex from tagName. While tagName is currently hardcoded, the pattern uses `[^>]*` which could match maliciously crafted tags.
**Impact:** If tagName ever comes from user input or if OFX content contains unusual tags, ReDoS or unexpected matching is possible. The `[^<]+?` lazy quantifier with backtracking is susceptible to ReDoS on crafted input.
**Fix:** Pre-compile regexes for known tags, or add input validation on tagName length/content. Limit match input size.
**Confidence:** Medium

### [P2-MEDIUM] HTML report generation uses manual esc() instead of template engine — packages/viz/src/report/generator.ts:31-43
**Description:** Manual HTML escaping with `esc()` is error-prone. The function handles control chars and basic HTML entities but may miss edge cases (e.g., backspace characters `` are stripped but other control chars could slip through).
**Impact:** If card names or category labels contain unexpected Unicode control characters or combining marks, they may bypass the sanitizer. The forward-slash replacement is unnecessary but harmless.
**Fix:** Consider using a proper HTML sanitization library (e.g., `he` or `sanitize-html`) for the report generator, or at minimum add a note that esc() is for trusted-content hardening, not untrusted input sanitization.
**Confidence:** Medium

### [P2-MEDIUM] File upload accepts HTML files without content validation — apps/web/src/components/upload/FileDropzone.svelte
**Description:** The upload component accepts `.html` and `.htm` files. HTML files could contain malicious JavaScript that executes in the browser context when parsed or displayed.
**Impact:** While the parser processes HTML as data (using SheetJS), the raw file content could be displayed or mishandled. No Content Security Policy is enforced (Layout.astro line 46 has a TODO for nonce-based CSP).
**Fix:** Implement the nonce-based CSP as noted in the TODO. Validate that uploaded HTML files don't contain `<script>` tags before parsing.
**Confidence:** Medium

### [P3-LOW] Missing CSP implementation — apps/web/src/layouts/Layout.astro:46
**Description:** TODO comment: "Migrate to nonce-based CSP". No CSP is currently implemented.
**Impact:** XSS risk if any user-controlled content is rendered without proper escaping.
**Fix:** Implement the CSP as planned.
**Confidence:** Low

---

## Summary Table

| Severity | Count |
|----------|-------|
| P1-HIGH | 1 |
| P2-MEDIUM | 2 |
| P3-LOW | 1 |

**Verdict:** FIX AND SHIP
