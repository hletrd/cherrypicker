# Cycle 33 Implementation Plan

## Task 1: Fix server-side splitCSVLine doubled-quote parity bug (C33-04)

**Priority:** HIGH  
**Severity:** LOW / Medium  
**File:** `packages/parser/src/csv/generic.ts:133-153`

**Problem:** The server-side `splitCSVLine` function does not handle RFC 4180 escaped quotes (doubled `""` inside quoted fields), while the web-side `splitLine` at `apps/web/src/lib/parser/csv.ts:14` already has this handling. This is a parity bug.

**Fix:** Add the doubled-quote handling to the server-side `splitCSVLine`:
```typescript
if (char === '"' && inQuotes && line[i + 1] === '"') { current += '"'; i++; }
else if (char === '"') { inQuotes = !inQuotes; }
```

**Verification:** Run `bun test` in packages/parser.

---

## Task 2: Fix PDF parseAmount to return null for NaN instead of 0 (C33-03)

**Priority:** HIGH  
**Severity:** LOW / High  
**File:** `apps/web/src/lib/parser/pdf.ts:166-177`

**Problem:** `parseAmount` returns 0 for unparseable amounts instead of null. The zero-amount filter then silently drops these transactions without error reporting. The fallback PDF scanner path (lines 344-357) does not distinguish between genuinely zero amounts and unparseable ones.

**Fix:** Change `parseAmount` to return `number | null`, returning null for NaN. Update both structured and fallback parsing paths to handle null with explicit error reporting, matching the CSV parser's `isValidAmount()` pattern.

**Verification:** Manual review of both PDF parsing paths.

---

## Task 3: Replace Math.abs with direct amount in buildCardResults (C33-06)

**Priority:** MEDIUM  
**Severity:** LOW / Medium  
**File:** `packages/core/src/optimizer/greedy.ts:224`

**Problem:** `buildCardResults` uses `Math.abs(tx.amount)` but `assignedTransactions` only contains positive-amount transactions (filtered at line 270). The `Math.abs()` is a no-op but creates a misleading implication that negative amounts could be present.

**Fix:** Replace `Math.abs(tx.amount)` with `tx.amount` and add a comment noting the optimizer invariant.

**Verification:** Run `bun test` in packages/core.

---

## Task 4: Cache ALL_KEYWORDS entries for MerchantMatcher performance (C33-01)

**Priority:** MEDIUM  
**Severity:** MEDIUM / High  
**File:** `packages/core/src/categorizer/matcher.ts:55-71`

**Problem:** The `match()` method calls `Object.entries(ALL_KEYWORDS)` on every invocation, which creates a new array each time. For large statement files (500+ transactions), this means hundreds of array allocations plus the O(n) substring scan per merchant.

**Fix:** Cache `Object.entries(ALL_KEYWORDS).filter(...)` at module level or in the constructor, so the entries are computed once. This is a lightweight optimization that avoids the per-call allocation without requiring a trie.

**Verification:** Run `bun test` in packages/core.

---

## Deferred Items

| Finding | Reason for Deferral |
|---|---|
| C33-02 (cachedCategoryLabels stale across redeployments) | Requires server-side versioning or cache-TTL mechanism; extends C21-04 which is already tracked as a known limitation. The practical impact is limited to users with long-lived tabs during a redeployment. Not security/correctness/data-loss. Exit criterion: when server-side versioning is implemented, add version check to getCategoryLabels(). |
| C33-05 (toCoreCardRuleSets unit narrowing) | No current YAML data triggers this; Zod schema validates at build time. LOW confidence. Exit criterion: if a YAML file is created with an unknown unit value, add unit allowlist validation to the adapter. |
