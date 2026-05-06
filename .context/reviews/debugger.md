# Cycle 32 Debugger Review

**Reviewer:** debugger (worker-8)
**Scope:** Logic bugs, edge cases, failure modes, incorrect assumptions, data-flow issues
**Date:** 2026-05-06

---

## Summary

Found **7 confirmed issues** (High confidence), **4 likely issues** (Medium confidence), and **3 risks** (Low confidence / needs manual validation). Issues span reward calculation correctness, parser edge cases, state management race conditions, and floating-point accumulation errors.

---

## Confirmed Issues (High Confidence)

### BUG-1: Per-transaction cap applied to amount instead of reward for percentage-based rewards

**File:** `packages/core/src/calculator/reward.ts:265`

**Code:**
```typescript
const effectiveAmount = perTxCap !== null ? Math.min(tx.amount, perTxCap) : tx.amount;
rawReward = calcFn(effectiveAmount, normalizedRate, null, 0).reward;
```

**Problem:** For percentage rewards (cashback, discount, points, mileage), `perTxCap` is applied to the transaction **amount** before computing the reward. This is mathematically incorrect when `perTxCap` is intended as a cap on the **reward value**.

**Concrete failure:** Card with 5% cashback and per-transaction cap of 500 Won:
- Transaction of 20,000 Won
- Expected: min(floor(20,000 * 0.05), 500) = min(1,000, 500) = **500 Won**
- Actual: floor(min(20,000, 500) * 0.05) = floor(500 * 0.05) = **25 Won**

The user receives 25 Won instead of 500 Won — a **20x undercalculation**.

**Why this matters:** Korean card rules commonly express per-transaction caps as reward caps (e.g., "5% cashback, max 500 Won per transaction"). The current implementation silently miscalculates these rewards.

**Fix:** Apply perTxCap to the reward, not the amount:
```typescript
const uncappedReward = calcFn(tx.amount, normalizedRate, null, 0).reward;
rawReward = perTxCap !== null ? Math.min(uncappedReward, perTxCap) : uncappedReward;
```

**Note:** For fixed rewards (line 270-271), `perTxCap` is correctly applied to `rawReward`.

---

### BUG-2: Floating-point accumulation in totalReward and totalSpending across category rewards

**File:** `packages/core/src/calculator/reward.ts:352-353`

**Code:**
```typescript
const totalReward = categoryRewardList.reduce((sum, categoryReward) => sum + categoryReward.reward, 0);
const totalSpending = categoryRewardList.reduce((sum, categoryReward) => sum + categoryReward.spending, 0);
```

**Problem:** Repeated floating-point addition of monetary values (Won amounts as numbers) can accumulate rounding errors. While individual rewards use `Math.floor()` (integer results), the `totalReward` and `totalSpending` are sums of potentially many integers. In JavaScript, integers up to 2^53 are safe, but the pattern of using `number` for all monetary values throughout the codebase is fragile.

**Concrete failure:** With ~100,000 transactions each with ~1,000 Won rewards, the accumulation is still within safe integer range. However, if the codebase ever introduces non-integer rewards (e.g., mileage point conversions with fractional values), this would silently lose precision.

**Fix:** Use `BigInt` for all monetary calculations, or at minimum add a runtime assertion that `Number.isSafeInteger(totalReward)` after accumulation.

---

### BUG-3: Store reoptimize accepts NaN previousMonthSpending without validation

**File:** `apps/web/src/lib/store.svelte.ts:567-569`

**Code:**
```typescript
if (options?.previousMonthSpending !== undefined) {
  previousMonthSpending = options.previousMonthSpending;
}
```

**Problem:** The check `!== undefined` passes for `NaN`. If `options.previousMonthSpending` is `NaN` (e.g., from a malformed form input or `parseInt("")`), it propagates through the optimizer. `NaN >= t.minSpending` is `false` for all tiers, so `selectTier` returns `undefined`, `tierId` becomes `'none'`, and all rewards are 0. No error is surfaced to the user.

**Concrete failure:** User enters an empty string or non-numeric value in the "previous month spending" form field. The UI passes `NaN` to `reoptimize()`. All card rewards silently become 0. The user sees "no rewards available" with no indication that their input was invalid.

**Fix:** Add validation:
```typescript
if (options?.previousMonthSpending !== undefined && Number.isFinite(options.previousMonthSpending) && options.previousMonthSpending >= 0) {
  previousMonthSpending = options.previousMonthSpending;
}
```

**Same issue exists in** `analyzer.ts:229` where `options.previousMonthSpending` is passed directly to `cardPreviousSpending.set()`.

---

### BUG-4: HTML/XLS detection fails for EUC-KR encoded HTML exports

