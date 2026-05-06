# Security Review — CherryPicker Cycle 36

## Methodology
Reviewed for OWASP Top 10, XSS, injection, CSP, secrets handling, API validation, and data exposure across packages/parser, apps/web, tools/scraper.

---

## VERIFIED FIXED (from Cycle 35)
None — SEC-01 through SEC-05 remain open or deferred.

---

## CARRYOVER (still open from Cycle 35)

### SEC-01: CSP uses unsafe-inline for script-src and style-src
**File**: `apps/web/src/layouts/Layout.astro:50` | **Severity**: Medium | **Confidence**: High
```html
<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; ..." />
```
Inline comment admits this is a TODO. XSS attacker who can inject inline script/style bypasses CSP entirely.
**Fix**: Implement nonce-based CSP. Generate nonce at request/build time, inject into meta tag and all `<script>` and `<style>` elements.

### SEC-03: LLM fallback lacks input size limits before sanitize
**File**: `packages/parser/src/pdf/llm-fallback.ts:77-79` | **Severity**: Low | **Confidence**: Medium
`sanitizeLLMInput` runs after truncation. If raw text is extremely large (100MB PDF), `.slice(0, 8000)` on a massive string may create a large intermediate.
**Fix**: Add max-size check on `text` before any processing (e.g., reject if `text.length > 100000`).

### SEC-04: API key regex too permissive
**File**: `packages/parser/src/pdf/llm-fallback.ts:66` | **Severity**: Low | **Confidence**: Medium
Regex allows `sk-ant-api00-...` (version 00) with only 30+ chars after hyphen. Anthropic keys have a more specific format.
**Fix**: Tighten regex to match current Anthropic key format exactly (e.g., `sk-ant-api03-[a-zA-Z0-9_-]{90,}`).

### SEC-05: No rate limiting on LLM fallback
**File**: `packages/parser/src/pdf/llm-fallback.ts` | **Severity**: Low | **Confidence**: Medium
No rate limiting or token-bucket prevents abuse. Each PDF parse triggers an LLM API call.
**Fix**: Add basic rate limiting (max N calls per minute) or document the risk.

---

## NEW FINDINGS

### SEC-06: `sanitizeLLMInput` is regex-based and incomplete
**File**: `packages/parser/src/pdf/llm-fallback.ts` | **Severity**: Low | **Confidence**: High
```typescript
function sanitizeLLMInput(text: string): string {
  return text
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<\?xml[\s\S]*?\?>/gi, '')
    .replace(/<![\s\S]*?>/g, '');
}
```
Only strips `<script>`, `<?xml?>`, and `<!...>` tags. Novel injection patterns (e.g., HTML entity-encoded scripts, `javascript:` URLs in `<a href>`, polyglot payloads) are not covered. The regex for `<script>` is also fragile against nested tags.
**Fix**: Use a proper HTML sanitizer (e.g., `htmlparser2` or `isomorphic-dompurify`) with an explicit allowlist of safe tags/attributes, or treat PDF-extracted text as plain text and escape all HTML entities before sending to LLM.

### SEC-07: Non-KRW transactions silently skipped with no user indication
**File**: `packages/core/src/calculator/reward.ts:220` | **Severity**: Low | **Confidence**: High
```typescript
if (tx.currency && tx.currency !== 'KRW') continue;
```
Foreign currency transactions are silently excluded from reward calculations. The user has no way to know these transactions were ignored — they simply disappear from results. This is a data-loss-class issue from the user's perspective.
**Fix**: Include skipped non-KRW transactions in a `skippedTransactions` array in CalculationOutput, and surface them in the UI/report with a warning.

### SEC-08: sessionStorage stores financial data unencrypted (deferred per Cycle 35)
**File**: `apps/web/src/lib/store.svelte.ts:100-106` | **Severity**: Low | **Confidence**: High
Financial transaction data (merchant names, amounts, dates) stored in plaintext sessionStorage. Accessible to any JavaScript on the origin, including malicious browser extensions.
**Status**: Deferred. Requires UX design for key management. Current threat model (single-user browser) accepts plaintext.
**Exit criterion**: Security audit flags this as required.

---

## VERIFIED SAFE
- No `eval()`, `Function()`, or `setTimeout` with string arguments in production code
- `safeJSONParse` blocks prototype pollution keys (`__proto__`, `constructor`)
- `isPlainObject` validation on sessionStorage load prevents prototype pollution
- X-Frame-Options: DENY and X-Content-Type-Options: nosniff are set
- Referrer-Policy: strict-origin-when-cross-origin is set
- `dangerouslyDisableSandbox` is NOT used in any parser code
