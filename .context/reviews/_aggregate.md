# Review Aggregate — 2026-04-19 (Cycle 14)

**Source reviews (this cycle):**
- `.context/reviews/2026-04-19-cycle14-comprehensive.md` (multi-angle review)

**Prior cycle reviews (still relevant):**
- All cycle 1-13 per-agent and aggregate files

---

## Deduplication with Prior Reviews

All cycle 1-13 findings have been verified as fixed or deferred. Cycle 13 HIGH-priority findings (C13-01, C13-02, C13-12, C13-13, C13-16) are all confirmed fixed in this cycle.

Deferred items D-01 through D-85 remain unchanged and are not re-listed here.

---

## Verification of Cycle 13 Fixes

All 5 implemented cycle 13 HIGH-priority fixes verified as correctly implemented:
- C13-01: CSV `parseDateToISO` short-year branch now uses `padStart(2, '0')` (csv.ts:54)
- C13-02: PDF `parseDateToISO` short-year branch now uses `padStart(2, '0')` (pdf.ts:150)
- C13-12: `parser-date.test.ts` exists with comprehensive date parsing tests
- C13-13: `reward-cap-rollback.test.ts` exists with 6 tests for global cap rollback
- C13-16: FileDropzone help text now says "전월" instead of "전전월" (FileDropzone.svelte:401)

---

## Active Findings (New in Cycle 14, Deduplicated)

| ID | Severity | Confidence | File | Description | Cross-ref |
|---|---|---|---|---|---|
| C14-01 | MEDIUM | High | `greedy.ts:117` | `buildAssignments` groups by `tx.category` instead of `categoryKey` — subcategory breakdown lost | New |
| C14-02 | LOW | Medium | `store.svelte.ts:139-151` | `isValidTx` doesn't check for duplicate IDs — defense-in-depth | New |
| C14-03 | LOW | High | `TransactionReview.svelte:151` | Search doesn't normalize full-width Latin characters | New |
| C14-04 | LOW | High | `analyzer.ts:47, 194-196` | `cachedCoreRules` never invalidates — by design | Extends C12-02 |
| C14-05 | LOW | High | `greedy.ts:235-237` | Array mutation via push is side effect — documented, not current bug | New |
| C14-06 | LOW | Medium | `csv.ts:88` | `parseInt` silently truncates scientific notation | New |
| C14-07 | LOW | Medium | `Layout.astro:15-24` | Hardcoded fallback stats in catch block will become stale | New |
| C14-08 | LOW | Medium | `FileDropzone.svelte:12-43` | Page-level drag listeners could leak dragCount | New |
| C14-09 | MEDIUM->LOW | Medium | `reward.ts:113-117` | `normalizeRate` divides mileage rates by 100 — confirmed correct (Won-equiv % convention) | New (confirmed correct) |
| C14-10 | LOW | Medium | `reward.ts:63-88` | Wildcard rule matching — confirmed correct | New (confirmed correct) |

---

## Cross-Agent Agreement (Cycle 14)

| Finding | Signal |
|---|---|
| C14-01 | MEDIUM signal — subcategory information is lost in assignment display. The reward calculation is correct (uses categoryKey), but the assignment grouping collapses subcategories into parent categories. Users would see "dining" instead of "dining/cafe" in the card assignment view. |
| C14-09 | RESOLVED — mileage rates use Won-equivalent percentage convention, not literal miles per 1,500 Won. Documented in normalizeRate. |

---

## Prioritized Action Items

### CRITICAL (must fix)
- None — all prior criticals are fixed

### HIGH (should fix this cycle)
1. C14-01: Fix `buildAssignments` to use `buildCategoryKey(tx.category, tx.subcategory)` for grouping key
2. C14-09: Mileage rate convention confirmed correct — documented in normalizeRate (commit `0000000e0`)

### MEDIUM (plan for next cycles)
3. C14-06: Add scientific notation handling to CSV `parseAmount` (low priority)
4. C14-07: Add warning log when Layout.astro falls back to hardcoded stats

### LOW (defer or accept)
- C14-02 (defense-in-depth), C14-03 (full-width Latin), C14-04 (by design), C14-05 (documented), C14-08 (not current issue), C14-10 (confirmed correct)

---

## Agent Failures

No agent failures. Single comprehensive multi-angle review completed successfully.