**File:** `apps/web/src/lib/parser/xlsx.ts:327-336`

**Code:**
```typescript
export function isHTMLContent(buffer: ArrayBuffer): boolean {
  const raw = new TextDecoder('utf-8').decode(buffer.slice(0, 512));
  const head = raw.replace(/^﻿/, '').trimStart().toLowerCase();
  return head.startsWith('<!doctype') || head.startsWith('<html') || /<table[\s>]/.test(head);
}
```

**Problem:** Some Korean bank card exports use EUC-KR/CP949 encoding for HTML files with `.xls` extension. When decoded as UTF-8, Korean text becomes replacement characters (`�`), which can corrupt the HTML tag detection. The comment at line 331-332 acknowledges this as a "known limitation" but it causes real parse failures.

**Concrete failure:** A user uploads a `.xls` file that is actually HTML with CP949-encoded Korean text like `<table>`. After UTF-8 decoding, the bytes become gibberish with `�`. `isHTMLContent` returns `false`, so the file is passed to `XLSX.read()` as binary array. SheetJS cannot parse it, producing empty results.

**Fix:** Try CP949 decoding in addition to UTF-8, similar to the CSV encoding detection in `parseFile`:
```typescript
function tryDecode(buffer: ArrayBuffer, encoding: string): string {
  try { return new TextDecoder(encoding).decode(buffer); } catch { return ''; }
}
const utf8 = tryDecode(buffer.slice(0, 512), 'utf-8');
const cp949 = tryDecode(buffer.slice(0, 512), 'cp949');
const raw = (utf8.match(/�/g) ?? []).length > (cp949.match(/�/g) ?? []).length ? cp949 : utf8;
```

---

### BUG-5: `findField` in JSON parser case-insensitive match has prototype pollution risk

**File:** `apps/web/src/lib/parser/json.ts:67-75`

**Code:**
```typescript
function findField(obj: Record<string, unknown>, aliases: string[]): unknown {
  for (const alias of aliases) {
    if (Object.hasOwn(obj, alias)) return obj[alias];
    const lower = alias.toLowerCase();
    for (const key of Object.keys(obj)) {
      if (key.toLowerCase() === lower) return obj[key];
    }
  }
  return undefined;
}
```

**Problem:** The case-insensitive match iterates over `Object.keys(obj)`. If a malicious JSON payload contains keys like `__proto__`, `constructor`, or `prototype` (even in different cases like `__PROTO__`), `Object.keys` will include them. While `Object.hasOwn` is used for the exact match, the case-insensitive fallback at line 71-72 does NOT use `Object.hasOwn`. If the alias list contains a string that case-insensitively matches a prototype-polluting key, the function would return the value from the prototype chain.

**Concrete failure:** Malicious JSON with `{"amount": 10000, "__proto__": {"polluted": true}}`. If an alias list contains `"__proto__"` (unlikely but possible if user-controlled), the parser could access prototype properties.

**Fix:** Use `Object.hasOwn` in the case-insensitive path:
```typescript
for (const key of Object.keys(obj)) {
  if (key.toLowerCase() === lower && Object.hasOwn(obj, key)) return obj[key];
}
```

---

### BUG-6: CSV `splitLine` does not handle unclosed quotes

**File:** `apps/web/src/lib/parser/csv.ts:27-41`

**Code:**
```typescript
function splitLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let inQuotes = false;
  let current = '';
  for (let i = 0; i < line.length; i++) {
    const char = line[i]!;
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else { inQuotes = !inQuotes; }
    } else if (char === delimiter && !inQuotes) { result.push(current.trim()); current = ''; }
    else { current += char; }
  }
  result.push(current.trim());
  return result;
}
```

**Problem:** If a line contains an unclosed quote (e.g., a malformed CSV where `"` starts a quoted field but never ends), `inQuotes` remains `true` at the end. This means the delimiter is not recognized inside the "quoted" region, causing the entire rest of the line to be treated as a single field. While this is standard RFC 4180 behavior, it silently produces incorrect results for malformed inputs without any error reporting.

**Concrete failure:** A bank export has a merchant name with an embedded quote: `"스타벅스"커피"`. Without proper escaping, this line might have an unclosed quote. The entire row after the unclosed quote becomes a single field, shifting all columns. Amount values end up in the merchant column, causing parse failures or incorrect amounts.

**Fix:** Track unclosed quotes and report a parse error:
```typescript
function splitLine(line: string, delimiter: string): { cells: string[]; unclosedQuote: boolean } {
  // ... existing logic ...
  return { cells: result, unclosedQuote: inQuotes };
}
```

---

### BUG-7: OFX parser silently skips positive amounts (credits) without user-visible reason

