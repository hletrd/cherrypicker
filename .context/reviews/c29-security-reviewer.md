# Cycle 29 Security Review

## Findings

### HIGH-01: normalizeHTML event handler regex can leave whitespace around equals
**File:** `apps/web/src/lib/parser/html.ts` (lines 42-43), `packages/parser/src/csv/shared.ts` (lines 191-192)
**Confidence:** High

The event handler stripping regex:
```ts
.replace(/\son\w+\s*=\s*(?:"[^"]*"|'[^']*')/gi, '')
```

This matches `onclick="alert(1)"` but what about `onclick = "alert(1)"` (spaces around equals)? The `\s*` before `=` handles it, but after `=` we have `\s*` which also handles it. However, the pattern requires the attribute to start with `\s` (whitespace before `on`), meaning `onclick="..."` at the start of a tag (no preceding whitespace) would NOT match. In practice HTML attributes always have whitespace before them (except the first attribute), so this is mostly OK.

More importantly, the unquoted value pattern:
```ts
.replace(/\son\w+\s*=\s*[^>\s]*/gi, '')
```

This can match `onclick=alert(1)` but NOT `onclick = alert(1)` because `[^>\s]*` after `=` would start with a space, which is excluded by `\s`. Wait, there's `\s*` before `[^>\s]*`, so `onclick = alert(1)` becomes `onclick =alert(1)` after the first replacement... actually let me re-check.

Pattern: `/\son\w+\s*=\s*[^>\s]*/gi`
- `\s+on\w+` matches ` onclick`
- `\s*` matches spaces around `=`
- `=` matches `=`
- `\s*` matches spaces after `=`
- `[^>\s]*` matches the value (non-greedy? no, `*` is greedy)

So `onclick = alert(1)`:
- `\son\w+` = ` onclick`
- `\s*` = ` `
- `=` = `=`
- `\s*` = ` `
- `[^>\s]*` = `alert(1)`

This DOES match. But what about `onclick=alert(1)>`? The `[^>\s]*` would match `alert(1)` and stop before `>`. Then the `>` remains. That's fine.

**Real issue:** What about `onclick=alert(1) onmouseover=alert(2)`? After removing the first attribute, the second might not have a leading space if it's the start of the tag. But this is edge-casey.

Actually, the more serious issue is that `normalizeHTML` strips attributes but doesn't actually remove the tag. If a `<script>` tag somehow survives (e.g., malformed `<script foo="bar">`), the content remains. But the regex does strip `<script...>...</script>`.

**Verdict:** The sanitize function is reasonable defense-in-depth but is not a substitute for a proper HTML sanitizer like DOMPurify. Since the HTML is never rendered to the DOM (it's parsed by SheetJS), XSS risk is LOW. However, if future code ever renders parsed HTML, this would be insufficient.

---

### MEDIUM-01: LLM fallback API key validation is weak
**File:** `packages/parser/src/pdf/llm-fallback.ts` (lines 42-46)
**Confidence:** Medium

```ts
if (!apiKey.startsWith('sk-ant-') || apiKey.length < 20) {
  throw new Error('ANTHROPIC_API_KEY 형식이 올바르지 않습니다...');
}
```

This validation only checks prefix and length. It doesn't validate the full format of an Anthropic API key, which could allow partially-correct keys to be sent to the API, wasting tokens and potentially leaking the attempted key in error responses.

**Fix:** Use a stricter regex like `/^sk-ant-api[0-9]{2}-[A-Za-z0-9_-]{40,}$/` for validation.

---

### MEDIUM-02: SessionStorage JSON.parse without schema validation
**File:** `apps/web/src/lib/store.svelte.ts` (line 218)
**Confidence:** Medium

```ts
let parsed = JSON.parse(raw);
```

After parsing, the code does manual field validation, but `JSON.parse` on untrusted sessionStorage data could be exploited if an attacker can write to sessionStorage (e.g., via XSS on another origin, or via browser extension). While sessionStorage is origin-scoped, if the site has any XSS vulnerability, this becomes an attack vector for prototype pollution.

The code does validate the shape after parsing, but the initial parse happens unconditionally.

**Fix:** Use `JSON.parse` with a reviver that rejects `__proto__`, `constructor`, and `prototype` keys.

---

### LOW-01: detect.ts uses JSON.parse on file content sniffing
**File:** `apps/web/src/lib/parser/detect.ts` (line 129), `packages/parser/src/detect.ts` (line 288)
**Confidence:** Low

The detection logic tries `JSON.parse` on the first 1024 bytes to detect JSON format. If the file is crafted maliciously, this parse happens before any validation. However, this is in a parser context where arbitrary file input is expected, and the parsed result is immediately discarded (only used for format detection).

**Verdict:** Low risk — parsed result is not used, only checked for parseability.

---

## Summary

| Finding | Severity | Confidence | File |
|---------|----------|------------|------|
| HIGH-01 normalizeHTML regex coverage | High | High | html.ts |
| MEDIUM-01 Weak API key validation | Medium | Medium | llm-fallback.ts |
| MEDIUM-02 sessionStorage parse safety | Medium | Medium | store.svelte.ts |
| LOW-01 detect.ts JSON.parse | Low | Low | detect.ts |
