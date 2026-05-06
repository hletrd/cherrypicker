# Cycle 29 Architecture Review

## Findings

### HIGH-01: Web/server parser duplication is architectural debt
**Files:** `apps/web/src/lib/parser/*` vs `packages/parser/src/*`
**Confidence:** High

Every parser (CSV, XLSX, HTML, JSON, OFX, PDF) exists in two nearly-identical implementations:
- Web-side: `apps/web/src/lib/parser/` (runs in browser, Node 24)
- Server-side: `packages/parser/src/` (runs on Bun)

The duplication is acknowledged in code comments (C70-04: "Full dedup requires the D-01 architectural refactor") but has persisted across 29 review cycles.

The core issue is that the web app and server package use different module systems and runtime environments. However, both use TypeScript and could share pure-TS utility modules. The following could be shared TODAY without environment issues:
- `parseAmountString` / `parseAmount` logic
- Date parsing (`parseDateStringToISO`, validation)
- Column matching patterns and `findColumn`
- `normalizeHTML`
- JSON field aliases (DATE_ALIASES, MERCHANT_ALIASES, etc.)
- `isSummaryRow`, `isValidHeaderRow`

What genuinely differs:
- SheetJS import style (`import xlsx from 'xlsx'` vs `import * as XLSX from 'xlsx'`)
- Buffer vs ArrayBuffer usage
- File system access (`readFile` from `fs/promises` vs `File` API)

**Fix:** Create a `packages/parser-shared/` or `packages/parser/src/shared/` package containing pure-TS utilities that work in both environments. Import these from both web and server parsers.

---

### HIGH-02: analyzer.ts mixes data transformation with business logic
**File:** `apps/web/src/lib/analyzer.ts`
**Confidence:** High

`analyzer.ts` is 440 lines and handles:
1. Type adaptation (`toRulesCategoryNodes`, `toCoreCardRuleSets`)
2. Caching (`cachedCoreRules`)
3. Transaction categorization (`parseAndCategorize`)
4. Optimization (`optimizeFromTransactions`)
5. Multi-file analysis (`analyzeMultipleFiles`)
6. Date extraction (`getLatestMonth`)

The `toCoreCardRuleSets` function manually narrows types from web-side JSON to core package types. This suggests the web-side and core package types have diverged. The narrowing is done via Sets (`VALID_SOURCES`, `VALID_REWARD_TYPES`) with fallback defaults, which masks schema mismatches rather than surfacing them.

**Fix:** Align the web-side and core package schemas so manual narrowing is unnecessary. If they must differ, generate the adapter from the Zod schemas rather than hand-writing it.

---

### MEDIUM-01: Reward calculator has implicit coupling between rate-based and fixed-reward branches
**File:** `packages/core/src/calculator/reward.ts` (lines 259-278)
**Confidence:** Medium

```ts
if (normalizedRate !== null && normalizedRate > 0) {
  // Rate-based reward...
} else if (hasFixedReward) {
  // Fixed reward...
} else {
  // Neither rate nor fixed...
}
```

The comment at lines 261-263 says "When both rate and fixedAmount are present on the same tier, rate takes precedence." This is implicit behavior that could surprise card rule authors. If a YAML file accidentally specifies both `rate` and `fixedAmount`, only the rate is used with no warning.

**Fix:** Add a validation step when loading card rules that warns if both `rate` and `fixedAmount` are present on the same tier. Or explicitly document this precedence in the YAML schema.

---

### MEDIUM-02: `isHTMLContent` called twice on same data
**File:** `apps/web/src/lib/parser/xlsx.ts` (lines 327-353)
**Confidence:** Medium

The web-side XLSX parser:
1. Calls `isHTMLContent(buffer)` which decodes first 512 bytes
2. If HTML detected, decodes the FULL buffer again with `new TextDecoder().decode(buffer)`

The server-side XLSX parser does the same. The comment acknowledges this: "the 512-byte overlap is accepted as minor overhead bounded by the file size limit."

This is a minor inefficiency but could be significant for large files. The server-side uses `Buffer` (Node) while the web-side uses `ArrayBuffer` + `TextDecoder`.

**Fix:** Cache the decoded string from `isHTMLContent` and pass it to the caller, avoiding the second decode.

---

### LOW-01: `calculateRewards` mutates external `dayRewardTracker` Set
**File:** `packages/core/src/calculator/reward.ts` (line 155-156)
**Confidence:** Low

```ts
const dayKey = `${ruleKey}:${tx.date}`;
if (dayRewardTracker.has(dayKey)) return 0;
dayRewardTracker.add(dayKey);
```

The function mutates a Set passed from its caller. While this is documented behavior (the tracker tracks per-day rewards across transactions), it makes the function impure and harder to test. The Set is created in `calculateRewards` and passed to `calculateFixedReward`, so the mutation is bounded.

**Fix:** Document this side effect in the function signature comment, or have `calculateFixedReward` return both the reward and whether it should be tracked.

---

## Summary

| Finding | Severity | Confidence | File |
|---------|----------|------------|------|
| HIGH-01 Parser duplication | High | High | Multiple |
| HIGH-02 analyzer.ts mixing concerns | High | High | analyzer.ts |
| MEDIUM-01 Rate/fixed precedence implicit | Medium | Medium | reward.ts |
| MEDIUM-02 Double HTML decode | Medium | Medium | xlsx.ts |
| LOW-01 Mutable dayRewardTracker | Low | Low | reward.ts |
