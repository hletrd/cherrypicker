# Cycle 36 Comprehensive Code Review -- 2026-04-22

**Scope:** Full re-read of all source files in `apps/web/src/`, `packages/core/src/`, `packages/rules/src/`, `packages/parser/src/`, `packages/viz/src/`, verification of all prior open findings, targeted pattern search for new issues.

---

## Verification of Prior Open Findings

All previously open findings from the aggregate were verified against current source code:

| Finding | Status | Evidence |
|---|---|---|
| C7-04 | OPEN (LOW) | TransactionReview `$effect` re-sync still uses `generation` counter pattern -- fragile but functional |
| C7-06 | OPEN (LOW) | `analyzer.ts:329` still filters to latest month; `transactions` field includes all months |
| C7-07 | OPEN (LOW) | `BANK_SIGNATURES` duplicated between `apps/web/src/lib/parser/detect.ts` and `packages/parser/src/detect.ts` |
| C7-11 | OPEN (LOW) | `store.svelte.ts:156` persist warning message for 'corrupted' says "거래 내역을 불러오지 못했어요" -- could be more specific about corruption vs. truncation |
| C8-05/C4-09 | OPEN (LOW) | `CategoryBreakdown.svelte:6-49` still uses hardcoded `CATEGORY_COLORS` -- utility colors fixed (C29-01), non-utility entries remain unchanged |
| C8-07/C4-14 | OPEN (LOW) | `build-stats.ts:16-18` still has hardcoded fallback values `683/24/45` that drift from actual data |
| C8-08 | OPEN (LOW) | `inferYear()` in `date-utils.ts:20` -- timezone-dependent near midnight Dec 31. Code is centralized but timezone issue remains |
| C8-09 | OPEN (LOW) | Test files still duplicate production code (`parser-date.test.ts`, `analyzer-adapter.test.ts`) |
| C18-01 | OPEN (MEDIUM) | `VisibilityToggle.svelte:26-78` -- $effect with DOM manipulation. Has cached element refs with isConnected check but pattern remains fragile |
| C18-02 | OPEN (LOW) | `VisibilityToggle.svelte:38-58` -- stat element queries guarded but effect still runs on dashboard page where stat elements don't exist |
| C18-03 | OPEN (LOW) | `SavingsComparison.svelte:218` annual projection still multiplies by 12. Qualifier text is present. |
| C18-04 | OPEN (LOW) | `xlsx.ts:247` `isHTMLContent()` still only checks first 512 bytes as UTF-8 |
| C19-04 | OPEN (LOW) | `FileDropzone.svelte:220` still uses `window.location.href` for navigation |
| C19-05 | OPEN (LOW) | `CardDetail.svelte:276` still uses `window.location.href` for navigation |
| C21-02 | OPEN (LOW) | cards.ts shared fetch AbortSignal race (deferred) |
| C21-04/C23-02/C25-02/C26-03 | OPEN (LOW->MEDIUM) | cachedCategoryLabels/cachedCoreRules invalidated on explicit reset but stale across long-lived tabs |
| C22-04 | OPEN (LOW) | CSV adapter registry only covers 10 of 24 detected banks (deferred) |
| C22-05 | OPEN (LOW) | TransactionReview changeCategory O(n) array copy (deferred) |
| C24-06 | OPEN (LOW) | buildCardResults totalSpending no negative amount guard (safe in practice) |
| C27-02 | OPEN (LOW) | Duplicate NaN/zero checks in parseGenericCSV vs isValidAmount() -- maintenance divergence |
| C33-01 | OPEN (MEDIUM) | MerchantMatcher substring scan O(n) per transaction -- partially fixed with SUBSTRING_SAFE_ENTRIES pre-computation |
| C33-02 | OPEN (MEDIUM) | cachedCategoryLabels stale across redeployments |
| C34-04 | OPEN (LOW) | Server-side PDF has no fallback line scanner -- architectural gap |
| C35-01 | FIXED | All 10 bank-specific CSV adapters now use `Math.round(parseFloat(...))`, return `null` for NaN, and handle parenthesized negatives |
| C35-02 | FIXED | All 10 bank-specific CSV adapters now filter zero-amount rows with `if (amount === 0) continue;` |
| C35-03 | FIXED | All 10 bank-specific CSV adapters now import `parseDateStringToISO` from shared `date-utils.ts` instead of having duplicated `parseDateToISO` |

