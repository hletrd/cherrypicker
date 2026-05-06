# Cycle 30 Security Review

## Findings

### HIGH-01: sessionStorage JSON.parse without reviver
- **File:** `apps/web/src/lib/store.svelte.ts:218`
- **Severity:** HIGH
- **Confidence:** Medium
- **Issue:** `JSON.parse(raw)` on sessionStorage data happens without a reviver. If the site has any XSS vulnerability, an attacker could inject prototype-polluting keys like `__proto__`, `constructor`, or `prototype` into sessionStorage. While the subsequent validation filters out objects with these keys by only accepting specific shapes, the initial `JSON.parse` still executes with the polluted object.
- **Fix:** Add a safeJSONParse helper with a reviver that rejects forbidden keys.
- **Cross-reference:** C29-security-reviewer-MEDIUM-02, Plan 53 Task 2

### MED-01: Weak Anthropic API key validation
- **File:** `packages/parser/src/pdf/llm-fallback.ts:42-46`
- **Severity:** MEDIUM
- **Confidence:** Medium
- **Issue:** Current validation only checks prefix (`sk-ant-`) and minimum length (20). This allows partially-correct keys to be sent to the API, wasting tokens and potentially leaking attempted keys in error responses.
- **Fix:** Use stricter regex matching the actual Anthropic key format.
- **Cross-reference:** C29-security-reviewer-MEDIUM-01, Plan 53 Task 1

### MED-02: normalizeHTML javascript: URL stripping
- **Status:** FIXED in commits 51a15b8, 2465404
- **Verification:** Both web and server normalizeHTML now strip `javascript:` URLs from href/src attributes. Tests pass.

### MED-03: HTML event handler regex accepts mixed quotes
- **Status:** FIXED in commit 2465404
- **Verification:** Both web and server now use `(?:"[^"]*"|'[^']*')` which correctly requires matching quote pairs.

### LOW-01: LLM fallback JSON extraction regex
- **File:** `packages/parser/src/pdf/llm-fallback.ts:79+
- **Severity:** LOW
- **Confidence:** Medium
- **Issue:** The greedy JSON array match can incorrectly capture nested arrays or objects in the LLM response text.
- **Fix:** Consider using a streaming JSON parser or bracket-matching approach.
- **Cross-reference:** Deferred D-26
