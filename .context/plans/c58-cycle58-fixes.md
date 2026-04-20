# Cycle 58 Implementation Plan

**Date:** 2026-04-21
**Source reviews:** `.context/reviews/2026-04-21-cycle58-comprehensive.md`, `.context/reviews/_aggregate.md`

---

## Findings to Address

### C58-01 (MEDIUM, HIGH): `VisibilityToggle.svelte` savings sign prefix uses `>= 0` instead of `> 0`, showing "+0원" for zero savings

**File:** `apps/web/src/components/ui/VisibilityToggle.svelte:92`
**Problem:** Line 92 computes `(opt.savingsVsSingleCard >= 0 ? '+' : '') + formatWon(opt.savingsVsSingleCard)`. When savings are exactly 0, `0 >= 0` is true, so the prefix is '+' and the display is "+0원". This is inconsistent with:
- `ReportContent.svelte:48` which was fixed in C57-02 to use `> 0`
- `SavingsComparison.svelte:217` which was fixed in C56-01 to use `> 0`

The VisibilityToggle stat element on the results page is the only remaining place that shows "+0원" for zero savings.

**Fix:** Change `>= 0` to `> 0` on line 92 so zero savings show "0원" without the plus sign, matching all other components:
```ts
// Line 92: change from:
(opt.savingsVsSingleCard >= 0 ? '+' : '')
// to:
(opt.savingsVsSingleCard > 0 ? '+' : '')
```

**Steps:**
1. Update line 92 in `VisibilityToggle.svelte` to use `> 0` instead of `>= 0`
2. Run all gates to confirm no regressions
3. Commit with message: `fix(web): 🐛 fix VisibilityToggle showing +0원 for zero savings on results page`

**Status:** COMPLETED -- commit 0000000be3b344ee3edb9c0fb2b7d049d7129983

---

### C58-07 (LOW, MEDIUM): No test coverage for web-side parser encoding detection fallback path

**File:** `apps/web/src/lib/parser/index.ts:17-47`
**Problem:** The CSV parsing path tries multiple encodings (utf-8, euc-kr, cp949) and selects the one with the fewest replacement characters. The encoding detection logic and the fallback warning threshold (line 42: `bestReplacements > 50`) are not covered by any test. A change to the threshold values could break silently.

**Fix:** Add a test case that verifies encoding detection works correctly for EUC-KR content:
1. Create a test in `apps/web/__tests__/parser-encoding.test.ts`
2. Test that UTF-8 content is decoded correctly (baseline)
3. Test that an EUC-KR encoded CSV is detected and decoded with fewer replacement characters than UTF-8 decoding
4. Test the warning threshold logic

**Steps:**
1. Create `apps/web/__tests__/parser-encoding.test.ts` with encoding detection tests
2. Run vitest to verify the new tests pass
3. Commit with message: `test(web): 🧪 add encoding detection tests for web-side CSV parser`

**Status:** COMPLETED -- commit 0000000f4d150d6b3b0c9cc5110b8d3d70e0079a

---

## Deferred Findings (no action this cycle)

| Finding | Severity | Confidence | Reason for deferral |
|---|---|---|---|
| C56-04 | LOW | MEDIUM | Enhancement, not bug -- current behavior is safe; unparseable dates pass through raw |
| C56-05 | LOW | HIGH | Extremely rare edge case; visual inconsistency is negligible |
| C58-03 (C19-04/C19-05) | LOW | HIGH | Full page reload navigation -- already deferred across multiple cycles |
| C58-04 (C56-04) | LOW | HIGH | Same as C56-04 above |
| C58-05 (C57-01) | N/A | HIGH | Already fixed -- Math.abs removed, sign semantics now consistent |
| C58-06 (C8-07) | LOW | HIGH | Hardcoded fallback values -- already deferred across multiple cycles |

All prior deferred findings from the aggregate remain deferred. See `.context/reviews/_aggregate.md` for the complete list.

---

## Verification Plan

After implementing fixes:
1. Run `npx tsc --noEmit` in apps/web -- expect 0 errors
2. Run `npx vitest run` -- expect all pass
3. Run `bun test` in packages/parser -- expect all pass
