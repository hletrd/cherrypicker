# Plan 52 — High Priority Fixes (Cycle 29 RPF)

**Source findings:** C29-code-reviewer HIGH-01, HIGH-02; C29-debugger HIGH-01; C29-test-engineer HIGH-01, HIGH-02

---

## Task 1: Fix parseAmount to reject invalid decimal strings like "1.2.3"

**Finding:** C29-debugger-HIGH-01
**Severity:** HIGH
**Confidence:** High
**File:** `apps/web/src/lib/parser/amount.ts`

### Problem

`parseAmount('1.2.3')` returns `1` instead of `null` because `parseFloat('1.2.3')` parses only up to the second dot and returns `1.2`, which `Math.round` converts to `1`. Similarly, `parseAmount('1..2')` returns `1`. These are not valid Korean Won amounts.

### Implementation

1. Open `apps/web/src/lib/parser/amount.ts`
2. After the cleaning steps and before `Math.round(parseFloat(cleaned))`, add validation:
   ```typescript
   // Reject strings with multiple decimal points (e.g., "1.2.3") or empty-after-dot (e.g., "1.")
   const dotCount = (cleaned.match(/\./g) ?? []).length;
   if (dotCount > 1 || cleaned.endsWith('.')) return null;
   if (!cleaned) return null;  // also add explicit empty guard for parity with server-side
   ```
3. Also apply the same fix to `packages/parser/src/csv/shared.ts` `parseAmountString` for parity
4. Add tests in `apps/web/__tests__/amount.test.ts` and `packages/parser/__tests__/amount.test.ts`

### Exit Criterion

- `parseAmount('1.2.3')` returns `null`
- `parseAmount('1..2')` returns `null`
- `parseAmount('1.')` returns `null`
- Existing valid amounts still parse correctly

---

## Task 2: Fix web-side HTML parser to import parseAmountString from amount.ts

**Finding:** C29-code-reviewer-HIGH-01
**Severity:** HIGH
**Confidence:** High
**File:** `apps/web/src/lib/parser/html.ts` (line 10)

### Problem

`html.ts` imports `parseAmountString` from `./csv.js` instead of `./amount.js`. This creates an unnecessary transitive dependency on all of `csv.ts` just for one function. The `amount.ts` module exists in the same directory and exports `parseAmountString`.

### Implementation

1. Open `apps/web/src/lib/parser/html.ts`
2. Change line 10 from:
   ```typescript
   import { parseAmountString } from './csv.js';
   ```
   to:
   ```typescript
   import { parseAmountString } from './amount.js';
   ```
3. Verify TypeScript compilation succeeds

### Exit Criterion

- `html.ts` imports from `./amount.js`
- TypeScript compilation succeeds
- Tests pass

---

## Task 3: Unify normalizeHTML regex patterns between web and server

**Finding:** C29-code-reviewer-HIGH-02
**Severity:** HIGH
**Confidence:** High
**Files:** `apps/web/src/lib/parser/html.ts`, `packages/parser/src/csv/shared.ts`

### Problem

The quoted-value event handler regex differs:
- Web-side: `(?:"[^"]*"|'[^']*')` — correct, doesn't match mixed quotes
- Server-side: `["'][^"']*["']` — can match `"foo'` which is invalid HTML

The server-side pattern is less correct and could over-match.

### Implementation

1. Open `packages/parser/src/csv/shared.ts`
2. Change lines 191-192 to match the web-side patterns:
   ```typescript
   .replace(/\son\w+\s*=\s*(?:"[^"]*"|'[^']*')/gi, '')
   .replace(/\son\w+\s*=\s*[^>\s]*/gi, '')
   ```
3. Verify tests pass

### Exit Criterion

- Both files use identical regex patterns
- `normalizeHTML` tests pass on both sides

---

## Task 4: Expand normalizeHTML tests to cover javascript: URL variants

**Finding:** C29-test-engineer-HIGH-02
**Severity:** HIGH
**Confidence:** High
**File:** `apps/web/__tests__/parser-html.test.ts`

### Problem

The recently added test (C28-05) only covers double-quoted `href="javascript:..."`. Missing cases: single-quoted, unquoted, `src` attribute, case variations, and `javascript:` in non-href contexts.

### Implementation

1. Open `apps/web/__tests__/parser-html.test.ts`
2. Add test cases for:
   - `<a href='javascript:alert(1)'>`
   - `<img src="javascript:alert(1)">`
   - `<a href="JaVaScRiPt:alert(1)">` (case insensitive)
   - `<div data-value="javascript:foo">` (should NOT strip)
3. Also add corresponding tests in `packages/parser/__tests__/` if an HTML test exists

### Exit Criterion

- All variant cases pass
- Non-href/src contexts preserve `javascript:`

---

## Task 5: Expand amount parser tests for edge cases

**Finding:** C29-test-engineer-HIGH-01
**Severity:** HIGH
**Confidence:** High
**Files:** `apps/web/__tests__/amount.test.ts`, `packages/parser/__tests__/amount.test.ts`

### Problem

Missing edge case tests for:
- `parseAmount('1.2.3')` → should be null
- `parseAmount('원')` → should be null
- `parseAmount('마이너스')` → should be null
- Very large numbers
- Mixed full-width/ASCII digits

### Implementation

1. Open both test files
2. Add edge case tests
3. Ensure both web and server tests stay in parity

### Exit Criterion

- New edge case tests pass
- Existing tests continue to pass

---

## Completion Tracking

| Task | Status |
|---|---|
| 1 | pending |
| 2 | pending |
| 3 | pending |
| 4 | pending |
| 5 | pending |
