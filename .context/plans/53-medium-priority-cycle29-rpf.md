# Plan 53 — Medium Priority Fixes (Cycle 29 RPF)

**Source findings:** C29-code-reviewer MED-02, MED-03, LOW-01; C29-security-reviewer MED-01, MED-02; C29-architect MED-02; C29-debugger MED-02

---

## Task 1: Strengthen Anthropic API key validation in llm-fallback.ts

**Finding:** C29-security-reviewer-MEDIUM-01
**Severity:** MEDIUM
**Confidence:** Medium
**File:** `packages/parser/src/pdf/llm-fallback.ts` (lines 42-46)

### Problem

Current validation only checks prefix (`sk-ant-`) and minimum length (20). This allows partially-correct keys to be sent to the API, wasting tokens and potentially leaking attempted keys in error responses.

### Implementation

1. Open `packages/parser/src/pdf/llm-fallback.ts`
2. Replace lines 42-46:
   ```typescript
   // Stricter regex matching Anthropic key format: sk-ant-api03-... or sk-ant-api04-...
   if (!/^sk-ant-api[0-9]{2}-[A-Za-z0-9_-]{40,}$/.test(apiKey)) {
     throw new Error(
       'ANTHROPIC_API_KEY 형식이 올바르지 않습니다. 키는 "sk-ant-api03-..." 형식이어야 합니다.'
     );
   }
   ```
3. Add/update tests in any existing llm-fallback test file

### Exit Criterion

- `sk-ant-api03-validkey...` passes validation
- `sk-ant-`, `sk-ant-api`, `sk-ant-api03-` (too short), `invalid` all fail validation
- Existing valid keys still work

---

## Task 2: Add JSON.parse reviver for sessionStorage in store.svelte.ts

**Finding:** C29-security-reviewer-MEDIUM-02
**Severity:** MEDIUM
**Confidence:** Medium
**File:** `apps/web/src/lib/store.svelte.ts` (line 218)

### Problem

`JSON.parse(raw)` on sessionStorage data happens without a reviver. If the site has any XSS vulnerability, an attacker could inject prototype-polluting keys like `__proto__`, `constructor`, or `prototype` into sessionStorage.

### Implementation

1. Open `apps/web/src/lib/store.svelte.ts`
2. Before `loadFromStorage`, add a safe reviver:
   ```typescript
   const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
   function safeJSONParse(text: string): unknown {
     return JSON.parse(text, (key, value) => {
       if (FORBIDDEN_KEYS.has(key)) {
         throw new Error(`Forbidden key in JSON: ${key}`);
       }
       return value;
     });
   }
   ```
3. Replace `JSON.parse(raw)` on line 218 with `safeJSONParse(raw)`

### Exit Criterion

- Normal sessionStorage data loads correctly
- Data containing `__proto__` key throws during parse and falls through to the catch block
- Existing tests pass

---

## Task 3: Document JSON description alias conflict

**Finding:** C29-code-reviewer-MEDIUM-02
**Severity:** MEDIUM
**Confidence:** Medium
**Files:** `apps/web/src/lib/parser/json.ts` (lines 22-54), `packages/parser/src/json/index.ts` (lines 25-59)

### Problem

The field `description` appears in both `MERCHANT_ALIASES` and `MEMO_ALIASES`. Since `findField` scans in order and returns on first match, `description` will ALWAYS match as merchant, never as memo. This is probably intentional (merchant precedence) but is undocumented.

### Implementation

1. Open both `apps/web/src/lib/parser/json.ts` and `packages/parser/src/json/index.ts`
2. Add a comment before `MEMO_ALIASES`:
   ```typescript
   const MEMO_ALIASES = [
     // NOTE(C29-M02): 'description' is intentionally listed here as a fallback
     // but will never match because it is also in MERCHANT_ALIASES and
     // findField scans aliases in order. Merchant takes precedence.
     'memo', 'note', 'notes', 'remarks', 'remark', 'description' /* fallback: never matches — see note above */,
     // ...
   ];
   ```
3. Also add a short comment before `findField` explaining the scan-order precedence

### Exit Criterion

- Both files have clear comments explaining why `description` in MEMO_ALIASES is unreachable
- No functional change (deliberate choice to keep it as fallback documentation)

---

## Task 4: Fix stale fallback values in build-stats.ts

**Finding:** C29-code-reviewer-MEDIUM-03
**Severity:** MEDIUM
**Confidence:** Medium
**File:** `apps/web/src/lib/build-stats.ts` (lines 16-18)

### Problem

Hardcoded fallback values (`totalCards = 683`, `totalIssuers = 24`, `totalCategories = 45`) become silently stale when the actual data changes. The fallback is silent (no warning), so stale values could be displayed indefinitely.

### Implementation

1. Open `apps/web/src/lib/build-stats.ts`
2. Add a console warning when fallbacks are used:
   ```typescript
   } catch (err) {
     // eslint-disable-next-line no-console
     console.warn(
       '[build-stats] Using fallback values because cards.json is unavailable or malformed. ' +
       'Run the card data build step to update public/data/cards.json.'
     );
   }
   ```
