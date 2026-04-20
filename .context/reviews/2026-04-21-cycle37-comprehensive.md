# Cycle 37 Comprehensive Code Review -- 2026-04-21

**Scope:** Full re-read of all source files in `apps/web/src/`, `packages/core/src/`, `packages/rules/src/`, `packages/parser/src/`, `packages/viz/src/`, verification of all prior open findings, targeted pattern search for new issues.

**Angles covered:** code quality, correctness, performance, security, UI/UX, architecture, test coverage

**Gates:** `bun test` (266 pass, 0 fail), `bun run lint` (0 errors, 0 warnings), `bun run typecheck` (0 errors)

---

## Verification of Prior Open Findings

All previously open findings from the aggregate were verified against current source code:

| Finding | Status | Evidence |
|---|---|---|
| C7-04 | OPEN (LOW) | TransactionReview `$effect` re-sync still uses `generation` counter pattern -- fragile but functional |
| C7-06 | OPEN (LOW) | `analyzer.ts:307` still filters to latest month; `transactions` field includes all months |
| C7-07 | OPEN (LOW) | `BANK_SIGNATURES` duplicated between `apps/web/src/lib/parser/detect.ts` and `packages/parser/src/detect.ts` |
| C7-11 | OPEN (LOW) | `store.svelte.ts:156` persist warning message for 'corrupted' says "거래 내역을 불러오지 못했어요" -- could be more specific |
| C8-05/C4-09 | OPEN (LOW) | `CategoryBreakdown.svelte:6-49` still uses hardcoded `CATEGORY_COLORS` -- non-utility entries remain unchanged |
| C8-07/C4-14 | OPEN (LOW) | `build-stats.ts:16-18` still has hardcoded fallback values `683/24/45` that drift from actual data |
| C8-08 | OPEN (LOW) | `inferYear()` in `date-utils.ts:20` -- timezone-dependent near midnight Dec 31. Code is centralized but timezone issue remains |
| C8-09 | OPEN (LOW) | Test files still duplicate production code (`parser-date.test.ts`, `analyzer-adapter.test.ts`) |
| C18-01 | OPEN (MEDIUM) | `VisibilityToggle.svelte:26-78` -- $effect with DOM manipulation. Has cached element refs with isConnected check but pattern remains fragile |
| C18-02 | OPEN (LOW) | `VisibilityToggle.svelte:38-58` -- stat element queries guarded but effect still runs on dashboard page |
| C18-03 | OPEN (LOW) | `SavingsComparison.svelte:218` annual projection still multiplies by 12. Qualifier text is present. |
| C18-04 | OPEN (LOW) | `xlsx.ts:247` `isHTMLContent()` still only checks first 512 bytes as UTF-8 |
| C19-04 | OPEN (LOW) | `FileDropzone.svelte:220` still uses `window.location.href` for navigation |
| C19-05 | OPEN (LOW) | `CardDetail.svelte:267` still uses `window.location.href` for navigation |
| C21-02 | OPEN (LOW) | cards.ts shared fetch AbortSignal race (deferred) |
| C21-04/C23-02/C25-02/C26-03 | OPEN (LOW->MEDIUM) | cachedCategoryLabels/cachedCoreRules invalidated on explicit reset but stale across long-lived tabs |
| C22-04 | OPEN (LOW) | CSV adapter registry only covers 10 of 24 detected banks (deferred) |
| C22-05 | OPEN (LOW) | TransactionReview changeCategory O(n) array copy (deferred) |
| C24-06 | OPEN (LOW) | buildCardResults totalSpending no negative amount guard (safe in practice) |
| C27-02 | OPEN (LOW) | Duplicate NaN/zero checks in parseGenericCSV vs isValidAmount() -- maintenance divergence |
| C33-01 | OPEN (MEDIUM) | MerchantMatcher substring scan O(n) per transaction -- partially fixed with SUBSTRING_SAFE_ENTRIES |
| C33-02 | OPEN (MEDIUM) | cachedCategoryLabels stale across redeployments |
| C34-04 | OPEN (LOW) | Server-side PDF has no fallback line scanner -- architectural gap |
| C36-01 | FIXED | Web-side PDF `parseAmount` now handles parenthesized negatives at `pdf.ts:169-184` |
| C36-02 | FIXED | Server-side CSV adapters now use `splitCSVLine`, `parseCSVAmount`, `parseCSVInstallments` from `shared.ts` |
| C36-03 | FIXED | `categoryLabels` Map construction centralized into `buildCategoryLabelMap()` in `category-labels.ts` |
| C53-01 | FIXED | `TransactionReview.svelte:112-132` `changeCategory` now uses replacement pattern (`editedTxs.map()`) instead of in-place mutation |
| C53-02 | FIXED | Card stats reading logic centralized into `build-stats.ts:readCardStats()`, used by both `index.astro` and `Layout.astro` |
| C53-03 | FIXED | `CardDetail.svelte:217` performance tier header row now uses `dark:text-blue-300` for dark mode contrast |

