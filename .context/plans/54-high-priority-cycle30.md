# Plan 54 — High Priority Fixes (Cycle 30)

**Source findings:** C30-code-reviewer HIGH-01, HIGH-02; C30-debugger HIGH-01

---

## Task 1: Fix JSON normalizeAmount to report errors for boolean/null values

**Finding:** C30-code-reviewer-HIGH-01 / C30-debugger-MED-01
**Severity:** HIGH
**Confidence:** High
**Files:** `apps/web/src/lib/parser/json.ts:67-76`, `packages/parser/src/json/index.ts:79-88`

### Problem

`normalizeAmount` returns `null` for boolean values (`true`, `false`) and other unexpected types without emitting any parse error. If a JSON export contains `amount: true` due to a data export bug, the transaction is silently dropped. The user sees no error and may not realize transactions are missing.

### Implementation

1. Open both JSON parser files (web and server)
2. Update `normalizeAmount` to accept an `errors` parameter and report unexpected types:
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
     errors.push(new ParseError(
       `금액 필드에 예상치 못한 타입(${typeof raw})이 있습니다: ${String(raw)}`,
       { line: lineIdx }
     ));
     return null;
   }
   ```
3. Update call sites in `parseTransactionObject` to pass `errors` array
4. Add tests for `amount: true`, `amount: false`

### Exit Criterion

- `amount: true` produces a parse error (not silent null)
- `amount: false` produces a parse error
- `amount: null` and `amount: undefined` still return null without error
- Existing tests pass

---

## Task 2: Fix web-side OFX parser import path

**Finding:** C30-code-reviewer-HIGH-02
**Severity:** HIGH
**Confidence:** High
**File:** `apps/web/src/lib/parser/ofx.ts:10`

### Problem

`ofx.ts` imports `parseAmountString` from `./csv.js` instead of `./amount.js`. This creates an unnecessary transitive dependency on all of `csv.ts` just for one function. The `amount.ts` module exists in the same directory and exports `parseAmountString`. The `html.ts` parser already imports correctly from `./amount.js`.

### Implementation

1. Open `apps/web/src/lib/parser/ofx.ts`
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

- `ofx.ts` imports from `./amount.js`
- TypeScript compilation succeeds
- Tests pass

---

## Completion Tracking

| Task | Status |
|---|---|
| 1 | **completed** — commit d94d3de |
| 2 | **completed** — commit d072ff7 |