### Fixes confirmed this cycle

| Finding | Status | Evidence |
|---|---|---|
| C35-01 | FIXED | All 10 adapters in `packages/parser/src/csv/` use `Math.round(parseFloat(cleaned))`, `null` for NaN, parenthesized negative handling |
| C35-02 | FIXED | All 10 adapters have `if (amount === 0) continue;` after parseAmount |
| C35-03 | FIXED | All 10 adapters import `parseDateStringToISO` from `../date-utils.js` |

---

## New Findings

### C36-01: Web-side PDF `parseAmount` does not handle parenthesized negative amounts -- parity bug with all other parsers

**File:** `apps/web/src/lib/parser/pdf.ts:169-179`

**Severity:** MEDIUM | **Confidence:** High

Every amount parser in the codebase handles parenthesized negatives like `(1,234)` to mean `-1234`:

- Web CSV `parseAmount` (csv.ts:33-45): Yes
- Web XLSX `parseAmount` (xlsx.ts:206-225): Yes
- Server CSV `parseAmount` (all 10 bank adapters): Yes
- Server CSV generic `parseAmount` (generic.ts:35-47): Yes
- Server XLSX `parseAmount` (xlsx/index.ts:47-67): Yes
- Server PDF `parseAmount` (pdf/index.ts:39-51): Yes

But the web-side PDF `parseAmount` does NOT:

```typescript
function parseAmount(raw: string): number | null {
  const cleaned = raw.replace(/원$/, '').replace(/,/g, '');
  if (!cleaned.trim()) return null;
  const n = Math.round(parseFloat(cleaned));
  if (Number.isNaN(n)) return null;
  return n;
}
```

For an input like `(1,234)`, `cleaned` becomes `(1234)`, and `parseFloat("(1234)")` returns `NaN`, so the function returns `null` -- the transaction is silently dropped.

**Impact:** Refund/cancellation transactions in PDF statements formatted with parenthesized amounts (common in Korean credit card statements) are silently lost on the web parser but correctly parsed as negative amounts by every other parser. The server-side PDF parser correctly handles this case.

**Fix:** Add parenthesized negative handling matching the pattern used by all other parsers:

```typescript
function parseAmount(raw: string): number | null {
  let cleaned = raw.replace(/원$/, '').replace(/,/g, '');
  const isNeg = cleaned.startsWith('(') && cleaned.endsWith(')');
  if (isNeg) cleaned = cleaned.slice(1, -1);
  if (!cleaned.trim()) return null;
  const n = Math.round(parseFloat(cleaned));
  if (Number.isNaN(n)) return null;
  return isNeg ? -n : n;
}
```

---

### C36-02: `splitLine` / `splitCSVLine` duplicated across 11 files in `packages/parser/src/csv/` -- DRY violation

**Files:**
- `packages/parser/src/csv/generic.ts:49-71` (named `splitCSVLine`)
- `packages/parser/src/csv/hyundai.ts:15-30` (named `splitLine`)
- `packages/parser/src/csv/kb.ts:15-30` (named `splitLine`)
- `packages/parser/src/csv/shinhan.ts:15-30` (named `splitLine`)
- `packages/parser/src/csv/woori.ts:15-30` (named `splitLine`)
- `packages/parser/src/csv/samsung.ts:15-30` (named `splitLine`)
- `packages/parser/src/csv/hana.ts:15-30` (named `splitLine`)
- `packages/parser/src/csv/nh.ts:15-30` (named `splitLine`)
- `packages/parser/src/csv/lotte.ts:15-30` (named `splitLine`)
- `packages/parser/src/csv/ibk.ts:15-30` (named `splitLine`)
- `packages/parser/src/csv/bc.ts:15-30` (named `splitLine`)

