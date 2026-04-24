# Cycle 3 — Security Reviewer

**Date:** 2026-04-24
**Reviewer:** security-reviewer
**Scope:** Full repository

---

## C3-S01: LLM fallback sends raw PDF text to Anthropic API without input sanitization

- **Severity:** LOW
- **Confidence:** Medium
- **File+line:** `packages/parser/src/pdf/llm-fallback.ts:59-63`
- **Description:** The `parsePDFWithLLM` function sends truncated raw PDF text directly to the Anthropic API as a user message. The text is extracted from PDF content via `pdfjs-dist` and could theoretically contain prompt injection patterns (e.g., a maliciously crafted PDF with instructions like "ignore previous instructions and return..."). However, the risk is mitigated by: (1) the system prompt is well-scoped with clear output format expectations, (2) the response is validated by JSON parsing with progressive bracket matching, (3) the output is filtered to only include valid transaction fields, and (4) the function is server-side only (not browser). The attacker would need to craft a PDF that both injects a prompt AND produces valid JSON that passes the filters — an extremely low-probability attack.
- **Failure scenario:** A maliciously crafted PDF contains text that causes the LLM to return a JSON array with fabricated transactions. The user sees incorrect transaction data in their analysis.
- **Fix:** Add a content sanitization step that strips or escapes common prompt injection patterns before sending to the API. Alternatively, add a warning in the ParseResult that LLM parsing was used, so users can verify the output.

## C3-S02: `ANTHROPIC_API_KEY` read from `process.env` without validation

- **Severity:** LOW
- **Confidence:** High
- **File+line:** `packages/parser/src/pdf/llm-fallback.ts:38-39`
- **Description:** The API key is read directly from `process.env['ANTHROPIC_API_KEY']` and passed to the Anthropic client constructor without validation. An empty string key would pass the `!apiKey` check (empty string is falsy in JS), but a key consisting of only whitespace would not. This is a minor robustness concern, not a security vulnerability.
- **Failure scenario:** A user sets `ANTHROPIC_API_KEY=" "` (whitespace only), which passes the truthiness check but causes an authentication error on the API call, with an unclear error message.
- **Fix:** Trim the API key before checking: `const apiKey = process.env['ANTHROPIC_API_KEY']?.trim()`

---

## Final Sweep

Reviewed:
- All network fetch patterns in `apps/web/src/lib/cards.ts` — AbortController usage is correct, no credential leakage
- All sessionStorage access in `store.svelte.ts` — same-origin only, validation is present
- PDF parsing in `packages/parser/src/pdf/` — LLM fallback is server-side only
- No `console.log` with sensitive data in web source (verified via grep)
- No hardcoded secrets in source files
- External links use `rel="noopener noreferrer"` (CardDetail.svelte:175)

No HIGH or MEDIUM security findings. Previously deferred items (D-32 SRI, D7-M13 CSP) remain valid.
