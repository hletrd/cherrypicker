# Plan 55 — Medium Priority Fixes (Cycle 30)

**Source findings:** C30-security-reviewer MED-01, MED-02; C30-code-reviewer MED-01, MED-02, MED-03; C30-architect MED-01; C30-debugger LOW-01, LOW-02; C30-test-engineer MED-01, MED-02

---

## Task 1: Add safeJSONParse reviver for sessionStorage

**Finding:** C30-security-reviewer-MED-01
**Severity:** MEDIUM
**Confidence:** Medium
**File:** `apps/web/src/lib/store.svelte.ts:218`

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
- Data containing `__proto__` key throws during parse and falls through to catch block
- Existing tests pass

---

## Task 2: Strengthen Anthropic API key validation

**Finding:** C30-security-reviewer-MED-02
**Severity:** MEDIUM
**Confidence:** Medium
**File:** `packages/parser/src/pdf/llm-fallback.ts:42-46`

### Problem

Current validation only checks prefix (`sk-ant-`) and minimum length (20). This allows partially-correct keys to be sent to the API.

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

### Exit Criterion

- `sk-ant-api03-validkey...` passes validation
- `sk-ant-`, `sk-ant-api`, `sk-ant-api03-` (too short), `invalid` all fail validation
- Existing valid keys still work

---

## Task 3: Document JSON description alias conflict

**Finding:** C30-code-reviewer-MED-01
**Severity:** MEDIUM
**Confidence:** High
**Files:** `apps/web/src/lib/parser/json.ts:51-52`, `packages/parser/src/json/index.ts:56-57`

### Problem

`description` appears in both `MERCHANT_ALIASES` and `MEMO_ALIASES`. Since `findField` scans in order and returns on first match, `description` will ALWAYS match as merchant, never as memo. This is intentional but undocumented.

### Implementation

1. Open both JSON parser files
2. Add a comment before `MEMO_ALIASES` explaining the precedence
3. Add a short comment before `findField` explaining scan-order precedence

### Exit Criterion

- Both files have clear comments explaining why `description` in MEMO_ALIASES is unreachable
- No functional change

---

## Task 4: Add warning for stale build-stats fallbacks

**Finding:** C30-code-reviewer-MED-02
**Severity:** MEDIUM
**Confidence:** High
**File:** `apps/web/src/lib/build-stats.ts:16-18`

### Problem

Hardcoded fallback values become silently stale when actual data changes.

### Implementation

1. Open `apps/web/src/lib/build-stats.ts`
2. Add a console warning in the catch block when fallbacks are used

### Exit Criterion

- Fallback usage emits a visible console warning

---

## Task 5: Remove type assertion in analyzer.ts

**Finding:** C30-code-reviewer-MED-03
**Severity:** MEDIUM
**Confidence:** Medium
**File:** `apps/web/src/lib/analyzer.ts:307`

### Problem

`as AnalysisResult` bypasses TypeScript structural checking after manual validation.

### Implementation

1. Open `apps/web/src/lib/analyzer.ts`
2. Remove the `as AnalysisResult` cast at line 307
3. Fix any TypeScript errors that emerge

### Exit Criterion

- No `as AnalysisResult` cast remains after manual validation
- TypeScript compilation succeeds

---

## Task 6: Refactor isHTMLContent to avoid double decode

**Finding:** C30-architect-MED-01
**Severity:** MEDIUM
**Confidence:** High
**Files:** `apps/web/src/lib/parser/xlsx.ts:327-353`, `packages/parser/src/xlsx/index.ts:30-37`

### Problem

`isHTMLContent` decodes the first 512 bytes, then the caller decodes the full buffer again.

### Implementation

1. Refactor `isHTMLContent` to return `{ isHTML: boolean; decodedPrefix: string }`
2. Update caller to use returned prefix and decode only the remainder

### Exit Criterion

- Only one full decode of the buffer occurs
- HTML detection still works correctly
- Tests pass

---

## Task 7: Add tests for JSON boolean amount handling

**Finding:** C30-test-engineer-MED-01
**Severity:** MEDIUM
**Confidence:** High
**Files:** `apps/web/__tests__/parser-json.test.ts`, `packages/parser/__tests__/json.test.ts`

### Implementation

1. Add tests for `amount: true`, `amount: false`, `amount: null`, `amount: undefined`
2. Verify errors are produced for booleans, not for null/undefined

### Exit Criterion

- New tests pass
- Existing tests continue to pass

---

## Task 8: Add tests for OFX parseAmountString import path

**Finding:** C30-test-engineer-MED-02
**Severity:** MEDIUM
**Confidence:** Medium
**File:** `apps/web/__tests__/parser-ofx.test.ts`

### Implementation

1. Add an OFX test that includes full-width digits or Won signs in amounts
2. This implicitly verifies that `parseAmountString` (with full-width support) is correctly imported

### Exit Criterion

- New tests pass
- Existing tests continue to pass

---

## Completion Tracking

| Task | Status |
|---|---|
| 1 | **completed** — commit 2942408 |
| 2 | **completed** — commit 569fa6c |
| 3 | **completed** — included in commit d94d3de |
| 4 | **completed** — commit b3da308 |
| 5 | **already fixed** in prior cycle (type assertion no longer present) |
| 6 | **deferred** — see 00-deferred-items.md D-52 |
| 7 | **completed** — included in commit d94d3de |
| 8 | **deferred** — low priority, no functional gap (OFX already has amount tests)
