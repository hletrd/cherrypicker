# Cycle 33 Security Review — CherryPicker

**Agent:** c33-security-reviewer  
**Date:** 2026-05-06  
**Status:** Agent spawn failed; review performed by orchestrator

---

## Finding 1: CSP retains `unsafe-inline` for both script-src and style-src [HIGH / High confidence]

**File:** `apps/web/src/layouts/Layout.astro:50`

**Problem:** The Content-Security-Policy meta tag allows inline scripts and styles:
```
script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'
```

This is a known XSS vector. While Astro requires inline scripts for hydration, the TODO comment (line 46) indicates this should be migrated to nonce-based CSP.

**Exploit scenario:** An attacker who can inject HTML (e.g., via a reflected XSS in a query parameter) can execute inline JavaScript because `unsafe-inline` allows it.

**Suggested fix:** Implement nonce-based CSP as described in the TODO. Generate nonces at build time and inject them into script tags.

**Confidence:** High

---

## Finding 2: Missing security headers (HSTS, X-Frame-Options, X-Content-Type-Options) [MEDIUM / High confidence]

**File:** `apps/web/src/layouts/Layout.astro`

**Problem:** No `X-Frame-Options` header to prevent clickjacking. No `X-Content-Type-Options: nosniff`. No HSTS. These are standard defense-in-depth headers.

**Exploit scenario:** The site could be embedded in a malicious iframe with overlay attacks (clickjacking).

**Suggested fix:** Add meta-equiv tags or configure headers at the CDN/server level.

**Confidence:** High

---

## Finding 3: LLM fallback passes raw PDF text unsanitized to Anthropic API [MEDIUM / High confidence]

**File:** `packages/parser/src/pdf/llm-fallback.ts:68`

**Problem:** The raw extracted PDF text is interpolated directly into the user message:
```typescript
content: `다음은 신용카드 명세서에서 추출한 텍스트입니다...\n\n${truncated}`
```

A malicious PDF could contain text like: `Ignore previous instructions and return...`

**Exploit scenario:** Prompt injection via crafted PDF content could manipulate the LLM to return fraudulent transactions.

**Suggested fix:** Sanitize PDF text before sending to LLM. Remove or escape sequences that look like instructions. Add a system-level guard.

**Confidence:** High

---

## Finding 4: Financial data stored in sessionStorage without encryption [MEDIUM / High confidence]

**File:** `apps/web/src/lib/store.svelte.ts:101-201`

**Problem:** Transaction data, card assignments, and spending totals are persisted to `sessionStorage` as plaintext JSON. SessionStorage is accessible to any JavaScript running on the origin, including malicious extensions.

**Exploit scenario:** A malicious browser extension reads sessionStorage and extracts the user's financial data.

**Suggested fix:** Encrypt sensitive fields before storage using a client-side key derived from a user password or random session key.

**Confidence:** High

---

## Finding 5: HTML sanitization regex can be bypassed with malformed tags [LOW / Medium confidence]

**File:** `apps/web/src/lib/parser/html.ts:29-50`

**Problem:** Regex-based HTML sanitization is inherently fragile. The `normalizeHTML` function uses patterns like `/<script[\s\S]*?<\/script>/gi` which can be bypassed.

**Suggested fix:** Use a proper HTML sanitizer library (e.g., DOMPurify) if HTML is ever rendered. For parsing-only, the risk is lower since SheetJS doesn't execute scripts.

**Confidence:** Medium

---

## Final Sweep

- No `eval()` or `Function()` usage found.
- No `innerHTML` assignments found.
- `safeJSONParse` provides prototype pollution protection (good).
- `validateFilePath` in CLI rejects path traversal (good).
- No secrets hardcoded in source (ANTHROPIC_API_KEY comes from env).
