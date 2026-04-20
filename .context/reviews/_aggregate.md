# Review Aggregate -- 2026-04-21 (Cycle 64)

**Source reviews (this cycle):**
- `.context/reviews/2026-04-21-cycle64-comprehensive.md` (full re-read of all source files, fix verification, cross-file interaction analysis)

**Prior cycle reviews (still relevant):**
- All cycle 1-63 per-agent and aggregate files

---

## Verification of Prior Cycle Fixes

All prior cycle 1-63 findings are confirmed fixed except as noted below.
New in cycle 64: C63-04, C63-07 confirmed **FIXED**.

| Finding | Status | Evidence |
|---|---|---|
| C63-04 | **FIXED** | `date-utils.ts:12-20` adds `daysInMonth()` and `isValidDayForMonth()`. All branches now call `isValidDayForMonth(year, month, day)`. Feb 31 correctly rejected. |
| C63-07 | **FIXED** | `parser/index.ts:29-38` iterates ALL encodings and picks fewest replacement chars. No early break. |
| C62-09 | **FIXED** | `cards.ts:158-168` builds `cardIndex` Map; `getCardById` uses `cardIndex.get()` O(1) lookup |
| C61-02 | **FIXED** | `CardPage.svelte:70-74` uses `<button type="button">` instead of `<a href="#">` |
| C62-15 | **FIXED** | `FileDropzone.svelte:241-246` and `CardDetail.svelte:275-280` both use Astro `navigate()` |
| C49-01 | **FIXED** | `isSubstringSafeKeyword` function no longer exists in codebase |
| C62-11 | PARTIALLY FIXED | `store.svelte.ts:154-165` now logs non-quota errors but still returns `{ kind: 'corrupted' }` for ALL non-quota errors |
| C56-04 | OPEN (LOW) | `date-utils.ts:112` still returns raw input for unparseable dates |
| C56-05 | OPEN (LOW) | Zero savings shows "0원" without plus sign |
| C33-01/C62-01 | OPEN (MEDIUM) | MerchantMatcher/taxonomy substring scan O(n) per transaction |
| C33-02/C62-04 | OPEN (MEDIUM) | cachedCategoryLabels stale across redeployments |
| C21-04/C62-04 | OPEN (MEDIUM) | cachedCategoryLabels invalidated only on explicit reset |

---

## New Findings (This Cycle)

| ID | Severity | Confidence | File | Description |
|---|---|---|---|---|
| C64-01 | MEDIUM | HIGH | `apps/web/__tests__/parser-date.test.ts:27-98` | Test file duplicates PRE-C63-04 date parsing logic (uses `day >= 1 && day <= 31` instead of `isValidDayForMonth`). The C63-04 fix (`daysInMonth`/`isValidDayForMonth`) has zero test coverage. Feb 31 passes test validation but is rejected by production code. Test-code/production-code divergence makes the fix effectively untested. |
| C64-02 | LOW | HIGH | `apps/web/src/lib/parser/index.ts:20` | EUC-KR in encoding candidate list is redundant because CP949 is a strict superset. EUC-KR can never win the "fewest replacement chars" heuristic against CP949, adding an unnecessary TextDecoder decode + regex scan per CSV parse. |
| C64-03 | LOW | MEDIUM | `packages/core/src/optimizer/greedy.ts:7-82` | `CATEGORY_NAMES_KO` hardcoded 75-entry map duplicates labels also in the YAML taxonomy. Can silently drift from YAML data on taxonomy updates. Converges with C8-07/C8-08 fallback drift pattern. |

---

## Cross-Agent Agreement (Multi-Cycle Convergence)

The following findings have been flagged by multiple cycles, indicating high signal:

