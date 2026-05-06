# Cycle 34 — Security Reviewer Findings

**Date:** 2026-05-06
**Scope:** Security-focused re-review

---

## Verified Fixed (since C33)

- **C33-F3** LLM prompt injection: `sanitizeLLMInput()` present in `llm-fallback.ts:7-25`. Removes common injection patterns.
- **C33-F9** Missing security headers: `X-Frame-Options: DENY` and `X-Content-Type-Options: nosniff` added to `Layout.astro:52-53`.
- **C33-F11** HTML sanitization: Loop-based script tag stripping in `html.ts:33-35`.

---

## Still Not Fixed

### F1: CSP Retains `unsafe-inline` [HIGH]
- **File:** `apps/web/src/layouts/Layout.astro:50`
- **Status:** Unchanged. `script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'` still present.
- **Risk:** XSS vector via inline script injection if any user-controlled content reaches the DOM.
- **Mitigation:** Nonce-based CSP migration still TODO (comment at line 46-48).

### F4: sessionStorage Plaintext [MEDIUM]
- **File:** `apps/web/src/lib/store.svelte.ts:100-106`
- **Status:** Acknowledged in code comment but not fixed. Financial data remains plaintext in sessionStorage.
- **Risk:** Browser extensions and same-origin scripts can read transaction data.

---

## New Finding: N3 — API Key Regex Too Restrictive (LOW / Medium confidence)

- **File:** `packages/parser/src/pdf/llm-fallback.ts:66`
- **Code:** `!/^sk-ant-api[0-9]{2}-[A-Za-z0-9_-]{30,}$/.test(apiKey)`
- **Problem:** Regex requires exactly 2 digits after `api`. Anthropic has used `api03`, `api04`. If they release `api05`–`api99` it works, but `api100` (3 digits) or a format change would be rejected.
- **Fix:** Use `[0-9]+` or `[0-9]{2,}` for the version segment.

---

## Defense-in-Depth Observations

- `llm-fallback.ts:66` key validation is stricter than before (was just `startsWith('sk-ant')`) — good improvement.
- `llm-fallback.ts:116-119` MAX_JSON_LENGTH guard prevents memory exhaustion from oversized LLM responses.
- No new XSS vectors detected in this cycle.