**File:** `apps/web/src/lib/parser/ofx.ts:143`

**Code:**
```typescript
if (rawAmount >= 0) continue;
const amount = Math.abs(rawAmount);
```

**Problem:** The OFX parser only extracts transactions with **negative** amounts (charges), treating positive amounts as credits/payments that are skipped. The comment at line 86-88 explains: "In OFX: negative = charges, positive = credits." However, this is a lossy assumption. In OFX, the TRNTYPE field distinguishes DEBIT vs CREDIT. A CREDIT transaction (e.g., refund) has a positive amount but IS a transaction that should appear in the user's statement.

**Concrete failure:** User imports an OFX file containing a refund (positive amount, TRNTYPE=CREDIT). The parser silently skips it. The user sees fewer transactions than expected with no explanation. The `errors` array does not contain any message about skipped credits.

**Fix:** Either include credits (positive amounts) as transactions with negative amounts, or report them as parse warnings so the user understands why transactions are missing:
```typescript
if (rawAmount >= 0) {
  errors.push(new ParseError(`OFX 크레딧(환불/입금) 거래는 현재 지원하지 않습니다: ${name} ${rawAmount}원`, { line: i + 1 }));
  continue;
}
```

---

## Likely Issues (Medium Confidence)

### BUG-8: `inferYear` timezone-dependent behavior near year boundary

**File:** `apps/web/src/lib/parser/date-utils.ts:35-50`

**Problem:** The `inferYear` function uses `new Date()` which depends on the local timezone. Near midnight on December 31 in UTC-X timezones, `now.getFullYear()` may already return the next year, causing `inferYear(12, 31)` to return the current year when the previous year was intended.

The code comment at lines 29-34 acknowledges this as a "known limitation" and dismisses it as "narrow edge case (minutes around midnight, once per year)". However, for a financial application processing statements uploaded on Dec 31, this is a real data corruption risk.

**Fix:** Use UTC dates:
```typescript
export function inferYear(month: number, day: number): number {
  const now = new Date();
  const thisYear = now.getUTCFullYear();
  const candidate = new Date(thisYear, month - 1, day);
  // ... rest of logic using UTC methods
}
```

---

### BUG-9: MerchantMatcher cache key collision with different rawCategory normalizations

**File:** `apps/web/src/lib/categorizer/matcher.ts:42`

**Code:**
```typescript
const cacheKey = `${lower}|${rawCategory?.trim().toLowerCase() ?? ''}`;
```

**Problem:** The cache key uses `rawCategory?.trim().toLowerCase()`. But the matching logic at lines 114-121 normalizes the raw category differently:
```typescript
const normalised = rawCategory.trim().toLowerCase().replace(/\s+/g, '_');
```

Two different `rawCategory` inputs that differ only in whitespace normalization would get DIFFERENT cache keys but match to the SAME normalized category. This causes unnecessary cache misses and repeated computation.

**Fix:** Normalize the cache key consistently:
```typescript
const cacheKey = `${lower}|${rawCategory?.trim().toLowerCase().replace(/\s+/g, '_') ?? ''}`;
```

---

### BUG-10: `normalizeHeader` full-width replacement misses U+FF00 and U+FF5F-U+FF60

**File:** `apps/web/src/lib/parser/column-matcher.ts:18-24`

**Code:**
```typescript
.replace(/[！-～]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0))
```

**Problem:** The range U+FF01 to U+FF5E covers full-width ASCII characters. But U+FF00 (fullwidth space) and U+FF5F-FF60 (fullwidth corner brackets) are not covered. A bank export header with fullwidth space (e.g., `이용　금액` with U+FF00 space) would not be normalized to ASCII space, causing the header match to fail.

**Fix:** Add explicit handling for U+FF00:
```typescript
.replace(/＀/g, ' ')  // Fullwidth space to ASCII space
```

---

### BUG-11: Greedy optimizer produces locally-optimal but globally-suboptimal assignments

**File:** `packages/core/src/optimizer/greedy.ts`

**Problem:** The greedy optimizer assigns each transaction to the card with the highest marginal reward without considering future transactions. This is a classic greedy algorithm limitation.

**Concrete scenario:** Card A: 10% on dining, monthly cap 1,000 Won. Card B: 5% on dining, no cap.
Transactions: 15,000 Won and 10,000 Won.
- Greedy (largest first): 15,000 on A (gets 1,000), 10,000 on B (gets 500). Total = 1,500.
- Optimal: 10,000 on A (gets 1,000), 15,000 on B (gets 750). Total = 1,750.

Greedy is worse by 250 Won (16.7%). This is a real issue for users trying to maximize rewards.

