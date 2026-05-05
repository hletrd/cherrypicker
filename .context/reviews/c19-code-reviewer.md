# Code Review — cherrypicker (Cycle 19)

**Reviewer:** code-reviewer
**Scope:** Code quality, logic correctness, maintainability, type safety
**Date:** 2026-05-06

---

## Summary

Cycle 18 successfully fixed all its findings: callback `any` types in `store.svelte.ts`, vacuous parse-error tests, web-side ParseError class tests, and HTML report `esc()` backslash removal. Cycle 19 review surfaces three new findings: a spending calculation inconsistency between initial analysis and reoptimize, an unsafe type cast, and a potential HTML entity bypass in the report generator.

---

## New Findings

### C19-CR01 [MEDIUM] — Inconsistent monthly spending calculation between analyze and reoptimize

**File:** `apps/web/src/lib/analyzer.ts:330` vs `apps/web/src/lib/store.svelte.ts:508`
**Confidence:** High

`analyzeMultipleFiles` accumulates monthly spending with `tx.amount > 0` (gross spending, excluding refunds):
```ts
// analyzer.ts:330
if (tx.amount > 0) {
  monthlySpending.set(month, (monthlySpending.get(month) ?? 0) + tx.amount);
}
```

But `reoptimize` accumulates with `tx.amount !== 0` (net spending, including refunds):
```ts
// store.svelte.ts:508
if (tx.amount !== 0) {
  monthlySpending.set(month, (monthlySpending.get(month) ?? 0) + tx.amount);
}
```

Both comments cite C1-01 but claim opposite conventions. The reoptimize path counts refunds (negative amounts) as reducing monthly spending, while the initial analysis ignores them entirely. This means editing transactions and reoptimizing can produce different `monthlyBreakdown` values than the initial analysis for the same data.

**Fix:** Standardize on one convention. Given Korean card issuers define 전월실적 as gross spending, change reoptimize to use `tx.amount > 0` to match analyzeMultipleFiles.

---

### C19-CR02 [MEDIUM] — Unsafe cast from `string` to `BankId` in analyze options

**File:** `apps/web/src/lib/analyzer.ts:103`
**Confidence:** High

```ts
const parseResult = await parseFile(file, options?.bank as BankId | undefined);
```

`AnalyzeOptions.bank` is typed as `string`, not `BankId`. This cast bypasses TypeScript's structural checking and allows any arbitrary string (e.g., a typo like "hyndai") to be passed to `parseFile`, which then forwards it to bank-specific CSV adapters that may not handle unknown bank IDs gracefully.

**Fix:** Add runtime validation: check `options?.bank` against a `Set<BankId>` or the `VALID_BANKS` array before casting, and throw/ignore if invalid.

---

### C19-CR03 [LOW] — Double-encoded HTML entity bypass in `esc()`

**File:** `packages/viz/src/report/generator.ts:31-42`
**Confidence:** Medium

The `esc()` function replaces `&` with `&amp;` before other replacements. If input already contains entity-encoded text like `&#x3C;script&#x3E;`, the output becomes `&amp;#x3C;script&amp;#x3E;`. Browsers decode `&amp;` → `&`, then `#x3C;` → `<`, producing executable HTML. While current data paths (card names from static JSON, categories from taxonomy) are trusted, this is a latent XSS vector if user-influenced data ever reaches `esc()`.

**Fix:** Add a pre-pass to decode existing HTML entities before escaping, or use a proper HTML sanitization library like `he` for encoding.

---

## Carry-overs from Previous Cycles

- **A-ARCH-03** — CardRuleSet inline definition in web app (HIGH)
- **C-CR-01** — Non-KRW transactions silently dropped (MEDIUM)
- **S-SEC-05** — Regex denial of service in column patterns (MEDIUM)

---

## Verdict

**FIX AND SHIP** — The spending calculation inconsistency (C19-CR01) is the highest priority as it produces divergent results between initial analysis and reoptimize.
