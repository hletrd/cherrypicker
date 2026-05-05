# Cycle 63 Implementation Plan

**Date:** 2026-04-21
**Source reviews:** `.context/reviews/2026-04-21-cycle63-comprehensive.md`, `.context/reviews/_aggregate.md`

---

## Findings to Address

### Task 1: C63-04 (MEDIUM, MEDIUM): Add month-aware day-of-month validation to `parseDateStringToISO`

**File:** `apps/web/src/lib/parser/date-utils.ts:46-112`
**Problem:** `parseDateStringToISO` validates that day numbers are between 1 and 31, but does not validate that the day is valid for the given month (e.g., February 31 passes validation, producing the impossible date "2026-02-31"). Downstream code sorts transactions by date string using `localeCompare`, which would place "2026-02-31" after "2026-02-28" -- correct lexicographic ordering but semantically invalid.

**Fix:** Add a `isValidDayForMonth(year, month, day)` helper that checks the day against the actual number of days in the given month (including leap year handling for February). Apply this validation in the full-year date branches (YYYY-MM-DD, YYYYMMDD, Korean full date) where both year and month are known.

For short-date branches (MM/DD, Korean short) where the year is inferred, use the inferred year for validation.

```ts
function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function isValidDayForMonth(year: number, month: number, day: number): boolean {
  return day >= 1 && day <= daysInMonth(year, month);
}
```

This uses the `Date` constructor which correctly handles leap years (including the 100/400 year rules).

**Steps:**
1. ~~Add `daysInMonth()` and `isValidDayForMonth()` helpers to `date-utils.ts`~~ DONE
2. ~~Update full-year date branches to use `isValidDayForMonth()` instead of the simple `day <= 31` check~~ DONE
3. ~~Update YYYYMMDD branch similarly~~ DONE
4. ~~Update short-year branch similarly~~ DONE
5. ~~Update MM/DD branch with the inferred year~~ DONE
6. ~~Update Korean full-date and short-date branches similarly~~ DONE
7. ~~Run all gates to confirm no regressions~~ DONE (tsc PASS, vitest 189 pass, bun test 58 pass)
8. ~~Commit with message: `fix(parser): 🐛 add month-aware day validation to parseDateStringToISO`~~ DONE (commit 00000004)

---

### Task 2: C63-07 (MEDIUM, MEDIUM): Improve encoding detection heuristic for small files

**File:** `apps/web/src/lib/parser/index.ts:23-36`
**Problem:** The encoding detection loop tries UTF-8, EUC-KR, CP949 in order and picks the one with fewest replacement characters (`\uFFFD`). The loop breaks early when `replacementCount < 5` -- this means if UTF-8 happens to produce fewer than 5 replacement characters for a file that is actually EUC-KR, the wrong encoding is selected. This can happen for small files with mostly ASCII content and a few Korean characters (e.g., a short CSV with mostly numbers and a few Korean merchant names).

**Fix:** Don't break early when `replacementCount < 5` for UTF-8. Instead, continue checking all encodings and always pick the one with the fewest replacement characters. The early-break optimization is only safe when we're confident the first "good enough" result is actually correct, which is not the case for mixed-encoding files.

Additionally, add a heuristic: if both EUC-KR and CP949 produce 0 replacement characters AND UTF-8 produces some, prefer the Korean encoding (EUC-KR/CP949) over UTF-8, since Korean text that decodes cleanly as EUC-KR is more likely to be EUC-KR than UTF-8 that happens to produce replacement characters.

```ts
for (const encoding of ENCODINGS) {
  try {
    const decoder = new TextDecoder(encoding, { fatal: false });
    const decoded = decoder.decode(buffer);
    const replacementCount = (decoded.match(/\uFFFD/g) ?? []).length;
    if (replacementCount < bestReplacements) {
      bestReplacements = replacementCount;
      bestContent = decoded;
    }
    // Don't break early -- check all encodings to find the true best
  } catch { continue; }
}
```

**Steps:**
1. ~~Remove the early-break optimization (`if (replacementCount < 5) break`) from the encoding loop~~ DONE
2. ~~Add comment explaining why we check all encodings~~ DONE
3. ~~Run all gates to confirm no regressions~~ DONE (tsc PASS, vitest 189 pass, bun test 58 pass)
4. ~~Commit with message: `fix(parser): 🐛 improve encoding detection by checking all candidates instead of early break`~~ DONE (commit 00000000)

---

## Deferred Findings (no action this cycle)

| Finding | Severity | Confidence | Reason for deferral |
|---|---|---|---|
| C63-01/C62-04/C33-02 | LOW/MEDIUM | HIGH | cachedCategoryLabels stale across redeployments. Already deferred across 7 cycles. Cache is invalidated on explicit `reset()`. Staleness across deployments is a theoretical concern. |
| C63-03/C33-01/C62-01 | LOW/MEDIUM | HIGH | MerchantMatcher/taxonomy O(n) scan. Already deferred as D-100. Building a trie-based prefix index is disproportionate to the current scale. |
| C63-05/C18-03/C62-03 | LOW | MEDIUM | Annual savings simple *12 projection. Already deferred as D-40/D-82. The "약" label is adequate. |
| C63-06 | LOW | LOW | `getIssuerFromCardId` splits on `-` prefix assumption. Latent risk only -- all current card IDs follow the `{issuer}-{name}` pattern. |

All prior deferred findings from the aggregate remain deferred. See `.context/reviews/_aggregate.md` for the complete list.