**Assessment:** This is a fundamental algorithmic limitation, not a bug per se. But it should be documented to users that recommendations are approximate.

---

## Risks Needing Manual Validation (Low Confidence)

### RISK-1: `scoreCardsForTransaction` quadratic complexity with repeated full reward calculation

**File:** `packages/core/src/optimizer/greedy.ts:39-66`

**Problem:** For each transaction and each card, `scoreCardsForTransaction` calls `calculateCardOutput` twice (before and after adding the transaction). Each `calculateCardOutput` call processes ALL transactions currently assigned to that card. With N transactions and M cards, this is O(N^2 * M) time complexity.

For a user with 1,000 transactions and 20 cards, this could be very slow. The JavaScript execution might block the UI thread in the browser.

**Mitigation:** The web app filters to the latest month (typically 30-100 transactions), and the greedy runs in a worker or async context. Still worth monitoring for performance.

---

### RISK-2: `parseAmount` allows `+` prefix but rejects bare integers < 5 digits

**File:** `apps/web/src/lib/parser/amount.ts`

**Problem:** The amount parser has a tension: it allows `+1,234` (with explicit plus prefix) but rejects bare `1234` (without comma or Won sign). The `AMOUNT_PATTERNS` in csv.ts include `/^\d{5,}\s*원?$/` requiring 5+ digits for bare integers. This means a transaction of exactly 1,234 Won written as `1234` (4 digits, no comma) would NOT match in column detection, though it WOULD parse correctly via `parseAmount` if found.

**Concrete failure:** In the generic CSV parser's data-inference phase (lines 319-327), `isAmountLike` uses `AMOUNT_PATTERNS`. A cell containing `1234` (4 digits, no comma) fails `isAmountLike`. If the header detection also fails, the amount column might not be found, producing empty results.

**Assessment:** Most Korean bank exports use comma separators for amounts >= 1,000. But small transactions (< 10,000 Won) in test files or simple exports might lack commas. This is a low-frequency edge case.

---

### RISK-3: `ruleSpecificity` tie-breaker uses array index, but rules may be reordered

**File:** `packages/core/src/calculator/reward.ts:86-90`

**Code:**
```typescript
return candidates.sort((a, b) => {
  const diff = ruleSpecificity(b) - ruleSpecificity(a);
  if (diff !== 0) return diff;
  return rules.indexOf(a) - rules.indexOf(b);
})[0];
```

**Problem:** The tie-breaker uses `rules.indexOf(a)` which depends on array reference identity. If `rules` is a fresh array on each call (e.g., from JSON parsing), this is stable. But if rules are ever deduplicated, filtered, or reordered before being passed to `calculateRewards`, the tie-breaking behavior changes.

**Fix:** Add a stable `priority` or `order` field to `RewardRule` and use that for tie-breaking instead of array index.

---

## Cross-File Interaction Issues

### CROSS-1: Web `parseAmount` vs server-side `parseCSVAmount` parity drift

**Files:** `apps/web/src/lib/parser/amount.ts` vs `packages/parser/src/amount.ts` (server-side)

**Problem:** The web parser's `amount.ts` is a copy of the server-side parser's amount logic. Comments reference parity (e.g., C29-HIGH-01, C31-CR01), but any future fix must be applied in both places. There is no automated check for parity.

**Concrete risk:** A bug fix in one location (e.g., handling a new Korean bank's amount format) could be forgotten in the other, causing the web and CLI tools to produce different results for the same file.

**Fix:** Add a parity test that runs the same inputs through both parsers and asserts identical outputs.

---

## Final Sweep: Commonly Missed Issues

1. **No input sanitization on `previousMonthSpending` form value** — NaN/Infinity can propagate (BUG-3 variant).
2. **No upper bound on file size** — A maliciously large file could exhaust browser memory.
3. **`parseFile` doesn't limit CSV line count** — A 1-million-line CSV would block the main thread.
4. **`parsePDF` text extraction doesn't handle encrypted PDFs** — Would produce generic "PDF 텍스트 추출 실패" without distinguishing password-protected vs corrupted.
5. **No retry logic for `loadCategories()`** — If the categories JSON fetch fails once (network blip), the app shows an error with no retry option.

---

## Conclusion

The most critical bugs are:
1. **BUG-1** (per-transaction cap applied to amount) — Causes significant undercalculation of rewards.
2. **BUG-4** (EUC-KR HTML detection failure) — Causes complete parse failure for affected bank exports.
3. **BUG-7** (OFX credits silently skipped) — Causes data loss without user notification.
4. **BUG-3** (NaN propagation) — Causes complete analysis corruption from malformed input.

These four should be prioritized for fixing in the next development cycle.
