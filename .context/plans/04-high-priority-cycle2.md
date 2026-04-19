# Plan 04 — High-Priority Fixes (Cycle 2: C2-01, C2-S01, C2-D02, C2-08/C2-D03)

**Priority:** HIGH
**Findings addressed:** C2-01, C2-S01, C2-D02, C2-08, C2-D03
**Status:** Completed

---

## Task 1: Fix LLM fallback AbortController signal not connected (C2-01)

**Finding:** `packages/parser/src/pdf/llm-fallback.ts:47-50` — An `AbortController` is created with a 30s timeout but the `signal` is never passed to `client.messages.create()`, making the timeout ineffective.

**File:** `packages/parser/src/pdf/llm-fallback.ts`

**Implementation:**
1. Add `signal: controller.signal` to the `messages.create()` call options
2. Ensure the `finally` block still clears the timeout

**Commit:** `fix(parser): 🐛 connect AbortController signal to LLM API call`

---

## Task 2: Add browser runtime guard to LLM fallback (C2-S01)

**Finding:** `packages/parser/src/pdf/llm-fallback.ts:34-36` — No guard prevents accidental import in browser environments, which could leak the API key.

**File:** `packages/parser/src/pdf/llm-fallback.ts`

**Implementation:**
1. Add a runtime guard at the top of `parsePDFWithLLM`:
```ts
if (typeof window !== 'undefined') {
  throw new Error('LLM fallback is not available in browser environments');
}
```

**Commit:** `fix(parser): 🛡️ add browser runtime guard to LLM fallback`

---

## Task 3: Fix PDF fallback parser `parseInt` without NaN check (C2-D02)

**Finding:** `apps/web/src/lib/parser/pdf.ts:287` — The fallback parser uses `parseInt` directly and checks `amount > 0` instead of using the shared `parseAmount()` function with a `Number.isNaN` check.

**File:** `apps/web/src/lib/parser/pdf.ts`

**Implementation:**
1. Replace the direct `parseInt` call in the fallback parser (line 287) with the existing `parseAmount()` function (defined at line 145)
2. Add `Number.isNaN` check with error reporting, consistent with the structured parser

```ts
// Replace:
const amount = parseInt(amountMatch[1]!.replace(/,/g, ''), 10);
if (amount > 0) {

// With:
const amount = parseAmount(amountMatch[1]!);
if (!Number.isNaN(amount) && amount > 0) {
```

**Commit:** `fix(web): 🐛 use parseAmount with NaN check in PDF fallback parser`

---

## Task 4: Fix `loadFromStorage` dropping `fullStatementPeriod` and `totalTransactionCount` (C2-08/C2-D03)

**Finding:** `apps/web/src/lib/store.svelte.ts:130-139` — When loading from sessionStorage, the validation block creates a new object that doesn't include `fullStatementPeriod` or `totalTransactionCount`, even though these are persisted by `persistToStorage`.

**File:** `apps/web/src/lib/store.svelte.ts`

**Implementation:**
1. Add `fullStatementPeriod` and `totalTransactionCount` to the returned object in `loadFromStorage`:
```ts
return {
  success: Boolean(parsed.success),
  bank: typeof parsed.bank === 'string' || parsed.bank === null ? parsed.bank : null,
  format: typeof parsed.format === 'string' ? parsed.format : 'unknown',
  statementPeriod: parsed.statementPeriod,
  transactionCount: typeof parsed.transactionCount === 'number' ? parsed.transactionCount : 0,
  fullStatementPeriod: parsed.fullStatementPeriod,
  totalTransactionCount: typeof parsed.totalTransactionCount === 'number' ? parsed.totalTransactionCount : undefined,
  parseErrors: [],
  optimization: parsed.optimization,
  monthlyBreakdown: parsed.monthlyBreakdown,
} as AnalysisResult;
```

**Commit:** `fix(web): 🐛 restore fullStatementPeriod and totalTransactionCount from sessionStorage`

---

## Progress

- [x] Task 1: Fix AbortController signal in LLM fallback — `0000000233f`
- [x] Task 2: Add browser runtime guard to LLM fallback — `0000000233f` (combined with Task 1)
- [x] Task 3: Fix PDF fallback parser parseInt without NaN check — `0000000967f`
- [x] Task 4: Fix loadFromStorage dropping new fields — `000000027e3`
