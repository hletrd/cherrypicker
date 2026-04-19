# Review Aggregate — 2026-04-19 (Cycle 13)

**Source reviews (this cycle):**
- `.context/reviews/2026-04-19-cycle13-comprehensive.md` (multi-angle review)

**Prior cycle reviews (still relevant):**
- All cycle 1-12 per-agent and aggregate files

---

## Deduplication with Prior Reviews

All cycle 1-12 findings have been verified as fixed or deferred. Cycle 12 HIGH-priority findings (C12-14, C12-10, C12-11) are all confirmed fixed in this cycle.

Deferred items D-01 through D-85 remain unchanged and are not re-listed here.

---

## Verification of Cycle 12 Fixes

All 3 implemented cycle 12 HIGH-priority fixes verified as correctly implemented:
- C12-14: XLSX `parseAmount` now uses `Math.round(raw)` for numeric amounts (xlsx.ts:245)
- C12-10: Multi-month handling tests added (analyzer-adapter.test.ts:208-296)
- C12-11: Subcategory handling tests added (analyzer-adapter.test.ts:298-371)

---

## Active Findings (New in Cycle 13, Deduplicated)

| ID | Severity | Confidence | File | Description | Cross-ref |
|---|---|---|---|---|---|
| C13-01 | MEDIUM | High | `csv.ts:54` | CSV short-year date missing zero-padding — produces non-ISO dates | New |
| C13-02 | MEDIUM | High | `pdf.ts:150` | PDF short-year date missing zero-padding — same as C13-01 | New |
| C13-03 | LOW | High | `csv.ts:82-91` | CSV parseAmount returns NaN vs XLSX returns null — inconsistent API | Extends C12-03/C12-04 |
| C13-04 | LOW | High | `greedy.ts:84-109` | Greedy optimizer O(n*m*k) — acceptable for typical use | New |
| C13-05 | LOW | Medium | `matcher.ts:8-13` | ALL_KEYWORDS spread at module load — negligible cost | New |
| C13-06 | MEDIUM | High | Layout.astro CSP | CSP allows 'unsafe-inline' in script-src — reduces XSS protection | Same as C11-07/C12-06 |
| C13-07 | LOW | Medium | astro.config.ts | No SRI for external resources — none exist, not needed | New |
| C13-08 | LOW | High | `constraints.ts:20-24` | `categorySpending` map is dead code — never read by optimizer | New |
| C13-09 | LOW | High | `greedy.ts:7-50` | `CATEGORY_NAMES_KO` duplicates `categoryLabels` — maintenance burden | Extends C12-07 |
| C13-10 | LOW | Medium | `reward.ts:87` | findRule specificity tie-breaking undefined — unlikely in practice | New |
| C13-11 | LOW | High | `types.ts:52` | Math.floor in calculatePercentageReward — correct behavior | New (confirmed correct) |
| C13-12 | MEDIUM | High | `__tests__/` | No tests for parseDateToISO — would have caught C13-01/C13-02 | New |
| C13-13 | MEDIUM | High | `__tests__/` | No tests for global cap rollback in calculateRewards | New |
| C13-14 | LOW | Medium | SpendingSummary.svelte | Missing helper text for single-month upload | New |
| C13-15 | LOW | Medium | FileDropzone.svelte | Total size check rejects entire batch instead of partial | Extends C12-12 |
| C13-16 | LOW | Medium | FileDropzone.svelte:401 | "전전월" should be "전월" in help text | New |
| C13-17 | LOW | Medium | store.svelte.ts:144 | isValidTx doesn't validate date format | Extends C12-16 |

---

## Cross-Agent Agreement (Cycle 13)

| Finding | Signal |
|---|---|
| C13-01/C13-02 | HIGH signal — date format bug in CSV and PDF parsers. Zero-padding missing in short-year branch produces non-ISO dates that break month extraction. Both parsers have the same bug; XLSX parser is correct. |
| C13-12/C13-13 | HIGH signal — missing test coverage for critical parsing and reward calculation logic. Tests would have caught C13-01/C13-02. |
| C13-06 | CARRIED from C11-07/C12-06 — CSP 'unsafe-inline'. MEDIUM signal, deferred. |
| C13-16 | LOW but concrete — incorrect Korean help text that could mislead users. Easy fix. |

---

## Prioritized Action Items

### CRITICAL (must fix)
- None — all prior criticals are fixed

### HIGH (should fix this cycle)
1. C13-01: Add `padStart(2, '0')` to CSV short-year date parsing
2. C13-02: Add `padStart(2, '0')` to PDF short-year date parsing
3. C13-12: Add unit tests for `parseDateToISO` across all formats
4. C13-13: Add test for `calculateRewards` global cap rollback
5. C13-16: Fix "전전월" → "전월" in FileDropzone help text

### MEDIUM (plan for next cycles)
6. C13-06: Migrate CSP to hash-based (carried from C11-07)
7. C13-03: Unify parseAmount return type across parsers

### LOW (defer or accept)
- C13-04 (acceptable for typical use), C13-05 (negligible), C13-07 (not needed), C13-08 (dead code, low risk), C13-09 (maintenance burden), C13-10 (unlikely), C13-11 (correct behavior), C13-14 (nice-to-have), C13-15 (UX improvement), C13-17 (defense-in-depth)

---

## Agent Failures

No agent failures. Single comprehensive multi-angle review completed successfully.
