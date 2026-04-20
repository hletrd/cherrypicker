# Comprehensive Code Review -- Cycle 58

**Reviewer:** Full codebase review (cycle 58 of 100)
**Scope:** Full repository -- all packages, apps, and shared code
**Angles covered:** code quality, correctness, performance, security, UI/UX, architecture, test coverage
**Gates:** eslint (no config -- N/A), tsc --noEmit (to verify), vitest (to verify), bun test (to verify)

---

## Methodology

Read every source file in the repository (40+ source files across packages/core, packages/parser, packages/rules, packages/viz, tools/cli, tools/scraper, apps/web). Cross-referenced with prior cycle 1-57 reviews and the aggregate. Ran targeted pattern searches for: innerHTML/XSS vectors (none found), bare `catch {}` blocks (none found), `any` type usage (2 occurrences in store.svelte.ts validated parsing paths, already flagged D-107), `window.location` full-page navigation (3 occurrences, 2 already deferred). Focused on finding genuinely NEW issues not previously reported.

---

## Verification of Prior Cycle Fixes

All prior cycle 1-57 findings are confirmed fixed except as noted in the aggregate's OPEN items.

---

## New Findings

### C58-01: ReportContent savings prefix uses `> 0` but VisibilityToggle stat element uses `>= 0` -- inconsistent zero handling across report page

- **Severity:** MEDIUM
- **Confidence:** HIGH
- **File:** `apps/web/src/components/report/ReportContent.svelte:48` vs `apps/web/src/components/ui/VisibilityToggle.svelte:92`
- **Description:** ReportContent line 48 computes `(opt.savingsVsSingleCard > 0 ? '+' : '') + formatWon(opt.savingsVsSingleCard)`. This correctly suppresses the '+' sign at zero (matching the C56-01 fix for SavingsComparison). However, VisibilityToggle line 92 computes `(opt.savingsVsSingleCard >= 0 ? '+' : '') + formatWon(opt.savingsVsSingleCard)`. The VisibilityToggle uses `>= 0` instead of `> 0`, producing "+0원" for zero savings on the results page stat element. This creates an inconsistency: the report table shows "0원" while the results page summary stat shows "+0원".
- **Failure scenario:** User gets exactly zero savings. Report page table row shows "0원". Results page top stat card shows "+0원". The two displays of the same value are inconsistent.
- **Fix:** Change VisibilityToggle line 92 from `>= 0` to `> 0` to match ReportContent and SavingsComparison.

### C58-02: VisibilityToggle stat savings sign uses `>= 0` check -- same issue as C58-01 but on the results page header

- **Severity:** LOW
- **Confidence:** HIGH
- **File:** `apps/web/src/components/ui/VisibilityToggle.svelte:92`
- **Description:** Line 92 uses `opt.savingsVsSingleCard >= 0 ? '+' : ''` which adds a '+' prefix for zero savings, inconsistent with both the dashboard (SavingsComparison.svelte fixed in C56-01) and the report page (ReportContent.svelte line 48 which uses `> 0`). This is the same root cause as C58-01 but filed separately because it affects a different page (results page) and a different component.
- **Failure scenario:** Same as C58-01.
- **Fix:** Same as C58-01.

### C58-03: CardDetail "카드 목록으로 돌아가기" uses window.location.href for navigation

- **Severity:** LOW
- **Confidence:** HIGH
- **File:** `apps/web/src/components/cards/CardDetail.svelte:267`
- **Description:** Line 267 uses `window.location.href = buildPageUrl('cards')` to navigate back to the card list. This causes a full page reload, losing the Astro View Transition animation and the Svelte component state (including any search/filter the user had applied). The same pattern exists in FileDropzone.svelte:238. This is already tracked as C19-05 in the deferred items but is called out again because CardDetail's navigation is particularly disruptive -- the user may have been browsing cards, selected one, and now wants to go back but loses their place.
- **Status:** Already deferred (C19-05).

### C58-04: parseDateStringToISO returns raw input for unparseable dates without error reporting

