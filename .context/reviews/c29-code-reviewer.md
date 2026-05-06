# Cycle 29 Code Review

## Findings

### HIGH-01: Web-side HTML parser imports parseAmountString from csv.ts instead of amount.ts
**File:** `apps/web/src/lib/parser/html.ts` (line 10)
**Confidence:** High

The HTML parser imports `parseAmountString` from `./csv.js`:
```ts
import { parseAmountString } from './csv.js';
```

But there is a dedicated `amount.ts` in the same directory that exports `parseAmountString` as an alias:
```ts
export const parseAmountString = parseAmount; // from amount.ts
```

And `csv.ts` re-exports it from `amount.ts`:
```ts
export const parseAmountString = parseAmount;
```

This creates a confusing import chain: `html.ts -> csv.ts -> amount.ts`. The HTML parser should import directly from `amount.ts` for clarity. The current dependency means `html.ts` transitively depends on all of `csv.ts` just for one function.

**Fix:** Change the import in `html.ts` to `import { parseAmountString } from './amount.js';`.

---

### HIGH-02: normalizeHTML regex inconsistency between web-side and server-side
**File:** `apps/web/src/lib/parser/html.ts` (lines 42-43) vs `packages/parser/src/csv/shared.ts` (lines 191-192)
**Confidence:** High

Web-side event handler stripping:
```ts
.replace(/\son\w+\s*=\s*(?:"[^"]*"|'[^']*')/gi, '')
.replace(/\son\w+\s*=\s*[^>\s]*/gi, '')
```

Server-side event handler stripping:
```ts
.replace(/\son\w+\s*=\s*["'][^"']*["']/gi, '')
.replace(/\son\w+\s*=\s*[^>\s]*/gi, '')
```

The quoted-value patterns differ:
- Web-side: `(?:"[^"]*"|'[^']*')` — non-capturing group with alternation
- Server-side: `["'][^"']*["']` — character class matching

The server-side pattern `["'][^"']*["']` can match mixed quotes like `"foo'` which is invalid HTML but could cause the regex to over-match. The web-side pattern is more correct but the two files should be identical since they serve the same security purpose.

**Fix:** Unify both to use the web-side (more correct) pattern, or extract `normalizeHTML` to a shared module.

---

### MEDIUM-01: Code duplication between web-side and server-side parsers
**Files:** `apps/web/src/lib/parser/html.ts` vs `packages/parser/src/html/index.ts`
**Files:** `apps/web/src/lib/parser/json.ts` vs `packages/parser/src/json/index.ts`
**Files:** `apps/web/src/lib/parser/xlsx.ts` vs `packages/parser/src/xlsx/index.ts`
**Confidence:** High

Each parser exists in nearly-identical form in both the web app and the server package. The HTML parsers share the same logic (SheetJS-based table parsing, forward-fill, column matching), the JSON parsers share the same alias lists and parsing logic, and the XLSX parsers share the same date parsing and forward-fill logic.

This duplication means:
- Fixes must be applied in two places (parity comments like C100-01, C89-01 acknowledge this)
- Risk of divergence over time
- Larger bundle size for the web app

Comments in the code explicitly acknowledge this:
```ts
// NOTE(C70-04): The helpers below duplicate logic from packages/parser/src/csv/shared.ts.
// Full dedup requires the D-01 architectural refactor (shared module between Bun and browser environments).
```

**Fix:** Complete the D-01 architectural refactor to share parser code between web and server. At minimum, share alias lists, regex patterns, and utility functions.

---

### MEDIUM-02: JSON parser `description` alias appears in both MERCHANT_ALIASES and MEMO_ALIASES
**Files:** `apps/web/src/lib/parser/json.ts` (lines 24, 52), `packages/parser/src/json/index.ts` (lines 24, 52)
**Confidence:** Medium

The field `description` is listed in both MERCHANT_ALIASES and MEMO_ALIASES. Since `findField` scans aliases in order and returns on first match, a JSON field named `description` will ALWAYS be matched as merchant, never as memo. This is probably intentional (merchant precedence) but is undocumented and could surprise users whose JSON has a `description` memo field.

**Fix:** Document this precedence behavior in a comment, or remove `description` from MEMO_ALIASES since it can never match.

---

### MEDIUM-03: `build-stats.ts` hardcodes fallback values that can become stale
**File:** `apps/web/src/lib/build-stats.ts` (lines 16-18)
**Confidence:** Medium

```ts
let totalCards = 683;
let totalIssuers = 24;
let totalCategories = 45;
```

These hardcoded values are used as fallbacks when `cards.json` is unavailable. If the actual data changes (e.g., new cards added, new issuers), these fallbacks become silently stale. The fallback is silent (no warning), so stale values could be displayed on the landing page indefinitely.

**Fix:** Add a build-time check that validates fallback values against the actual cards.json, or emit a warning when fallbacks are used.

---

### LOW-01: LLM fallback JSON.parse without validation before use
**File:** `packages/parser/src/pdf/llm-fallback.ts` (line 91)
**Confidence:** Medium

After extracting JSON from the LLM response, the code does:
```ts
parsed = JSON.parse(jsonMatch[0]);
```

The parsed result is later filtered with runtime type checks, but the initial `JSON.parse` on untrusted LLM output could theoretically be exploited if the LLM returns malicious JSON (e.g., prototype pollution via `__proto__` or constructor tricks). While the Anthropic API is trusted and the parsed data is immediately filtered, defensive parsing would be safer.

**Fix:** Use a reviver function with `JSON.parse` that rejects `__proto__` and `constructor` keys, or validate the parsed structure more strictly before processing.

---

### LOW-02: `store.svelte.ts` uses `as AnalysisResult` after manual validation
**File:** `apps/web/src/lib/store.svelte.ts` (line 307)
**Confidence:** Low

```ts
} as AnalysisResult;
```

This cast follows extensive manual validation, so it's low risk. However, a proper type guard function would be more maintainable and would catch future schema changes.

---

## Summary

| Finding | Severity | Confidence | File |
|---------|----------|------------|------|
| HIGH-01 Import from wrong module | High | High | html.ts |
| HIGH-02 normalizeHTML regex divergence | High | High | html.ts, csv/shared.ts |
| MEDIUM-01 Parser duplication | Medium | High | Multiple |
| MEDIUM-02 description alias conflict | Medium | Medium | json.ts |
| MEDIUM-03 Stale fallback values | Medium | Medium | build-stats.ts |
| LOW-01 LLM JSON.parse safety | Low | Medium | llm-fallback.ts |
| LOW-02 Type assertion after validation | Low | Low | store.svelte.ts |