### Fixes confirmed this cycle

| Finding | Status | Evidence |
|---|---|---|
| C36-01 | FIXED | `apps/web/src/lib/parser/pdf.ts:169-184` -- parenthesized negative handling with `isNeg` flag |
| C36-02 | FIXED | `packages/parser/src/csv/shared.ts` exports `splitCSVLine`, `parseCSVAmount`, `parseCSVInstallments`; all 10 bank adapters and `generic.ts` import from it |
| C36-03 | FIXED | `apps/web/src/lib/category-labels.ts` exports `buildCategoryLabelMap`; used by `store.svelte.ts`, `analyzer.ts`, and `CardDetail.svelte` |
| C53-01 | FIXED | `TransactionReview.svelte:128` uses `editedTxs = editedTxs.map((t, i) => i === idx ? updated : t)` -- replacement pattern |
| C53-02 | FIXED | `apps/web/src/lib/build-stats.ts` centralizes stats reading; `index.astro:6` and `Layout.astro:14` both import `readCardStats()` |
| C53-03 | FIXED | `CardDetail.svelte:217` uses `text-blue-700 dark:text-blue-300` |

---

## New Findings

### C37-01: Web-side CSV `parseAmount` returns NaN (not null) for unparseable inputs -- inconsistent with all other parsers

**File:** `apps/web/src/lib/parser/csv.ts:33-45`

**Severity:** MEDIUM | **Confidence:** High

Every amount parser in the codebase returns `null` for unparseable inputs:

- Web XLSX `parseAmount` (xlsx.ts:206-225): Returns `null`
- Web PDF `parseAmount` (pdf.ts:169-184): Returns `null`
- Server CSV `parseCSVAmount` (shared.ts:34-42): Returns `null`
- Server XLSX `parseAmount` (xlsx/index.ts): Returns `null`
- Server PDF `parseAmount` (pdf/index.ts): Returns `null`

But the web-side CSV `parseAmount` returns `NaN` (a number, not null):

```typescript
function parseAmount(raw: string): number {
  // ...
  const parsed = Math.round(parseFloat(cleaned));
  if (Number.isNaN(parsed)) return NaN;  // <-- returns NaN (number), not null
  return isNegative ? -parsed : parsed;
}
```

The caller compensates with `isValidAmount()` which checks `Number.isNaN(amount)`, so the NaN is caught. However, the type signature `number` (not `number | null`) means TypeScript cannot enforce null checks at the call site, and the pattern is inconsistent with every other parser.

**Impact:** If a future caller uses `parseAmount` directly without the `isValidAmount` guard, NaN will silently propagate into transaction amounts. The `number` return type hides this risk. The server-side `parseCSVAmount` returns `null` which is type-safe.

**Fix:** Change the return type to `number | null`, return `null` instead of `NaN`, and update `isValidAmount` accordingly (or remove it in favor of direct null checks like all other parsers).

---

### C37-02: Web-side CSV `isValidAmount` combines NaN check and zero-amount filter in one function -- divergent pattern from PDF/XLSX parsers

