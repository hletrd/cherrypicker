# Review Aggregate — 2026-04-19 (Cycle 20)

**Source reviews (this cycle):**
- `.context/reviews/2026-04-19-cycle20-comprehensive.md` (multi-angle review)

**Prior cycle reviews (still relevant):**
- All cycle 1-19 per-agent and aggregate files

---

## Deduplication with Prior Reviews

All cycle 1-19 findings have been verified as fixed or deferred. Cycle 19 findings C19-01 through C19-04 are confirmed fixed. C19-05 and C19-06 remain deferred as D-104 and D-105.

Deferred items D-01 through D-105 remain unchanged and are not re-listed here.

C20-04 extends D-87 (bucket creation `??` pattern). C20-05 extends D-73/D-89 (Math.max spread). C20-07 extends the class of D-42/D-57 (hardcoded maps duplicating data source).

---

## Verification of Cycle 19 Fixes

| Finding | Status | Evidence |
|---|---|---|
| C19-01 | FIXED | `store.svelte.ts:359-368` — previousMonthSpending computed from monthlyBreakdown's previous month |
| C19-02 | FIXED | `store.svelte.ts:256`, `analyzer.ts:200`, `analyzer.ts:258` — dot-notation keys added in all three locations |
| C19-03 | FIXED | `CardGrid.svelte:22` — availableIssuers derived from filteredCards |
| C19-04 | FIXED | `SpendingSummary.svelte:18-19` — uses slice(0,7) instead of split('-') |
| C19-05 | DEFERRED (D-104) | Same as D-38 — LOW, acknowledged |
| C19-06 | DEFERRED (D-105) | Same as D-62 — LOW, acknowledged |

---

## Active Findings (New in Cycle 20, Deduplicated)

| ID | Severity | Confidence | File | Description | Cross-ref |
|---|---|---|---|---|---|
| C20-01 | MEDIUM | High | `CardDetail.svelte:207-209` | Reward category names show raw English IDs instead of Korean labels | New |
| C20-02 | LOW | High | `matcher.ts:47-49` | Static keyword match returns wrong parent when value is non-dotted subcategory ID | New |
| C20-03 | LOW | Medium | `TransactionReview.svelte:114` | AI categorizer doesn't clear rawCategory after category change | New |
| C20-04 | LOW | High | `reward.ts:213-223` | Bucket creation `??` pattern is semantically awkward (style only) | Extends D-87 |
| C20-05 | LOW | High | `OptimalCardMap.svelte:18-19` | Math.max spread stack overflow risk | Same as D-73/D-89 |
| C20-06 | LOW | High | `CardGrid.svelte:62-65` | Fee sort ignores international annual fee as secondary sort key | New |
| C20-07 | LOW | High | `formatters.ts:49-77` | formatIssuerNameKo hardcoded map duplicates cards.json issuer data | Extends D-42/D-57 |

---

## Cross-Agent Agreement (Cycle 20)

Single comprehensive review this cycle — no cross-agent duplication to resolve.

---

## Prioritized Action Items

### HIGH (should fix this cycle)
1. C20-01: Fix CardDetail reward category display — show Korean labels instead of raw English IDs

### MEDIUM (plan for next cycles)
- C20-06 (add international fee as secondary sort key)

### LOW (defer or accept)
- C20-02 (static keyword parent resolution — theoretical, existing data works correctly)
- C20-03 (rawCategory not cleared — cosmetic only)
- C20-04 (extends D-87 — style improvement only)
- C20-05 (same as D-73/D-89 — already deferred)
- C20-07 (extends D-42/D-57 — long-term dynamic lookup)

---

## Agent Failures

No agent failures. Single comprehensive review completed successfully.
