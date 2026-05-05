# Plan 46 — High-Priority Fixes (Cycle 20, May 2026)

**Priority:** HIGH (implementation-bound)
**Findings addressed:** C20-01, C20-02, C20-03, C20-04, C20-DOC02, C20-DOC03, C20-ARCH01-evaluation
**Status:** TODO

---

## Task 1: Unify server-side OFX amount parsing with `parseAmountString` (C20-01)

**Finding:** C20-01 (MEDIUM) — Server-side `parseOFXAmount` uses minimal `parseFloat` after stripping commas. Web-side delegates to `parseAmountString` which handles full-width digits, Won signs, `마이너스` prefix, trailing minus, and KRW prefix. Full-width OFX amounts parse correctly in web but fail in server CLI.

**Files:**
- `packages/parser/src/ofx/index.ts:108-114` (server-side `parseOFXAmount`)
- `apps/web/src/lib/parser/ofx.ts:79-81` (web-side reference)

**Implementation:**

1. Import `parseAmountString` from the package index in `packages/parser/src/ofx/index.ts`:
   ```ts
   import { parseAmountString } from '../csv/shared.js';
   ```
   (Or from `../index.js` — verify which path is idiomatic for internal imports in this package.)

2. Replace the minimal `parseOFXAmount` implementation:
   ```ts
   // BEFORE (lines 108-114):
   function parseOFXAmount(raw: string): number | null {
     if (!raw.trim()) return null;
     const cleaned = raw.trim().replace(/,/g, '');
     const n = parseFloat(cleaned);
     if (Number.isNaN(n) || !Number.isFinite(n)) return null;
     return Math.round(n);
   }

   // AFTER:
   /** Parse an OFX amount string. In OFX: negative = charges (money out), positive = credits.
    *  Reuses parseAmountString for full-width digit and format normalization (C20-01). */
   function parseOFXAmount(raw: string): number | null {
     return parseAmountString(raw);
   }
   ```

3. Verify `parseAmountString` is already exported from `packages/parser/src/csv/shared.ts` (line 140) and re-exported from `packages/parser/src/index.ts` (line 24).

**Verification:** Run `bun run test` — OFX tests should still pass. Add full-width test cases per Task 7 (Plan 47).

**Commit:** `fix(parser): 🐛 unify server-side OFX amount parsing with parseAmountString (C20-01)`

---

## Task 2: Add regex escape helper to OFX `extractTag` (C20-02 / C20-SEC01)

**Finding:** C20-02 (MEDIUM) — `new RegExp(\`<${tagName}...\`)` constructs regex from string without escaping. If tagName contains regex metacharacters (from malformed OFX), this throws SyntaxError. Both server and web parsers have this pattern.

**Files:**
- `packages/parser/src/ofx/index.ts:59-69` (server-side)
- `apps/web/src/lib/parser/ofx.ts:33-40` (web-side)

**Implementation:**

1. Add `escapeRegExp` helper near the top of both files (or in a shared utilities module if one exists):
   ```ts
   /** Escape regex metacharacters in a string for safe interpolation into RegExp. */
   function escapeRegExp(s: string): string {
     return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
   }
   ```

2. Update `extractTag` in both files to use escaped tag names:
   ```ts
   function extractTag(block: string, tagName: string): string {
     const safeTag = escapeRegExp(tagName);
     const xmlRe = new RegExp(`<${safeTag}[^>]*>\\s*([^<]+?)\\s*</${safeTag}>`, 'i');
     const xmlMatch = block.match(xmlRe);
     if (xmlMatch) return (xmlMatch[1] ?? '').trim();
     const sgmlRe = new RegExp(`<${safeTag}[^>]*>\\s*([^<\\n\\r]+)`, 'i');
     const sgmlMatch = block.match(sgmlRe);
     if (sgmlMatch) return (sgmlMatch[1] ?? '').trim();
     return '';
   }
   ```

**Verification:** Existing OFX tests pass. Add metacharacter defensive test per Task 8 (Plan 47).

**Commit:** `fix(parser): 🐛 escape regex metacharacters in OFX extractTag (C20-02)`

---

## Task 3: Fix misleading `isValidAmount` comment and align with server-side (C20-03)

**Finding:** C20-03 (LOW) — Comment says "accept negative amounts" but caller immediately skips them with `if (amount <= 0) continue;`. The server-side `isValidCSVAmount` explicitly rejects `amount <= 0`.

**File:** `apps/web/src/lib/parser/csv.ts:169-180`

**Implementation:**

1. Update `isValidAmount` to reject non-positive amounts and fix the comment:
   ```ts
   /** Validate that a parsed amount is usable for optimization.
    *  Returns false for null (unparseable) and for zero/negative amounts.
    *  Zero-amount rows are skipped (balance inquiries, declined transactions).
    *  Negative amounts (refunds/credits) are filtered here rather than passed
    *  through to the caller, matching the server-side isValidCSVAmount behavior.
    *  Acts as a TypeScript type guard: when it returns true, the amount is
    *  narrowed from `number | null` to `number`. */
   function isValidAmount(amount: number | null, amountRaw: string, lineIdx: number, errors: ParseError[]): amount is number {
     if (amount === null) {
       if (amountRaw.trim()) {
         errors.push(new ParseError(`금액을 해석할 수 없습니다: ${amountRaw}`, { line: lineIdx + 1 }));
       }
       return false;
     }
     if (amount <= 0) return false;
     return true;
   }
   ```

2. Remove the caller's `if (amount <= 0) continue;` since `isValidAmount` now handles it. Verify all call sites:
   - Generic CSV parser loop
   - Each bank adapter's amount handling