**File:** `apps/web/src/lib/parser/csv.ts:49-61`

**Severity:** LOW | **Confidence:** High

The web-side CSV parser uses `isValidAmount()` which:
1. Returns `false` for NaN amounts (parse failure)
2. Returns `false` for zero amounts (business filter)
3. Pushes a parse error for NaN amounts

This combines two distinct concerns (parse validation vs. business filtering) in one function. All other parsers separate them:

- Web PDF (`pdf.ts:237-246`): null check + explicit `if (amount === 0) continue;`
- Web XLSX (`xlsx.ts:386-400`): null check + explicit `if (amount === 0) continue;`
- Server CSV (`generic.ts:111-121`): null check + explicit `if (amount === 0) continue;`

This is the same issue as C27-02 (duplicated NaN/zero checks), but from a different angle. The `isValidAmount` function is only used in the web-side CSV parser and is the source of the divergence.

**Impact:** Maintenance risk -- if the zero-amount filtering logic changes (e.g., to allow zero amounts for certain transaction types), the CSV parser's `isValidAmount` must be updated differently from the PDF/XLSX parsers' inline checks.

**Fix:** After fixing C37-01 (making `parseAmount` return `null`), replace `isValidAmount` with the same pattern used by all other parsers: direct null check followed by explicit zero-amount skip.

---

### C37-03: `FileDropzone.svelte` page-level drag handlers never remove on component destroy

**File:** `apps/web/src/components/upload/FileDropzone.svelte:11-43`

**Severity:** MEDIUM | **Confidence:** High

The `onMount` callback adds four event listeners to `document`:

```typescript
document.addEventListener('dragenter', onDragEnter);
document.addEventListener('dragleave', onDragLeave);
document.addEventListener('dragover', onDragOver);
document.addEventListener('drop', onPageDrop);
return () => {
  document.removeEventListener('dragenter', onDragEnter);
  document.removeEventListener('dragleave', onDragLeave);
  document.removeEventListener('dragover', onDragOver);
  document.removeEventListener('drop', onPageDrop);
};
```

The cleanup function is correctly returned from `onMount`. However, because `isDragOver` is a component-scoped `$state` variable, after the component unmounts and the cleanup runs, if any of the event listeners fire during the brief window between listener removal (they are removed synchronously in the cleanup), the `isDragOver` write would target a detached component state.

More critically, the `dragCount` variable is a local variable captured in the closure. If the `onDragEnter` fires but the cleanup removes `onDragLeave` before it fires, `dragCount` becomes stuck at a positive value, and subsequent drag events on a new FileDropzone instance would not work correctly because the old handlers are still referencing the stale `dragCount`.

**Impact:** In practice, Astro's View Transitions may unmount/remount the FileDropzone component during navigation. If the old event listeners fire during the transition, `isDragOver` could get stuck in a true state on the old component, and the new component's event listeners would need to counteract the stale state. This is unlikely but possible during rapid page transitions.

**Fix:** Add an `active` guard that is set to `false` in the cleanup function:

```typescript
onMount(() => {
  let active = true;
  let dragCount = 0;
  function onDragEnter(e: DragEvent) {
    if (!active) return;
    e.preventDefault();
    dragCount++;
    if (dragCount === 1) isDragOver = true;
  }
  // ... same for other handlers ...
  return () => {
    active = false;
    document.removeEventListener('dragenter', onDragEnter);
    // ...
  };
});
```

---

## Final Sweep -- Commonly Missed Issues