**Severity:** LOW | **Confidence:** High

The `splitLine` function (RFC 4180 compliant CSV line splitter) is copy-pasted identically across all 10 bank-specific adapters plus the generic parser (which calls it `splitCSVLine`). The logic is identical: non-comma delimiter uses simple `split()`, comma delimiter uses a character-by-character state machine handling quoted fields and doubled-quote escapes.

The same pattern exists in the web-side `csv.ts:8-23` with the same `splitLine` function.

If a bug is found in the RFC 4180 handling (e.g., edge case with trailing delimiters or escaped quotes at line boundaries), it must be fixed in all 12+ locations independently.

Similarly, `parseAmount` is duplicated across all 10 server-side bank adapters (C35-01 fix made them all consistent but did not centralize them).

**Impact:** Maintenance risk -- the 11 copies are currently identical but could diverge on future edits. Same class as C7-07 (BANK_SIGNATURES duplication) and C34-05 (inferYear duplication, now fixed).

**Fix:** Extract `splitLine` and `parseAmount` into a shared utility module (e.g., `packages/parser/src/csv/shared.ts`) and have all adapters import from it. The web-side `csv.ts` already shares `splitLine` inline but could import from a shared source too.

---

### C36-03: `categoryLabels` Map construction duplicated 3 times across `analyzer.ts` and `store.svelte.ts` -- maintenance divergence risk

**Files:**
- `apps/web/src/lib/store.svelte.ts:316-329` (inside `getCategoryLabels()`)
- `apps/web/src/lib/analyzer.ts:218-231` (inside `optimizeFromTransactions()`)
- `apps/web/src/lib/analyzer.ts:274-295` (inside `analyzeMultipleFiles()`)

**Severity:** LOW | **Confidence:** High

All three locations build an identical `Map<string, string>` from `CategoryNode[]`:

```typescript
const labels = new Map<string, string>();
for (const node of nodes) {
  labels.set(node.id, node.labelKo);
  if (node.subcategories) {
    for (const sub of node.subcategories) {
      labels.set(sub.id, sub.labelKo);
      labels.set(`${node.id}.${sub.id}`, sub.labelKo);
    }
  }
}
```

The same pattern also appears in `CardDetail.svelte:23-30` (building `categoryLabels` from `loadCategories()`).

If the Map construction logic changes (e.g., adding a new key format, changing the dot-notation convention), all 4 locations must be updated independently.

**Impact:** Low -- currently identical and functional. Risk is future divergence.

**Fix:** Extract to a shared function (e.g., `buildCategoryLabelMap(nodes: CategoryNode[]): Map<string, string>`) in a utility module and import everywhere.

---

## Final Sweep -- Commonly Missed Issues

