# Debugger Review — CherryPicker Cycle 37

**Reviewer:** debugger
**Scope:** Logic bugs, edge cases, failure modes, data-flow issues
**Date:** 2026-05-06

---

## Summary

One critical bug (BUG-1) verified fixed in Cycle 37. Three bugs from Cycle 32 remain open. Four new edge-case issues identified in the recently added parsers. The dominant pattern is "silent data loss" — parsers dropping transactions without surfacing errors to the user.

| Category | Count | Severity |
|---|---|---|
| Verified Fixed | 1 | Critical |
| New Findings | 4 | 2 Medium, 2 Low |
| Carryover (still open) | 6 | — |

---

## VERIFIED FIXED

### BUG-1: Per-transaction cap applied to amount instead of reward
**File:** `packages/core/src/calculator/reward.ts:265-277`
**Status:** FIXED

The code now correctly computes the uncapped reward first, then applies `perTxCap` to the reward value:
```typescript
const uncappedReward = calcFn(tx.amount, normalizedRate, null, 0).reward;
rawReward = perTxCap !== null ? Math.min(uncappedReward, perTxCap) : uncappedReward;
```
This resolves the 20x undercalculation bug identified in Cycle 32.

---

## NEW FINDINGS (Cycle 37)

### BUG-37-01: JSON Parser Silently Drops Refunds and Credits
**File:** `packages/parser/src/json/index.ts:138`, `apps/web/src/lib/parser/json.ts:130`
**Severity:** Medium | **Confidence:** High

`parseTransactionObject` returns `null` for `amount <= 0` without pushing an error. A JSON export containing refunds (negative amounts) or balance transfers (zero amounts) will have those transactions silently excluded. The user sees fewer transactions than expected with no explanation.

**Concrete scenario:** User exports transactions from a banking API that includes a -50,000 Won refund. The JSON parser skips it silently. The user wonders why their statement has 45 transactions instead of 46.

**Fix:** Push a `ParseError` when filtering out negative/zero amounts, similar to how unparseable amounts are reported.

---

### BUG-37-02: OFX `parseOFXDate` Timezone Math Is Confusing and Fragile
**File:** `packages/parser/src/ofx/index.ts:88-115`, `apps/web/src/lib/parser/ofx.ts:57-84`
**Severity:** Medium | **Confidence:** Medium

The timezone conversion uses a non-obvious mathematical coincidence:
```typescript
const utcMs = Date.UTC(year, month, day, hour, minute, second) - tzOffset * 3600000;
const kst = new Date(utcMs + 9 * 3600000);
```

`Date.UTC` treats the parameters as UTC time, but the OFX datetime is in the timezone indicated by the offset. The subtraction happens to produce the correct UTC timestamp by coincidence for common cases, but the intent is unclear. Future maintainers may "fix" this into a real bug.

**Concrete risk:** A maintainer refactors this to use local Date methods, breaking cross-midnight cases.

**Fix:** Rewrite with explicit intent:
```typescript
// OFX datetime is LOCAL to the specified timezone offset
// Convert to UTC, then to KST (UTC+9)
const localMs = Date.UTC(year, month, day, hour, minute, second); // treat as epoch-relative
const utcMs = localMs - tzOffset * 3600000;
const kstDate = new Date(utcMs + 9 * 3600000);
```

---

### BUG-37-03: HTML Parser `normalizeHTML` Strips Valid Content Inside "Script-Like" Patterns
**File:** `apps/web/src/lib/parser/html.ts:33-35`
**Severity:** Low | **Confidence:** Low

The while-loop stripping `<script...>...</script>` could remove legitimate content if a bank's HTML export contains the literal text `<script` in a data cell (e.g., a merchant named "FastScript Solutions"). This is a false-positive sanitization.

**Fix:** The risk is low — merchant names rarely contain `<script`. Document the limitation rather than fixing.

---

### BUG-37-04: OFX ExtractTag Double-Regex Evaluation Is Inefficient and Could Mismatch
**File:** `packages/parser/src/ofx/index.ts:67-78`, `apps/web/src/lib/parser/ofx.ts:38-46`
**Severity:** Low | **Confidence:** Medium

For every tag extraction, two regexes are compiled and evaluated:
1. XML-style: `<TAG>value</TAG>`
2. SGML-style: `<TAG>value`

If a block contains BOTH styles (malformed OFX), the XML match wins. But if the XML match captures content from a different tag due to greedy matching, the SGML match is never evaluated. Example:
```
<NAME>Starbucks</NAME><MEMO>Extra text
```
The XML regex for `NAME` correctly matches. But if the closing tag is missing:
```
<NAME>Starbucks<MEMO>Extra text
```
The SGML regex `/<NAME[^>]*>\s*([^<\n\r]+)/` captures "Starbucks" — correct. However, if the block is:
```
<NAME>Starbucks</MEMO>
```
The XML regex `/<NAME[^>]*>\s*([^<]+?)\s*</NAME>` fails (no `</NAME>`), then SGML captures "Starbucks" — also correct. The actual risk is low but the double-evaluation is wasteful.

**Fix:** Cache compiled regexes per tag name, or use a single linear scan.

---

## CARRYOVER (still open from prior cycles)

| ID | Severity | File | Description |
|----|----------|------|-------------|
| BUG-3 | Medium | `store.svelte.ts:567` | NaN propagation in previousMonthSpending |
| BUG-4 | Medium | `xlsx.ts:99` | EUC-KR HTML detection failure |
| BUG-5 | Low | `json.ts:71` | Prototype pollution in findField case-insensitive path |
| BUG-6 | Low | `csv.ts:27` | CSV unclosed quotes not reported |
| BUG-7 | Medium | `ofx.ts:146` | OFX credits silently skipped |
| C32-V02 | High | `reward.ts:47` | `isOnline` never populated, excludeOnline rules unreachable |

---

## Cross-File Interaction Risks

### R1: Silent Data Loss Pattern Across All New Parsers

All three new parsers (HTML, OFX, JSON) silently drop transactions in certain cases:
- **HTML**: `amount <= 0` at line 249 (skips refunds)
- **OFX**: `rawAmount >= 0` at line 191 (skips credits)
- **JSON**: `amount <= 0` at line 130 (skips refunds)

None of these produce user-visible errors. A user uploading a statement with refunds will see missing transactions across all formats. This is a systemic UX issue, not a parser-specific bug.

**Recommendation:** Standardize on one of two approaches:
1. Include refunds/credits as transactions with negative amounts (calculator already handles this via `skippedTransactions`)
2. Report them as parse warnings so the user knows transactions were filtered

---

## Conclusion

**Most critical remaining bugs:**
1. **BUG-3** (NaN propagation) — Complete analysis corruption from malformed input
2. **BUG-7** (OFX credits skipped) — Data loss without user notification
3. **BUG-37-01** (JSON refunds silently dropped) — Same pattern, new format
4. **C32-V02** (`isOnline` dead code) — Silent incorrect reward calculation
