# Security Review — CherryPicker Cycle 35

## Methodology
Reviewed for OWASP Top 10 patterns, XSS, injection, unsafe eval, CSP, secrets handling, and authentication/authorization across packages/parser, apps/web, tools/scraper.

---

## CONFIRMED ISSUES

### SEC-01: CSP uses unsafe-inline for script-src and style-src
**File**: `apps/web/src/layouts/Layout.astro:50`
**Severity**: Medium | **Confidence**: High
```html
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; ..." />
```
The inline comment admits this is a TODO: "Migrate to nonce-based CSP (compute nonce at build time, inject into both the meta tag and all script elements) to fully remove 'unsafe-inline' from script-src."
**Impact**: XSS vulnerability — any attacker who can inject inline script or style will bypass CSP entirely.
**Fix**: Implement nonce-based CSP. Generate a nonce at request time (or build time for static), inject it into the CSP meta tag, and add `nonce="..."` to all `<script>` and `<style>` elements. For Tailwind v4 scoped styles, use a hash-based approach or configure the build to externalize styles.

### SEC-02: sessionStorage stores financial data unencrypted
**File**: `apps/web/src/lib/store.svelte.ts:100-106`
**Severity**: Low | **Confidence**: High
The code explicitly documents this: "sessionStorage persists analysis data as plaintext JSON... financial data is visible to any JavaScript on the origin, including browser extensions."
**Impact**: Financial transaction data (merchant names, amounts, dates) is stored in plaintext accessible to any script on the origin.
**Fix**: Encrypt sensitive fields before storage using the Web Crypto API with a session-derived key. Mark as deferred — requires UX design for key management.

### SEC-03: LLM fallback lacks input size limits before sanitize
**File**: `packages/parser/src/pdf/llm-fallback.ts:77-79`
**Severity**: Low | **Confidence**: Medium
```typescript
const truncated = sanitizeLLMInput(
  text.length > 8000 ? text.slice(0, 8000) + '\\n...(truncated)' : text
);
```
`sanitizeLLMInput` runs AFTER truncation. If the raw text is extremely large (e.g., 100MB PDF), the `.length` check itself is fine, but `text.slice(0, 8000)` on a 100MB string may create a large intermediate string before truncation. In practice, `extractText` likely limits this, but no explicit guard exists.
**Fix**: Add a max-size check on `text` before any processing.

---

## LIKELY ISSUES / RISKS

### SEC-04: API key regex too permissive
**File**: `packages/parser/src/pdf/llm-fallback.ts:66`
**Severity**: Low | **Confidence**: Medium
The regex allows `sk-ant-api00-...` (version 00) and only requires 30+ chars after the hyphen. Anthropic keys are typically longer and have a specific format.
**Fix**: Tighten regex to match current Anthropic key format exactly.

### SEC-05: No rate limiting on LLM fallback
**File**: `packages/parser/src/pdf/llm-fallback.ts`
**Severity**: Low | **Confidence**: Medium
No rate limiting or token-bucket mechanism prevents abuse. Each PDF parse triggers an LLM API call with user's API key.
**Fix**: Add basic rate limiting (e.g., max 10 calls per minute) or document the risk.

---

## VERIFIED SAFE
- No `eval()`, `Function()`, or `setTimeout` with string arguments in production code
- `sanitizeLLMInput` strips common prompt injection patterns
- `safeJSONParse` blocks prototype pollution keys
- `isPlainObject` validation on sessionStorage load prevents prototype pollution
- X-Frame-Options: DENY and X-Content-Type-Options: nosniff are set
- Referrer-Policy: strict-origin-when-cross-origin is set
