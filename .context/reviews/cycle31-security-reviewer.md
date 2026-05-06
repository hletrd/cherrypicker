# Cycle 31 Security Review

**Scope:** Parser sanitization, sessionStorage handling, LLM fallback, XSS surfaces, and auth patterns.

---

## New Findings

### C31-SEC01 | LOW | Medium | `apps/web/src/lib/parser/html.ts:42-46` and `packages/parser/src/csv/shared.ts`

**`normalizeHTML` event handler regex has a gap for backtick-quoted values**

The regexes handle double-quoted and single-quoted values:
```typescript
.replace(/\son\w+\s*=\s*(?:"[^"]*"|'[^']*')/gi, '')
.replace(/\son\w+\s*=\s*[^>\s]*/gi, '')
```

Template literals using backticks (e.g., `onclick=\`alert(1)\``) are not matched by either pattern. While backtick-quoted attributes are not standard HTML, some browsers accept them. The third regex `[^>\s]*` would match up to the backtick but not the full value if it contains spaces.

**Confidence:** Low — this is a defense-in-depth measure; the HTML is never rendered, only parsed by SheetJS.

**Fix:** Extend the quoted-value regex to include backticks: `(?:"[^"]*"|'[^']*'|\`[^\`]*\`)`.

### C31-SEC02 | LOW | Medium | `packages/parser/src/pdf/llm-fallback.ts:92-105`

**LLM fallback JSON.parse on untrusted LLM output lacks structural validation**

The code parses JSON from an LLM response without validating that the top-level structure is an array of objects. A malicious or buggy LLM could return a nested array, a primitive, or an object with unexpected keys. The current filter handles the common case but doesn't defend against prototype pollution via `__proto__` or `constructor` in the parsed objects (though these would be string keys, not actual prototype manipulation).

More critically, the `parsed = JSON.parse(candidate)` at line 105 happens inside a retry loop. If the LLM returns extremely large nested structures, each `JSON.parse` attempt could consume significant memory before failing.

**Fix:** Add a `typeof parsed === 'object' && Array.isArray(parsed)` guard after successful parse. Consider adding a max-length check before parsing.

### C31-SEC03 | LOW | High | `apps/web/src/lib/store.svelte.ts:213-221`

**`safeJSONParse` reviver is minimal but sufficient for prototype pollution**

The reviver blocks `__proto__`, `constructor`, `prototype`. This covers the known prototype pollution attack vectors for `JSON.parse`. However, it doesn't block `__defineGetter__`, `__lookupGetter__`, or other potential pollution paths that some libraries check for.

**Confidence:** High that current blocking is sufficient for this threat model (sessionStorage is same-origin). Adding more keys would be defense-in-depth.

**Fix:** Consider expanding the forbidden keys set to include `__defineGetter__`, `__defineSetter__`, `__lookupGetter__`, `__lookupSetter__` for completeness.

---

## Prior Open Findings Verified

| Finding | Status | Evidence |
|---|---|---|
| C25-SEC01 | FIXED | `normalizeHTML` whitespace parity confirmed between web and server |
| C24-SEC01 | FIXED | Whitespace-around-equals event handler regex confirmed working |
| C28-SEC01 | FIXED | `javascript:` URL stripping confirmed in both web and server normalizeHTML |
| C20-SEC02 | FIXED | Script/style/iframe stripping confirmed |
| D-32 (SRI) | OPEN (LOW) | Still no SRI on external scripts, but scripts are inline (deferred) |

---

## Final Sweep

1. No secrets or API keys in source code
2. All fetch calls use same-origin URLs
3. CSP headers properly configured in Layout.astro
4. No user-controlled URLs are fetched
5. LLM API key validation regex is strict (`sk-ant-api[0-9]{2}-...`)
