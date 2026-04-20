# Cycle 64 Comprehensive Review -- 2026-04-21

**Reviewer**: comprehensive (all specialist angles)
**Scope**: Full repository re-read with focus on verifying prior fixes, testing C63-04/C63-07 fixes, and finding new issues missed by 63 prior cycles

---

## Verification of Prior Cycle Fixes (C63)

| Finding | Status | Evidence |
|---|---|---|
| C63-04 (month-aware day validation) | **FIXED** | `date-utils.ts:12-20` adds `daysInMonth()` and `isValidDayForMonth()`. All branches in `parseDateStringToISO` now call `isValidDayForMonth(year, month, day)` instead of `day >= 1 && day <= 31`. Feb 31 is now correctly rejected. |
| C63-07 (encoding detection breaks early) | **FIXED** | `parser/index.ts:29-38` now iterates ALL encodings (UTF-8, EUC-KR, CP949) and picks the one with fewest `\uFFFD` replacement characters. No early break. |
| C62-11 (persistToStorage bare catch) | **PARTIALLY FIXED** | `store.svelte.ts:154-165` now catches QuotaExceededError specifically and logs non-quota errors via `console.warn`, but still returns `{ kind: 'corrupted' }` for ALL non-quota errors -- misleading for serialization errors vs quota errors |
| C56-04 (date-utils unparseable passthrough) | **OPEN (LOW)** | `date-utils.ts:132` still returns raw input for unparseable dates |
| C56-05 (Zero savings shows "0원" without plus sign) | **OPEN (LOW)** | Still present |
| C33-01/C62-01 (MerchantMatcher/taxonomy O(n) scan) | **OPEN (MEDIUM)** | Still present |
| C33-02/C62-04 (cachedCategoryLabels stale) | **OPEN (MEDIUM)** | Still present |

---

## New Findings (This Cycle)

| ID | Severity | Confidence | File | Description |
|---|---|---|---|---|
| C64-01 | MEDIUM | HIGH | `apps/web/__tests__/parser-date.test.ts:27-98` | Test file duplicates the PRE-C63-04 date parsing logic. The test's local `parseDateToISO` uses `day >= 1 && day <= 31` validation, while production `date-utils.ts` now uses `isValidDayForMonth(year, month, day)`. This means: (1) the test is not testing actual production behavior; (2) Feb 31 would pass the test's local validation but be rejected by production code; (3) there is zero test coverage for the `isValidDayForMonth`/`daysInMonth` functions added in C63-04. This is a test-code/production-code divergence that makes the C63-04 fix effectively untested. |
| C64-02 | LOW | HIGH | `apps/web/src/lib/parser/index.ts:20` | EUC-KR in the encoding candidate list is redundant because CP949 is a strict superset of EUC-KR. CP949 will always produce equal or fewer replacement characters than EUC-KR, so EUC-KR can never win the "fewest replacement characters" heuristic. Not a bug (decoded text would be identical), but the EUC-KR entry adds an unnecessary TextDecoder decode + regex scan on every CSV parse. |
| C64-03 | LOW | MEDIUM | `packages/core/src/optimizer/greedy.ts:7-82` | `CATEGORY_NAMES_KO` is a hardcoded 75-entry map that duplicates labels also available from the `categoryLabels` Map passed via `constraints.categoryLabels`. The hardcoded map serves as a CLI/standalone fallback but can silently drift from the YAML taxonomy. Currently both sources agree, but a taxonomy update without updating this map would produce incorrect Korean labels in CLI output. Converges with C8-07/C8-08 (build-stats fallback drift pattern). |

---

## Cross-Agent Convergence (Cumulative)

Findings flagged by 2+ cycles, indicating high signal:

| Finding | Flagged by Cycles | Current Status |
|---|---|---|
| MerchantMatcher/taxonomy O(n) scan | C16, C33, C50, C62, C63, C64 | OPEN (MEDIUM) -- 6 cycles agree |
| cachedCategoryLabels/coreRules staleness | C21, C23, C25, C26, C33, C62, C63, C64 | OPEN (MEDIUM) -- 8 cycles agree |
| CategoryBreakdown dark mode contrast | C4, C8, C59, C62 | OPEN (LOW) -- 4 cycles agree |
| Annual savings simple *12 projection | C7, C18, C62, C63, C64 | OPEN (LOW) -- 5 cycles agree |
| date-utils unparseable passthrough | C56, C62, C63, C64 | OPEN (LOW) -- 4 cycles agree |
| CSV DATE_PATTERNS divergence risk | C20, C25, C62, C64 | OPEN (LOW) -- 4 cycles agree |
| persistToStorage bare catch | C62, C63, C64 | OPEN (LOW) -- 3 cycles agree |
| Hardcoded fallback drift (CATEGORY_NAMES_KO / build-stats) | C8, C64 | OPEN (LOW) -- 2 cycles agree |

---

## Final Sweep -- Commonly Missed Issues

1. **Test coverage gap (C64-01)**: The most significant new finding this cycle. The C63-04 fix added `isValidDayForMonth`/`daysInMonth` to production code, but the test file still uses the old 1-31 range check. The fix is effectively untested. This is a high-priority remediation item.
2. **No new security findings**: CSP unchanged, no secrets, no XSS vectors (Svelte auto-escapes), no SQL injection.
3. **No new race conditions**: All fetch operations use AbortController properly. Store mutations are synchronous.
4. **No new data-loss vectors**: sessionStorage persistence is well-guarded with truncation/corruption warnings.
5. **No new type-safety issues**: All parsers validate with `Number.isFinite`/`Number.isNaN` guards.
6. **Encoding detection (C63-07 fix verified)**: The fix correctly iterates all encodings. The redundant EUC-KR entry (C64-02) is a minor optimization opportunity, not a correctness issue.

---

## Summary

- **New findings this cycle**: 3 (0 CRITICAL, 1 MEDIUM, 2 LOW)
- **New genuinely novel findings**: 3 (C64-01, C64-02, C64-03)
- **Convergence findings**: 0 (all carried forward)
- **Carried-forward findings**: 22 OPEN from prior cycles
- **Fixed this cycle (confirmed from C63)**: 2 (C63-04, C63-07)