1. **C35-01/02/03 FIXES CONFIRMED:** All 10 server-side bank adapters now use `Math.round(parseFloat(...))`, return `null` for NaN, handle parenthesized negatives, filter zero amounts, and import `parseDateStringToISO` from shared `date-utils.ts`.
2. **No XSS risk**: All dynamic content rendered through Svelte/Astro template syntax which auto-escapes. No `innerHTML` patterns found.
3. **No secret leakage**: No API keys, tokens, or credentials in source code. The LLM fallback reads `ANTHROPIC_API_KEY` from environment variables, which is correct.
4. **CSP is properly configured**: Layout.astro has appropriate CSP headers with documented rationale for `unsafe-inline`.
5. **AbortController patterns are consistent**: CardGrid, CardDetail, CardPage all properly clean up with generation counters and AbortController.
6. **SessionStorage access is properly guarded**: All accesses check `typeof sessionStorage !== 'undefined'` and wrap in try/catch. The C31-01 fix (console.warn in dismiss catch) is confirmed working.
7. **prefers-reduced-motion**: Handled at both CSS level (global rule in app.css) and JS level (SavingsComparison rAF animation check). Consistent.
8. **parseAmount consistency across ALL parsers:**
   - Web CSV: `Math.round(parseFloat(...))` with NaN -> NaN + isValidAmount()
   - Web XLSX: `Math.round(parseFloat(...))` for string, `Math.round(raw)` for number + parenthesized negatives
   - Web PDF: `Math.round(parseFloat(...))` with null for NaN -- **NO parenthesized negative handling (C36-01)**
   - Server CSV (all adapters): `Math.round(parseFloat(...))` with null for NaN + parenthesized negatives + zero filter
   - Server CSV (generic): `Math.round(parseFloat(...))` with null for NaN + parenthesized negatives + zero filter
   - Server XLSX: `Math.round(parseFloat(cleaned))` for string, `Math.round(raw)` for number + parenthesized negatives
   - Server PDF: `Math.round(parseFloat(cleaned))` with null for NaN + parenthesized negatives
9. **findDateCell consistency:** Both web PDF and server PDF have `isValidShortDate` for SHORT_MD_DATE_PATTERN. Parity is confirmed (C34-03 was fixed).
10. **`as any` usage**: Only in test files (`analyzer-adapter.test.ts:155,157,159`) and in schema test (`schema.test.ts:195`). Not in production logic paths. Acceptable.
11. **console.warn usage**: Properly scoped with `[cherrypicker]` prefix everywhere including the C31-01 fix. Consistent.
12. **VisibilityToggle DOM mutation**: Still uses $effect with direct classList.toggle and textContent writes. Pattern is fragile but functional with isConnected guards. Same as C18-01.
13. **No race conditions in store.svelte.ts**: setResult, analyze, reoptimize all update result + generation atomically. The persistToStorage call is synchronous (sessionStorage.setItem). No async gap where result could be stale.
14. **Negative amounts handled correctly**: All parsers (except web PDF per C36-01) handle negative amounts via `(1,234)` format and `-` prefix. The optimizer's `tx.amount > 0` filter correctly excludes negative/zero amounts from optimization.
15. **FileDropzone previousMonthSpending parsing**: Uses `Math.round(Number(v))` with `Number.isFinite(n) && n >= 0` guard. Safe against NaN and negative values.
16. **MerchantMatcher empty-string guard**: Confirmed at matcher.ts -- `if (lower.length < 2) return { category: 'uncategorized', confidence: 0.0 }`. The C10-13 finding is fixed.
17. **isOptimizableTx validation**: Checks `typeof obj.amount === 'number' && Number.isFinite(obj.amount) && obj.amount !== 0` -- properly guards against NaN/Infinity. No issue.
18. **greedyOptimize transaction filter**: Line 272 filters with `tx.amount > 0 && Number.isFinite(tx.amount)` -- properly guards against NaN/Infinity in the optimizer.
19. **buildCategoryKey consistency**: Both `analyzer.ts` and `greedy.ts` use `buildCategoryKey(category, subcategory)` which produces `category.subcategory` format. Consistent.
20. **Web-side PDF fallback line scanner**: Present and functional. Only the server-side is missing it (C34-04, known).

---

## Summary

- **3 prior findings confirmed FIXED this cycle** (C35-01, C35-02, C35-03 -- bank adapter parity fixes)
- **3 new findings** this cycle:
  - C36-01: Web-side PDF parseAmount missing parenthesized negative handling -- parity bug (MEDIUM, High)
  - C36-02: splitLine/parseAmount duplicated across 11+ CSV adapter files -- DRY violation (LOW, High)
  - C36-03: categoryLabels Map construction duplicated 3+ times -- maintenance risk (LOW, High)
- All prior open findings verified as still open with accurate file/line references
- No security, correctness, or data-loss issues found beyond the web-side PDF parity bug
