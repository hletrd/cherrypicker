# Plan 56 — Medium Priority Fixes (Cycle 31)

**Source findings:** C31-TEST01 (MEDIUM), C31-TEST02 (MEDIUM), C31-TEST03 (MEDIUM), C31-CR01 (LOW/High), C31-CR04 (LOW/High), C31-CR05 (LOW), C31-SEC01 (LOW), C31-SEC02 (LOW), C31-TRACE01 (LOW), C31-TRACE02 (LOW)

---

## Task 1: Add HTML parser forward-fill edge case tests

**Finding:** C31-TEST01
**Severity:** MEDIUM
**Confidence:** High
**Files:** `apps/web/__tests__/parser-html.test.ts`, `packages/parser/__tests__/html.test.ts`

### Problem

HTML parser forward-fill logic has limited test coverage for edge cases: blank rows between data sections, summary rows with empty cells followed by data rows with empty cells, multiple sheets with different header positions, and malformed HTML with unclosed quotes.

### Implementation

1. Add test cases for blank rows between data sections (forward-fill state should ideally reset)
2. Add test for summary row with empty cells followed by data rows with empty cells
3. Add test for multiple sheets in one HTML file with different header positions
4. Add test for malformed HTML with unclosed quotes in event handlers
5. Apply same tests to both web and server test files

### Exit Criterion

- New tests pass for both web and server HTML parsers
- Edge cases are documented in test descriptions

---

## Task 2: Add JSON parser case-insensitive field matching tests

**Finding:** C31-TEST02
**Severity:** MEDIUM
**Confidence:** High
**Files:** `apps/web/__tests__/parser-json.test.ts`, `packages/parser/__tests__/json.test.ts`

### Problem

The `findField` function supports case-insensitive matching, but there are no tests verifying that `TransactionDate`, `TRANSACTIONDATE`, and `transaction_date` all resolve correctly.

### Implementation

1. Add test cases for case-variant field names:
   - `TransactionDate`, `TRANSACTION_DATE`, `transactionDate`, `TRANSACTIONDATE`
   - `Amount`, `AMOUNT`, `amount`
   - `MerchantName`, `MERCHANT_NAME`, `merchantName`
2. Add test for Korean aliases with no case variation (should still match exactly)
3. Apply to both web and server test files

### Exit Criterion

- Tests verify case-insensitive matching for English aliases
- Tests verify exact matching for Korean aliases

---

## Task 3: Add OFX timezone conversion cross-midnight tests

**Finding:** C31-TEST03
**Severity:** MEDIUM
**Confidence:** Medium
**Files:** `apps/web/__tests__/parser-ofx.test.ts`, `packages/parser/__tests__/ofx.test.ts`

### Problem

`parseOFXDate` handles timezone offsets but lacks tests for cross-midnight scenarios where UTC-5 23:00 should become KST next day.

### Implementation

1. Add test cases for timezone conversion:
   - UTC-5 23:00 -> next day in KST
   - UTC+9 (already KST) -> same day
   - No timezone specified -> treat as local/KST
2. Add test for credit card statement wrappers (`<CCSTMTRS>`, `<CREDITCARDMSGSRSV1>`)
3. Add test for SGML-style unclosed tags
4. Apply to both web and server test files

### Exit Criterion

- Cross-midnight timezone tests pass
- CCSTMTRS parsing is explicitly tested

---

## Task 4: Fix `parseAmountString` to reject malformed numeric strings

**Finding:** C31-CR01
**Severity:** LOW
**Confidence:** High
**Files:** `packages/parser/src/csv/shared.ts`, `apps/web/src/lib/parser/amount.ts`

### Problem

`parseAmountString` allows malformed strings like `1-2-3` to parse as `1` because `parseFloat('1-2-3')` returns `1`.

### Implementation

1. Add validation regex after cleaning: `/^-?\d+(?:\.\d+)?$/.test(cleaned)` before calling `parseFloat`
2. Apply to both web-side (`amount.ts`) and server-side (`csv/shared.ts`)
3. Add test cases for malformed strings: `1-2-3`, `1.2.3`, `abc`, `12-`.

### Exit Criterion

- `parseFloat` is only called on strings matching the validation regex
- Malformed strings return `null` or `NaN` (existing error behavior)
- Tests verify rejection of malformed inputs

---

## Task 5: Add assignment entry validation to `loadFromStorage`