**Verification:** Existing CSV tests pass. The behavior is unchanged (negatives were already skipped), just the guard location changes.

**Commit:** `fix(parser): 🐛 align web isValidAmount with server-side and correct comment (C20-03)`

---

## Task 4: Guard HTML forward-fill against summary row amount propagation (C20-04 / C20-DB03)

**Finding:** C20-04 (LOW) — If a summary row appears before actual data rows, `lastAmount` gets set to the summary amount. Subsequent merged cells forward-fill that summary value. `isSummaryRow` on line 200 tests the raw cell value, not the row context.

**File:** `apps/web/src/lib/parser/html.ts:197-204`

**Implementation:**

1. Update the amount forward-fill fallback to guard against summary values:
   ```ts
   // Amount column forward-fill
   const rawAmountValue = amountCol !== -1 ? row[amountCol] : '';
   if (amountCol !== -1 && isNonEmpty(rawAmountValue)) {
     if (!isSummaryRow(String(rawAmountValue))) {
       lastAmount = rawAmountValue;
     }
   }
   const amountRaw = String(
     amountCol !== -1
       ? (isNonEmpty(rawAmountValue) && !isSummaryRow(String(rawAmountValue))
         ? rawAmountValue
         : lastAmount)
       : ''
   ).trim();
   ```

2. Verify the `isSummaryRow` check at line 200 already prevents summary cell values from updating `lastAmount`. The fix adds an additional guard in the fallback path so that even if `lastAmount` was somehow poisoned (e.g., from an earlier summary row before `isSummaryRow` was checked), the raw value path won't use it.

**Alternative deeper fix:** Reset `lastAmount` (and other last-values) when a summary row is encountered at the row level:
   ```ts
   if (isSummaryRow(rowText)) {
     // Don't let summary row values propagate to merged data cells
     lastDate = '';
     lastMerchant = '';
     lastCategory = '';
     lastInstallments = '';
     lastMemo = '';
     lastAmount = '';
     continue;
   }
   ```
   This is cleaner and addresses the root cause identified by tracer (Flow 2). Prefer this approach.

**Verification:** Add HTML test fixture with subtotal row after header per Task 9 (Plan 47).

**Commit:** `fix(parser): 🐛 reset forward-fill state when HTML summary rows are encountered (C20-04)`

---

## Task 5: Add parity comment to server-side OFX parser (C20-DOC02)

**Finding:** C20-DOC02 (LOW) — OFX parser comment doesn't explain WHY full-width normalization is NOT performed (unlike web-side which does). After Task 1 fixes this, the comment should note the parity.

**File:** `packages/parser/src/ofx/index.ts:104-107`

**Implementation:**

After Task 1 is complete, update the comment:
```ts
/** Parse an OFX amount string. OFX amounts use decimal format (e.g., "-15000.00").
 *  Korean Won amounts should be integers — round to nearest won.
 *  In OFX: negative amounts = charges/debits (money out), positive = credits.
 *  Returns the raw value (may be negative) so the caller can filter.
 *  NOTE: Now uses parseAmountString for parity with web-side (C20-01),
 *  handling full-width digits, Won signs, and 마이너스 prefix. */
```

**Commit:** `docs(parser): 📝 add parity comment to server-side OFX amount parser (C20-DOC02)`

---

## Task 6: Document analyzer cache strategy as adequate (C20-ARCH01)

**Finding:** C20-ARCH01 (MEDIUM) — Analyzer cache is not keyed by cardIds. Tracer confirmed the web app calling pattern (always unfiltered first, then filtered with same cardIds) means this is not a bug in practice.

**File:** `apps/web/src/lib/analyzer.ts:55-86`

**Implementation:**

Add a comment documenting the cache strategy and why unkeyed caching is acceptable:
```ts
// Cache for toCoreCardRuleSets — rules from static JSON don't change per session.
// The cache is keyed by existence only (not by cardIds) because:
// 1. getAllCardRules() returns a new array via flatMap on every call, making
//    reference comparisons always fail.
// 2. The web app always calls analyze() (unfiltered) first, then reoptimize()
//    with the same cardIds — no alternation between filtered/unfiltered.
// 3. Filtering AFTER cache retrieval is O(rules) which is negligible (< 500).
// If the calling pattern changes to alternate cardId sets, key by cardIds hash.
let cachedCoreRules: CoreCardRuleSet[] | null = null;
```

**Commit:** `docs(web): 📝 document analyzer cache strategy and cardIds filtering rationale (C20-ARCH01)`

---

## Deferred to Plan 47 or 00-deferred-items.md

| Finding | Severity | Reason |
|---------|----------|--------|
| C20-PERF01 | MEDIUM | Greedy marginal reward caching requires algorithmic redesign. Maps to existing D-09. |
| C20-ARCH02 | LOW | Parser duplication is structural debt requiring a dedicated refactoring cycle. Maps to existing D-01. |
| C20-SEC02 | LOW | HTML sanitization before SheetJS is defense-in-depth, not an active vulnerability. |
| C20-PERF02 | LOW | String allocation optimization is micro-optimization with negligible user impact. |
| C20-DOC01 | LOW | Extracting shared C1-01 comment requires docs/conventions.md creation. |
| C20-UI02 | LOW | Error message standardization is ongoing U-DES-02 effort. |

---

## Progress

- [x] Task 1: Unify server-side OFX amount parsing
- [x] Task 2: Add regex escape helper to OFX extractTag
- [x] Task 3: Fix isValidAmount comment and align rejection logic
- [x] Task 4: Guard HTML forward-fill against summary rows
- [x] Task 5: Add parity comment to OFX parser
- [x] Task 6: Document analyzer cache strategy