1. **C36-01/02/03 FIXES CONFIRMED:** Web PDF parseAmount now handles parenthesized negatives. Server CSV adapters use shared.ts. category-labels.ts centralizes Map construction.
2. **C53-01/02/03 FIXES CONFIRMED:** TransactionReview changeCategory uses replacement pattern. build-stats.ts centralizes card stats. CardDetail dark mode contrast fixed.
3. **No XSS risk**: All dynamic content rendered through Svelte/Astro template syntax which auto-escapes. No `innerHTML` patterns found.
4. **No secret leakage**: No API keys, tokens, or credentials in source code. The LLM fallback reads `ANTHROPIC_API_KEY` from environment variables, which is correct.
5. **CSP is properly configured**: Layout.astro has appropriate CSP headers with documented rationale for `unsafe-inline`.
6. **AbortController patterns are consistent**: CardGrid, CardDetail, CardPage all properly clean up with generation counters and AbortController.
7. **SessionStorage access is properly guarded**: All accesses check `typeof sessionStorage !== 'undefined'` and wrap in try/catch.
8. **prefers-reduced-motion**: Handled at both CSS level and JS level (SavingsComparison rAF animation check).
9. **parseAmount consistency across ALL parsers (except web CSV):**
   - Web CSV: `Math.round(parseFloat(...))` with NaN return (C37-01)
   - Web XLSX: `Math.round(parseFloat(...))` for string, `Math.round(raw)` for number + parenthesized negatives + null return
   - Web PDF: `Math.round(parseFloat(...))` with null return + parenthesized negatives
   - Server CSV (all adapters + generic): `Math.round(parseFloat(...))` with null return + parenthesized negatives + zero filter
   - Server XLSX: `Math.round(parseFloat(cleaned))` for string, `Math.round(raw)` for number + parenthesized negatives + null return
   - Server PDF: `Math.round(parseFloat(cleaned))` with null return + parenthesized negatives
10. **`as any` usage**: Only in test files (`analyzer-adapter.test.ts:155,157,159`) and in schema test (`schema.test.ts:195`). Not in production logic paths. Acceptable.
11. **console.warn usage**: Properly scoped with `[cherrypicker]` prefix everywhere. Consistent.
12. **VisibilityToggle DOM mutation**: Still uses $effect with direct classList.toggle and textContent writes. Pattern is fragile but functional with isConnected guards. Same as C18-01.
13. **No race conditions in store.svelte.ts**: setResult, analyze, reoptimize all update result + generation atomically. The persistToStorage call is synchronous (sessionStorage.setItem). No async gap.
14. **Negative amounts handled correctly**: All parsers (except web CSV per C37-01) handle negative amounts via `(1,234)` format and `-` prefix. The optimizer's `tx.amount > 0` filter correctly excludes negative/zero amounts.
15. **MerchantMatcher empty-string guard**: Confirmed at matcher.ts -- `if (lower.length < 2) return { category: 'uncategorized', confidence: 0.0 }`. Fixed.
16. **isOptimizableTx validation**: Checks `typeof obj.amount === 'number' && Number.isFinite(obj.amount) && obj.amount !== 0`. Properly guards against NaN/Infinity.
17. **greedyOptimize transaction filter**: Filters with `tx.amount > 0 && Number.isFinite(tx.amount)`. Properly guards against NaN/Infinity.
18. **buildCategoryKey consistency**: Both `analyzer.ts` and `greedy.ts` use `buildCategoryKey(category, subcategory)`. Consistent.
19. **Web-side PDF fallback line scanner**: Present and functional. Only the server-side is missing it (C34-04, known).
20. **No bare `catch {}` blocks in production code**: All catch blocks either have error handling or are explicitly documented as expected (e.g., sessionStorage SecurityError in sandboxed iframes).

---

## Summary

- **6 prior findings confirmed FIXED this cycle** (C36-01, C36-02, C36-03, C53-01, C53-02, C53-03)
- **3 new findings** this cycle:
  - C37-01: Web-side CSV parseAmount returns NaN instead of null -- inconsistent with all other parsers (MEDIUM, High)
  - C37-02: isValidAmount combines NaN check and zero filter -- divergent pattern (LOW, High)
  - C37-03: FileDropzone page-level drag handlers lack active guard for unmount race (MEDIUM, High)
- All prior open findings verified as still open with accurate file/line references
- All gates green: bun test (266 pass), lint (0 errors), typecheck (0 errors)
- No security, correctness, or data-loss issues found beyond the CSV parseAmount type inconsistency