**Finding:** C31-CR04
**Severity:** LOW
**Confidence:** High
**File:** `apps/web/src/lib/store.svelte.ts:249-275`

### Problem

Individual `assignments` entries are never validated. A corrupted entry missing `assignedCardId` or `category` would pass validation and could crash downstream components.

### Implementation

1. Add validation for each assignment entry:
   - `assignedCardId` is a string and non-empty
   - `category` is a string and non-empty
   - `spending` is a number and >= 0
2. If any entry fails validation, treat the entire assignments array as invalid
3. Add test cases for corrupted assignment objects

### Exit Criterion

- Corrupted assignment entries are caught during validation
- Invalid assignments trigger `clearStorage()` (consistent with existing error handling)

---

## Task 6: Add structural validation to LLM fallback JSON parsing

**Finding:** C31-CR05 + C31-SEC02
**Severity:** LOW
**Confidence:** Medium
**Files:** `packages/parser/src/pdf/llm-fallback.ts:92-120`

### Problem

The LLM fallback parses JSON without validating that the top-level structure is an array of objects. It also doesn't validate `date` format, `amount` positivity, or `installments` type.

### Implementation

1. After `JSON.parse(candidate)`, add guard:
   ```typescript
   if (!Array.isArray(parsed) || !parsed.every(tx => typeof tx === 'object' && tx !== null)) {
     continue;
   }
   ```
2. Enhance transaction filter:
   - Validate `amount > 0 && Number.isFinite(amount)`
   - Validate date matches `/\d{4}-\d{2}-\d{2}/`
   - Validate `installments` (if present) is a positive integer
3. Add a max-length check before `JSON.parse` to prevent memory issues with huge responses

### Exit Criterion

- Non-array or non-object LLM responses are rejected
- Each transaction has valid date format, positive finite amount
- Tests verify structural validation

---

## Task 7: Fix `normalizeHTML` to handle backtick-quoted event handlers

**Finding:** C31-SEC01
**Severity:** LOW
**Confidence:** Medium
**Files:** `apps/web/src/lib/parser/html.ts:42-46`, `packages/parser/src/csv/shared.ts`

### Problem

The regex only handles double-quoted and single-quoted event handler values. Backtick-quoted attributes (e.g., `onclick=\`alert(1)\``) are not matched.

### Implementation

1. Extend the quoted-value regex to include backticks:
   ```typescript
   .replace(/\son\w+\s*=\s*(?:"[^"]*"|'[^']*'|\`[^\`]*\`)/gi, '')
   ```
2. Apply to both web-side (`html.ts`) and server-side (`csv/shared.ts`)
3. Add test for backtick-quoted event handlers

### Exit Criterion

- Backtick-quoted event handlers are stripped
- Existing double/single quote tests still pass

---

## Task 8: Reset forward-fill state on blank rows in HTML parser

**Finding:** C31-TRACE01
**Severity:** LOW
**Confidence:** Medium
**Files:** `apps/web/src/lib/parser/html.ts`, `packages/parser/src/html/index.ts`

### Problem

Blank rows are skipped but forward-fill state (`lastDate`, `lastMerchant`, etc.) is NOT reset. If a data section ends, followed by blank rows, followed by another data section with empty cells, the first section's values would forward-fill into the second.

### Implementation

1. In `parseHTMLSheet`, reset `lastDate`, `lastMerchant`, `lastCategory`, `lastInstallments`, `lastMemo` when a blank row is encountered
2. Apply to both web and server parsers
3. Add test verifying that blank rows break forward-fill state

### Exit Criterion

- Blank rows reset forward-fill state
- Data sections are isolated from each other
- Existing forward-fill tests still pass

---

## Task 9: Fix store load -> reoptimize stale baseline spending

**Finding:** C31-TRACE02
**Severity:** LOW
**Confidence:** Medium
**File:** `apps/web/src/lib/store.svelte.ts`

### Problem

When old data is loaded from sessionStorage and categories are edited, `reoptimize` uses stale `previousMonthSpendingOption` and `cardIdsOption`.

### Implementation

1. Option A: Clear `previousMonthSpendingOption` on load from storage (treat as unknown)
2. Option B: Add a timestamp/version check to invalidate stale data
3. Document the chosen approach in code comments
4. Add test verifying that reoptimization after load uses current values, not stale ones

### Exit Criterion

- Reoptimization after loading from storage uses fresh baseline values
- Users don't get incorrect optimization results from stale data

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
| 7 | pending |
| 8 | pending |
| 9 | pending |