3. Additionally, add a build-time validation script in `scripts/` that reads `cards.json` and warns if the hardcoded fallbacks differ from actual values by more than a threshold (e.g., 5%)

### Exit Criterion

- Fallback usage emits a visible console warning
- Build-time script exists and can be run manually to verify fallback accuracy

---

## Task 5: Eliminate double HTML decode in xlsx.ts

**Finding:** C29-architect-MEDIUM-02
**Severity:** MEDIUM
**Confidence:** Medium
**Files:** `apps/web/src/lib/parser/xlsx.ts` (lines 327-353), `packages/parser/src/xlsx/index.ts` (lines 30-36)

### Problem

`isHTMLContent` decodes the first 512 bytes, then the caller decodes the full buffer again when HTML is detected. The comment acknowledges this: "the 512-byte overlap is accepted as minor overhead." For large files this is wasteful.

### Implementation

1. Open `apps/web/src/lib/parser/xlsx.ts`
2. Refactor `isHTMLContent` to return both the boolean AND the decoded head string:
   ```typescript
   export function isHTMLContent(buffer: ArrayBuffer): { isHTML: boolean; head: string } {
     const raw = new TextDecoder('utf-8').decode(buffer.slice(0, 512));
     const head = raw.replace(/^﻿/, '').trimStart().toLowerCase();
     const isHTML = head.startsWith('<!doctype') || head.startsWith('<html') || /<table[\s>]/.test(head);
     return { isHTML, head };
   }
   ```
3. Update the caller in `parseXLSX` to use the returned head when HTML is detected, avoiding the second decode:
   ```typescript
   const htmlCheck = isHTMLContent(buffer);
   if (htmlCheck.isHTML) {
     const fullDecoded = new TextDecoder('utf-8').decode(buffer);
     const html = normalizeHTML(fullDecoded.replace(/^﻿/, ''));
     // ...
   }
   ```
   Actually, we still need the full decoded string. Better approach: have `isHTMLContent` return `{ isHTML: boolean; decodedPrefix: string }` and in the caller, only decode the remainder if needed. Or simpler: just accept that the 512-byte prefix is decoded twice and the full buffer is decoded once. The real fix is to have `isHTMLContent` return the decoded prefix so we can prepend it instead of re-decoding.

   Better implementation:
   ```typescript
   export function isHTMLContent(buffer: ArrayBuffer): { isHTML: boolean; decodedPrefix: string } {
     const raw = new TextDecoder('utf-8').decode(buffer.slice(0, 512));
     const head = raw.replace(/^﻿/, '').trimStart().toLowerCase();
     const isHTML = head.startsWith('<!doctype') || head.startsWith('<html') || /<table[\s>]/.test(head);
     return { isHTML, decodedPrefix: raw.replace(/^﻿/, '') };
   }
   ```

   Then in `parseXLSX`:
   ```typescript
   const { isHTML, decodedPrefix } = isHTMLContent(buffer);
   if (isHTML) {
     const remainder = new TextDecoder('utf-8').decode(buffer.slice(512));
     const fullDecoded = decodedPrefix + remainder;
     const html = normalizeHTML(fullDecoded);
     // ...
   }
   ```
4. Apply the same fix to `packages/parser/src/xlsx/index.ts`

### Exit Criterion

- Only one full decode of the buffer occurs
- HTML detection still works correctly
- Tests pass

---

## Task 6: Handle JSON boolean/null amount values explicitly

**Finding:** C29-debugger-MEDIUM-02
**Severity:** MEDIUM
**Confidence:** Medium
**Files:** `apps/web/src/lib/parser/json.ts` (lines 67-76), `packages/parser/src/json/index.ts` (lines 79-88)

### Problem

`normalizeAmount` silently returns `null` for boolean (`true`, `false`) and `null` values. A boolean `true` might be a data entry error that should be reported rather than silently ignored.

### Implementation

1. Open both JSON parser files
2. Update `normalizeAmount` to emit a parse error for non-string, non-number, non-nullish types:
   ```typescript
   function normalizeAmount(raw: unknown, lineIdx: number, errors: ParseError[]): number | null {
     if (typeof raw === 'number') {
       return Number.isFinite(raw) ? Math.round(raw) : null;
     }
     if (typeof raw === 'string') {
       const parsed = parseCSVAmount(raw);
       return parsed !== null && Number.isFinite(parsed) ? parsed : null;
     }
     if (raw === null || raw === undefined) {
       return null;
     }
     // Boolean or other unexpected type — report as error
     errors.push({ line: lineIdx, message: `금액 필드에 예상치 못한 타입(${typeof raw})이 있습니다: ${String(raw)}` });
     return null;
   }
   ```
3. Update call sites to pass `errors` array
4. Add tests for `amount: true`, `amount: false`

### Exit Criterion

- `amount: true` produces a parse error (not silent null)
- `amount: false` produces a parse error
- `amount: null` and `amount: undefined` still return null without error
- Existing tests pass

---

## Completion Tracking

| Task | Status |
|---|---|
| 1 | pending |
| 2 | pending |
| 3 | pending |
| 4 | pending |
| 5 | pending |
| 6 | pending |