| Finding | Flagged by Cycles | Current Status |
|---|---|---|
| VisibilityToggle DOM mutation | C18, C50 | OPEN (LOW) -- 2 cycles agree |
| MerchantMatcher/taxonomy O(n) scan | C16, C33, C50, C62, C63, C64 | OPEN (MEDIUM) -- 6 cycles agree |
| cachedCategoryLabels/coreRules staleness | C21, C23, C25, C26, C33, C62, C63, C64 | OPEN (MEDIUM) -- 8 cycles agree |
| CategoryBreakdown dark mode contrast | C4, C8, C59, C62 | OPEN (LOW) -- 4 cycles agree |
| Annual savings simple *12 projection | C7, C18, C62, C63, C64 | OPEN (LOW) -- 5 cycles agree |
| Full-page reload navigation | C19, C60, C62 | **FIXED** (C63 confirmed) |
| date-utils unparseable passthrough | C56, C62, C63, C64 | OPEN (LOW) -- 4 cycles agree |
| CSV DATE_PATTERNS divergence risk | C20, C25, C62, C64 | OPEN (LOW) -- 4 cycles agree |
| Print stylesheet dark-mode fix | C60, C61 | **FIXED** (C62 confirmed) |
| CardGrid reactive dependency cycle | C60 | **FIXED** (C61 confirmed) |
| CardDetail category labels flash | C61 | **FIXED** (C62 confirmed) |
| TransactionReview stale editedTxs on reset | C61 | **FIXED** (C62 confirmed) |
| SavingsComparison zero-prefix inconsistency | C57, C58 | **FIXED** |
| getCardById O(n) | C3, C50, C56, C62 | **FIXED** (C63 confirmed) |
| Breadcrumb `<a>` to `<button>` | C61, C62 | **FIXED** (C63 confirmed) |
| persistToStorage bare catch | C62, C63, C64 | OPEN (LOW) -- 3 cycles agree |
| Hardcoded fallback drift (CATEGORY_NAMES_KO / build-stats) | C8, C64 | OPEN (LOW) -- 2 cycles agree |

---

## Still-Open Deferred Findings (carried forward, not new)

| Finding | Severity | Note |
|---|---|---|
| C4-06/C52-03/C9-02/D-40/D-82/C9R-04/C18-03/C39-06 | LOW | Annual savings projection label unchanged / visual inconsistency |
| C4-10 | MEDIUM | E2E test stale dist/ dependency |
| C4-11 | MEDIUM | No regression test for findCategory fuzzy match |
| C4-13/C9-08/D-43/D-74 | LOW | Small-percentage bars nearly invisible |
| C7-04 | LOW | TransactionReview $effect re-sync fragile |
| C7-06 | LOW | analyzeMultipleFiles returns all-month transactions but optimizes only latest month |
| C7-07 | LOW | BANK_SIGNATURES duplicated between packages/parser and apps/web |
| C7-11 | LOW | persistWarning message misleading for data corruption vs size truncation |
| C8-05/C4-09 | LOW | CategoryBreakdown CATEGORY_COLORS poor dark mode contrast |
| C8-07/C4-14 | LOW | build-stats.ts fallback values will drift |
| C8-08 | LOW | inferYear() timezone-dependent near midnight Dec 31 |
| C8-09 | LOW | Test duplicates production code instead of testing it directly |
| C18-01/C50-08 | LOW | VisibilityToggle $effect directly mutates DOM |
| C18-02 | LOW | Results page stat elements queried every effect run even on dashboard page |
| C18-04 | LOW | xlsx.ts isHTMLContent only checks UTF-8 decoding of first 512 bytes |
| C19-04 | LOW | FileDropzone navigation uses full page reload |
| C19-05 | LOW | CardDetail navigation uses full page reload |
| C20-02/C25-03 | LOW | csv.ts DATE_PATTERNS/AMOUNT_PATTERNS divergence risk with date-utils.ts |
| C20-04/C25-10 | LOW | pdf.ts module-level regex constants divergence risk with date-utils.ts |
| C21-02 | LOW | cards.ts shared fetch AbortSignal race |
| C22-04 | LOW | CSV adapter registry only covers 10 of 24 detected banks |
| C33-01 | MEDIUM | MerchantMatcher substring scan O(n) per transaction -- partially fixed |
| C33-02 | MEDIUM | cachedCategoryLabels stale across redeployments |
| C34-04 | LOW | Server-side PDF has no fallback line scanner |
| C41-05/C42-04 | LOW | cards.ts loadCategories returns empty array on AbortError |
| C56-04 | LOW | date-utils.ts returns raw input for unparseable dates without error reporting |
| C56-05 | LOW | Zero savings shows "0원" without plus sign |
| C61-02 | -- | **FIXED** -- breadcrumb now uses `<button>` |
| C62-11 | LOW | persistToStorage returns 'corrupted' for non-quota errors |
| C64-01 | MEDIUM | Test file duplicates pre-C63-04 date parsing logic; C63-04 fix has zero test coverage |
| C64-02 | LOW | EUC-KR encoding candidate redundant vs CP949 |
| C64-03 | LOW | CATEGORY_NAMES_KO hardcoded map can drift from YAML taxonomy |

---

## Agent Failures

No agent failures. Single comprehensive review completed successfully.
