# Review Aggregate — 2026-04-19 (Cycle 6)

**Source reviews (this cycle):**
- `.context/reviews/2026-04-19-cycle6-comprehensive.md` (multi-angle review)

**Prior cycle reviews (still relevant):**
- `.context/reviews/_aggregate.md` (cycle 5)
- All cycle 1-5 per-agent files

---

## Deduplication with Prior Reviews

All cycle 1-4 findings have been verified as fixed or deferred. Cycle 5 findings C5-01, C5-02, C5-03 are now fixed. They are not re-listed here.

Deferred items D-01 through D-44 and LOW items from cycle 5 (C5-04 through C5-08) remain unchanged and are not re-listed here.

---

## Verification of Cycle 5 Fixes

All 3 implemented cycle 5 fixes verified as correctly implemented:
- C5-01/C5-09 (`generation++` in `reoptimize()`)
- C5-02 (transactions persisted in sessionStorage with validation and size-based truncation)
- C5-03 (OptimalCardMap keyboard accessibility with role, tabindex, aria, onkeydown)

---

## Active Findings (New in Cycle 6, Deduplicated)

| ID | Severity | Confidence | File | Description | Cross-ref |
|---|---|---|---|---|---|
| C6-01 | MEDIUM | High | `SavingsComparison.svelte:33-40` | `cardBreakdown` stores stale initial `rate` before recalculation — fragile pattern | New |
| C6-02 | MEDIUM | High | `store.svelte.ts:96-125` | `persistToStorage` silently truncates transactions on oversize — no indicator | Extends C5-07 |
| C6-03 | LOW | High | `SavingsComparison.svelte:53-68` | Count-up animation resets to 0 on re-render instead of smooth transition | New |
| C6-04 | LOW | Medium | `reward.ts:81` | `findRule` wildcard exemption from subcategory blocking is undocumented | Extends C3-02/M-06 |
| C6-05 | LOW | High | `greedy.ts:84-110` | `scoreCardsForTransaction` calls `calculateCardOutput` twice per card per transaction | Extends D-09 |
| C6-06 | LOW | High | `xlsx.ts:272-273` | XLSX HTML detection decodes buffer twice for HTML-as-XLS files | New |
| C6-07 | MEDIUM | High | `TransactionReview.svelte:99-104` | AI categorizer doesn't clear subcategory when changing category | Same class as C-01 (fixed) |
| C6-08 | LOW | Medium | `SavingsComparison.svelte:24-46` | `cardBreakdown` derivation source should be documented | New |
| C6-09 | LOW | Medium | `cards.ts:159-173` | `loadCategories` fetch deduplication gap | Same as D-07 |
| C6-10 | LOW | High | `csv.ts:29-37`, `xlsx.ts:183-190` | `inferYear` duplicated — divergence risk | Extends D-35 |
| C6-11 | LOW | High | `SavingsComparison.svelte:161` | Inline rate formatting vs `formatRate()` — precision mismatch | New |

---

## Cross-Agent Agreement (Cycle 6)

| Finding | Signal |
|---|---|
| C6-07 / C-01 | AI categorizer subcategory clearing — same bug class as the already-fixed manual `changeCategory` (C-01). Strong signal that this is a real bug. |
| C6-02 / C5-07 | SessionStorage persistence feedback — 2 findings across cycles (C5-07 was deferred; C6-02 adds the truncation-specific failure mode). Combined signal is MEDIUM. |
| C6-10 / D-35 | `inferYear` duplication — 2 findings across cycles. Signal remains LOW but divergence risk increases over time. |
| C6-05 / D-09 | `scoreCardsForTransaction` double call — 2 findings across cycles. Signal remains LOW (performance). |

---

## Prioritized Action Items

### CRITICAL (must fix)
- None — all prior criticals are fixed

### HIGH (should fix this cycle)
1. C6-07: Add `tx.subcategory = undefined;` to AI categorizer result application (1-line fix, same pattern as C-01)
2. C6-01: Remove redundant `rate` field from `CardBreakdown` interface initialization
3. C6-02: Add `persistWarning` indicator when transactions are truncated from sessionStorage save

### MEDIUM (plan for next cycles)
4. C6-03: Smooth count-up animation transition on re-render
5. C6-11: Add `formatRatePrecise` helper or document inline rate formatting intent

### LOW (defer or accept)
- C6-04, C6-05, C6-06, C6-08, C6-09, C6-10

---

## Agent Failures

No agent failures. Single comprehensive review completed successfully.