- **Severity:** LOW
- **Confidence:** HIGH
- **File:** `apps/web/src/lib/parser/date-utils.ts:112`
- **Description:** Line 112 returns `cleaned` (the raw input) when no date format matches. This means a corrupted date like "ABC" would be returned as "ABC" and silently passed through to the transaction record. Downstream code (analyzer.ts, store.svelte.ts) assumes dates are in ISO format (YYYY-MM-DD) and uses `tx.date.startsWith(latestMonth)` and `tx.date.slice(0, 7)` which would produce incorrect results for non-ISO date strings. This is already tracked as C56-04.
- **Status:** Already deferred (C56-04).

### C58-05: SavingsComparison displayedAnnualSavings uses target * 12 for negative values

- **Severity:** MEDIUM
- **Confidence:** HIGH
- **File:** `apps/web/src/components/dashboard/SavingsComparison.svelte:55,60`
- **Description:** This is the same finding as C57-01, confirmed still present. When `target` is negative (cherry-picking is suboptimal), lines 55 and 60 compute `displayedAnnualSavings = target * 12` and `annualTarget = target * 12`. For a negative target (e.g., -50000), `target * 12 = -600000`. The template at line 219 shows `formatWon(displayedAnnualSavings)` which would render "-600,000원" with the label "추가 비용". The `formatWon` function correctly handles negative numbers. However, the annual projection for negative savings shows a MINUS sign through formatWon, while the monthly display on line 217 uses `displayedSavings > 0 && Math.abs(displayedSavings) >= 1 ? '+' : ''` prefix logic. For negative monthly savings, the prefix is empty and formatWon renders the minus sign. For the annual line, formatWon also renders the minus sign. The sign semantics are now CONSISTENT between monthly and annual because the C57-01 Math.abs issue was already addressed -- lines 55 and 60 now use `target * 12` (not `Math.abs(target) * 12`). The remaining inconsistency is purely visual: the annual label says "추가 비용" (additional cost) while the number has a minus sign, making it read like "-600,000원 추가 비용" which could be interpreted as a double-negative. This is a UX consideration rather than a bug.
- **Status:** Confirmed -- C57-01 fix (removing Math.abs) was correctly applied. The remaining sign semantics are consistent but the display could be clearer for negative values.

### C58-06: build-stats.ts fallback values are hardcoded and will drift from actual data

- **Severity:** LOW
- **Confidence:** HIGH
- **File:** `apps/web/src/lib/build-stats.ts:16-18`
- **Description:** The fallback values `totalCards = 683`, `totalIssuers = 24`, `totalCategories = 45` are hardcoded. If cards.json is unavailable at build time, the layout and index page will show these numbers, which will become stale as new cards are added. This is already tracked as C8-08/C8-07.
- **Status:** Already deferred (C8-07/C8-08).

### C58-07: No test coverage for the web-side parser encoding detection fallback path

- **Severity:** LOW
- **Confidence:** MEDIUM
- **File:** `apps/web/src/lib/parser/index.ts:17-47`
- **Description:** The CSV parsing path (lines 17-47) tries multiple encodings (utf-8, euc-kr, cp949) and selects the one with the fewest replacement characters. The encoding detection logic and the fallback warning (line 42-46: `bestReplacements > 50`) are not covered by any test. The existing test file `apps/web/__tests__/parser-date.test.ts` only tests date parsing. A test for EUC-KR encoded CSV content would verify the encoding detection works correctly and that the warning threshold is appropriate.
- **Failure scenario:** A change to the encoding detection logic (e.g., adjusting the threshold from 5 to 50 on line 33, or from 50 on line 42) could break silently without test coverage.
- **Fix:** Add a test case that provides an EUC-KR encoded CSV buffer and verifies the content is decoded correctly.

---

## Summary of Genuinely New Findings (not already fixed or deferred)

| ID | Severity | Confidence | File | Description | Status |
|---|---|---|---|---|---|
| C58-01 | MEDIUM | HIGH | `ReportContent.svelte:48` vs `VisibilityToggle.svelte:92` | Report uses `> 0` for savings prefix but VisibilityToggle uses `>= 0`, causing "+0원" on results page vs "0원" on report page for zero savings | NEW |
| C58-02 | LOW | HIGH | `VisibilityToggle.svelte:92` | Same root cause as C58-01, results page stat card shows "+0원" for zero savings | NEW (duplicate of C58-01) |
| C58-07 | LOW | MEDIUM | `apps/web/src/lib/parser/index.ts:17-47` | No test coverage for encoding detection fallback path (EUC-KR/CP949) | NEW |
