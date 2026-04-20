# Cycle 67 Comprehensive Code Review -- 2026-04-21

**Scope:** Full re-read of all source files across packages/core, packages/parser, packages/rules, packages/viz, apps/web, tools/cli, tools/scraper. Cross-file interaction analysis. Fix verification of prior cycle findings. New issue discovery.

---

## Verification of Prior Cycle Fixes

All prior cycle 1-66 findings are confirmed fixed except as noted in the aggregate.

| Finding | Status | Evidence |
|---|---|---|
| C66-01 | **FIXED** | `packages/parser/src/date-utils.ts` now uses `isValidDayForMonth()` in all 6 branches. Redundant `day >= 1` pre-checks also removed. |
| C66-06 | **FIXED** | `packages/parser/src/index.ts:43,47` uses `cp949` instead of `euc-kr`. |
| C66-09/C65-02 | **FIXED** | `apps/web/src/lib/parser/date-utils.ts:100,124` no longer has redundant `day >= 1` before `isValidDayForMonth()`. |
| C66-07 | NO-OP | build-stats.ts fallback values still match current cards.json (683/24/45). |

---

## New Findings (This Cycle)

### C67-01: `scoreCardsForTransaction` recalculates ALL card rewards for every transaction — O(n*m*k) quadratic behavior
**Severity:** MEDIUM | **Confidence:** HIGH
**File:** `packages/core/src/optimizer/greedy.ts:120-146`

The `scoreCardsForTransaction()` function is called once per transaction inside `greedyOptimize()`. For each call, it iterates ALL card rules (n cards), and for each card it calls `calculateCardOutput()` TWICE (before and after adding the transaction). `calculateCardOutput()` internally calls `calculateRewards()` which iterates all transactions currently assigned to that card.

With m transactions and n cards, this produces O(m * n * k) total reward calculations where k is the average number of transactions per card. For 500 transactions and 600 cards, that's ~300,000 `calculateRewards()` calls, each iterating over their assigned transactions. The total work is approximately O(m^2 * n) when most transactions are assigned to a few cards.

This is related to C66-03 (MerchantMatcher O(n) scan) but is a distinct performance issue in the optimizer. While the greedy optimizer works correctly, it could be optimized by caching incremental reward calculations instead of full recalculation.

**Concrete failure scenario:** A user uploading a large statement (500+ transactions) with all 600+ cards in the database would experience noticeable latency (multi-second) during optimization. The CLI and web app share this same optimizer code.

**Suggested fix:** Cache the previous `calculateCardOutput` result per card and recompute only the card that received the new transaction, rather than recomputing before/after for every card on every transaction. Alternatively, use incremental reward tracking.

### C67-02: `inferYear()` uses `new Date()` which is timezone-dependent — affects date parsing near midnight Dec 31
**Severity:** LOW | **Confidence:** HIGH (carry-forward from C8-08, no fix attempted in 59 cycles)
**File:** `packages/parser/src/date-utils.ts:22-29`, `apps/web/src/lib/parser/date-utils.ts:33-41`

Both `inferYear()` implementations use `new Date()` and `now.getFullYear()` to determine the current year. In UTC-X timezones near midnight on Dec 31, the local year may already be the next year while the statement's dates are from the previous year. The 90-day lookback heuristic partially mitigates this, but there's a narrow edge case (minutes around midnight, once per year) where the inferred year could be wrong.

This has been flagged since cycle 8 (59 cycles ago) and consistently deferred. Recording again for completeness.

### C67-03: `CATEGORY_NAMES_KO` in greedy.ts can silently drift from YAML taxonomy
**Severity:** LOW | **Confidence:** HIGH (carry-forward from C64-03, explicitly deferred with TODO comment)
**File:** `packages/core/src/optimizer/greedy.ts:11-86`

The hardcoded `CATEGORY_NAMES_KO` map in `greedy.ts` must be manually updated when the YAML taxonomy changes. A TODO comment exists at line 7 acknowledging this. The drift is mitigated by the `categoryLabels` Map parameter passed from the web app (which uses the live taxonomy from `categories.json`), but the CLI path has no such fallback and would show raw English category keys for unmapped entries.

### C67-04: XLSX parser `parseDateToISO` returns Excel serial date without month-aware day validation
**Severity:** MEDIUM | **Confidence:** HIGH
**File:** `apps/web/src/lib/parser/xlsx.ts:187-204`

When the XLSX parser encounters an Excel serial date number (e.g., 45348 for 2024-03-15), it uses `XLSX.SSF.parse_date_code()` to convert it to a date string. The resulting string (formatted as `YYYY-MM-DD`) is returned directly WITHOUT any month-aware day validation. In contrast, the string path delegates to `parseDateStringToISO()` which uses `isValidDayForMonth()`.

If `XLSX.SSF.parse_date_code()` were to return an impossible date (e.g., due to a corrupted serial number), the XLSX parser would produce an invalid date string like "2024-02-31" without rejection. While `parse_date_code()` is well-tested and unlikely to produce impossible dates, this is an inconsistency with the string parsing path — the same validation that protects string dates should also protect serial dates.

The same issue exists in `packages/parser/src/xlsx/adapters/index.ts` (server-side XLSX parser).

**Suggested fix:** After `XLSX.SSF.parse_date_code()` produces `y`, `m`, `d`, validate with `isValidDayForMonth(y, m, d)` before constructing the date string. Port `isValidDayForMonth` and `daysInMonth` from `date-utils.ts`.

### C67-05: Server-side XLSX parser also lacks month-aware day validation for serial dates
**Severity:** LOW | **Confidence:** HIGH (same class as C67-04)
**File:** `packages/parser/src/xlsx/adapters/index.ts`

The server-side XLSX parser has the same issue as C67-04 but at lower severity since the server-side parser is only used via CLI, not the web app.

---

## Cross-File Interaction Analysis

### Date Validation Consistency
The web-side parser pipeline now has consistent month-aware day validation across CSV (via `parseDateStringToISO`), PDF (via `parseDateStringToISO`), and the PDF table-row detection heuristic (via `isValidShortDate`). However, the XLSX parser's serial-date path (C67-04) and the server-side XLSX parser (C67-05) bypass this validation.

### Optimizer Performance
The greedy optimizer's O(m * n * k) complexity (C67-01) interacts with the MerchantMatcher's O(n) substring scan (C66-03) to create a compound performance bottleneck: first categorization is slow for unmatched merchants, then optimization is slow for large transaction sets with many cards.

### Parser Divergence Risk
The XLSX serial-date path (C67-04) is a new divergence from the validation-consistent string path. This is the same class of issue as C66-01 (server-side date-utils lacking month-aware validation), which was fixed last cycle. The XLSX serial-date path should receive the same treatment.

---

## Final Sweep: Commonly Missed Issues

1. **No new XSS risks found:** All dynamic content flows through Svelte's auto-escaping template system. No innerHTML usage found. CSP remains restrictive.

2. **No new secrets/API keys:** No hardcoded credentials. Claude API key for scraper is environment-variable-based.

3. **Error handling robustness:** All async operations in the store are try/catch wrapped with Korean user-facing messages. Parser errors are collected in arrays.

4. **Accessibility maintained:** Skip-to-content link present. ARIA labels on interactive elements. Keyboard navigation supported. Dark mode contrast for CategoryBreakdown bars still a known low-severity carry-forward (C4-09/C8-05).

5. **Print stylesheet intact:** Dark mode print fix confirmed working.

6. **Session storage persistence:** The `persistToStorage` flow correctly handles quota errors and truncation. The 'corrupted' label for non-quota errors (C66-04) is a known carry-forward from C62-11.
