# Security Review — CherryPicker Cycle 39

**Reviewer:** security-reviewer (manual, Agent tool unavailable)
**Date:** 2026-05-06
**Cycle:** 39 / 100
**HEAD:** d265c46

---

## Findings

### SEC-39-01 — Low — LLM sanitizer uses blacklist approach

**File:** `packages/parser/src/pdf/llm-fallback.ts:7-25`

The `sanitizeLLMInput` function uses a blacklist of known prompt injection patterns:

```typescript
const injectionPatterns = [
  /ignore\s+(all|previous)\s+(instructions?|prompts?)/gi,
  /forget\s+(all|your)\s+(instructions?|prompts?)/gi,
  /you\s+are\s+now\s+a/gi,
  // ...
];
```

**Problem:** Blacklist-based sanitization is inherently incomplete. New injection techniques are discovered regularly (e.g., base64-encoded payloads, Unicode homoglyphs, markdown image payloads with data URLs, role-playing via "user:" and "assistant:" prefixes, indirect injection via PDF metadata). The current patterns cover only the most obvious English-language attacks.

**Mitigation:** The system prompt constrains behavior, and the API key validation is strict. The actual risk is low because:
1. The input comes from the user's own PDF files (not untrusted external sources)
2. The LLM output is parsed as JSON and validated structurally
3. No generated content is rendered as HTML/executed as code

**Recommendation:** Consider switching to an allowlist approach (only allow specific character ranges) or use Anthropic's built-in prompt caching with strict system prompts instead of regex filtering.

**Confidence:** Low

---

### SEC-39-02 — Medium — `parseAmountString` accepts malformed input with trailing garbage

**File:** `packages/parser/src/csv/shared.ts:175-178`

See CR-39-01 for details. The parser accepts strings like `"1234abc"` as valid amount `1234`. While not a direct security vulnerability, this could allow injection of malformed data through crafted statement files that exploit parsing ambiguities.

**Confidence:** Low

---

## Carryover Status

| ID | Status | Notes |
|----|--------|-------|
| SEC-01 | OPEN | CSP unsafe-inline still in Layout.astro |
| SEC-04 | FIXED | API key regex tightened to `sk-ant-api[0-9]{2,}-...` |
| SEC-03 | FIXED | Max input size guard added (100K chars) |
| SEC-07 | FIXED | Non-KRW transactions tracked in skippedTransactions |
| SEC-06 | OPEN | LLM sanitizer still regex-based (deferred) |
| SEC-08 | DEFERRED | sessionStorage encryption requires UX design |
