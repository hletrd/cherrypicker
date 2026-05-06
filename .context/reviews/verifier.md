# Verifier Review — CherryPicker Cycle 37

**Reviewer:** verifier
**Scope:** Evidence-based correctness verification of fixes and claims
**Date:** 2026-05-06

---

## Summary

Verified 7 claims from prior cycles: 3 confirmed fixed, 4 remain broken. Added 3 new verified claims on recently introduced code. All gates pass.

| Category | Count |
|---|---|
| Confirmed Fixed | 3 |
| Still Broken | 4 |
| New Verified Claims | 3 |

---

## VERIFIED FIXED

### C37-V01: BUG-1 (Per-Transaction Cap on Reward, Not Amount)
**File:** `packages/core/src/calculator/reward.ts:265-277`
**Status:** FIXED — HIGH CONFIDENCE
**Evidence:**
```typescript
const uncappedReward = calcFn(tx.amount, normalizedRate, null, 0).reward;
rawReward = perTxCap !== null ? Math.min(uncappedReward, perTxCap) : uncappedReward;
```
The `perTxCap` is now applied to the computed reward value, not the transaction amount. Test: 20,000 Won at 5% with 500 Won cap:
- Expected: min(1,000, 500) = 500 Won
- Old (broken): floor(min(20,000, 500) * 0.05) = 25 Won
- New (fixed): floor(20,000 * 0.05) = 1,000; min(1,000, 500) = 500 Won

---

### C37-V02: C32-V09 (JSON Deterministic Field Matching)
**File:** `packages/parser/src/json/index.ts:75-79`, `apps/web/src/lib/parser/json.ts:75-79`
**Status:** FIXED — HIGH CONFIDENCE
**Evidence:** The case-insensitive fallback now iterates over `aliases` in priority order, not `Object.keys(obj)` in insertion order. The comment explicitly notes: "alias order (fixed) determines match priority, not Object.keys insertion order (C32-V09)."

---

### C37-V03: C32-V01 (XLSX Blank-Row Forward-Fill Reset)
**File:** `packages/parser/src/xlsx/index.ts:307-316`, `apps/web/src/lib/parser/xlsx.ts:481-502`
**Status:** FIXED — HIGH CONFIDENCE
**Evidence:** Both XLSX parsers now reset `lastDate`, `lastMerchant`, `lastCategory`, `lastInstallments`, `lastMemo`, `lastAmount` on blank rows (`row.every((c) => !c)`). This matches the HTML parser behavior and prevents forward-fill leakage across sections.

---

## STILL BROKEN (from prior cycles)

### C37-V04: C32-V02 (`isOnline` Never Populated)
**File:** `packages/core/src/calculator/reward.ts:47`, `apps/web/src/lib/parser/types.ts`
**Status:** STILL BROKEN — HIGH CONFIDENCE
**Evidence:** `RawTransaction` has no `isOnline` field. `CategorizedTx.isOnline` is declared optional but never assigned. `ruleConditionsMatch` evaluates `excludeOnline && tx.isOnline` — `isOnline` is always `undefined` (falsy), so this branch is unreachable. The optimizer silently ignores all `excludeOnline` rules.

---

### C37-V05: C32-V07 (FIFO Cache Eviction, Not LRU)
**File:** `packages/core/src/categorizer/matcher.ts:128-130`
**Status:** STILL BROKEN — HIGH CONFIDENCE
**Evidence:**
```typescript
if (this.cache.size >= MAX_CACHE_SIZE) {
  this.cache.delete(this.cache.keys().next().value);
}
```
`Map.keys()` iterates in insertion order. Evicting the first key is FIFO, not LRU. The comment at line 15 still claims "LRU cache keyed by normalized merchant name."

---

### C37-V06: C32-V03 (Web UTF-16 Not Supported)
**File:** `apps/web/src/lib/parser/index.ts:26-62` vs `packages/parser/src/detect.ts:9-47`
**Status:** STILL BROKEN — MEDIUM CONFIDENCE
**Evidence:** Web-side `parseFile` tries `['utf-8', 'cp949']` via TextDecoder. No BOM sniffing for UTF-16 LE/BE. A UTF-16-encoded statement would show mojibake in the browser but parse correctly on the server.

---

### C37-V07: BUG-3 (NaN Propagation in `previousMonthSpending`)
**File:** `apps/web/src/lib/store.svelte.ts:567`, `apps/web/src/lib/analyzer.ts:228-229`
**Status:** STILL BROKEN — HIGH CONFIDENCE
**Evidence:** `options?.previousMonthSpending !== undefined` passes for `NaN`. No `Number.isFinite()` guard. NaN propagates to `selectTier`, causing all rewards to be zero with no error.

---

## NEW VERIFIED CLAIMS

### C37-V08: JSON Parser `normalizeAmount` Handles Boolean Amounts
**File:** `packages/parser/src/json/index.ts:96-100`, `apps/web/src/lib/parser/json.ts:96-100`
**Status:** HOLDING — MEDIUM CONFIDENCE
**Evidence:** `normalizeAmount` correctly detects boolean values and pushes a type error. Tested via code inspection: `typeof raw === 'boolean'` falls through to the final else branch which pushes `ParseError` with the actual type name.

### C37-V09: HTML Forward-Fill Reset on Summary Rows
**File:** `packages/parser/src/html/index.ts:167-177`, `apps/web/src/lib/parser/html.ts:180-190`
**Status:** HOLDING — HIGH CONFIDENCE
**Evidence:** Both HTML parsers reset forward-fill state on `isSummaryRow(rowText)`. This matches the XLSX behavior and prevents summary row totals from leaking into data rows.

### C37-V10: OFX CCSTMTRS Terminator Pattern
**File:** `packages/parser/src/ofx/index.ts:49`, `apps/web/src/lib/parser/ofx.ts:22`
**Status:** HOLDING — MEDIUM CONFIDENCE
**Evidence:** Both OFX parsers include `CCSTMTRS` and `CREDITCARDMSGSRSV1` in the SGML terminator pattern. The patterns are identical between server and web. No runtime verification performed due to lack of test fixtures.

---

## Gate Verification

| Gate | Result |
|------|--------|
| `npm run lint` | PASS |
| `npm run typecheck` | PASS |
| `bun run test` | PASS |

---

## Verdict

**FIX BEFORE SHIP:**
- C37-V04 (`isOnline` dead code) — silent incorrect reward calculation
- C37-V07 (NaN propagation) — complete analysis corruption

**FIX RECOMMENDED:**
- C37-V05 (FIFO cache) — performance degradation + incorrect semantics
- C37-V06 (UTF-16 web gap) — cross-platform parity failure
