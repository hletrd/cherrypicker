# Review Aggregate — 2026-04-19 (Cycle 22)

**Source reviews (this cycle):**
- `.context/reviews/2026-04-19-cycle22-comprehensive.md` (multi-angle review)

**Prior cycle reviews (still relevant):**
- All cycle 1-21 per-agent and aggregate files

---

## Deduplication with Prior Reviews

All cycle 1-21 findings have been verified as fixed or deferred. Cycle 21 findings C21-04, C21-05, C21-06 are now CONFIRMED FIXED.

C22-01 is a new finding (CategoryBreakdown bar overflow). C22-02 and C22-03 extend D-73/D-89 (Math.max spread pattern) to two additional Svelte components not previously flagged.

Deferred items D-01 through D-105 remain unchanged and are not re-listed here.

---

## Verification of Cycle 21 Fixes

| Finding | Status | Evidence |
|---|---|---|
| C21-02 | DEFERRED | LOW, inconsistent rate formatting — minor UX |
| C21-03 | DEFERRED (D-42/D-57) | LOW, third copy of bank names |
| C21-04 | FIXED | `CardGrid.svelte:63-65` — now includes international fee as secondary sort key |
| C21-05 | FIXED | `pdf.ts:86-89` — now requires 2+ consecutive blank lines to break |
| C21-06 | FIXED | `pdf.ts:26` — now uses `reduce` instead of spread |

---

## Active Findings (New in Cycle 22, Deduplicated)

| ID | Severity | Confidence | File | Description | Cross-ref |
|---|---|---|---|---|---|
| C22-01 | MEDIUM | High | `CategoryBreakdown.svelte:114,170` | "Other" combined bar overflow when its percentage exceeds top individual category | New |
| C22-02 | LOW | High | `OptimalCardMap.svelte:19` | `Math.max(...spread)` stack overflow risk | Extends D-73/D-89 |
| C22-03 | LOW | High | `CardGrid.svelte:19` | `Math.max(...spread)` stack overflow risk | Extends D-73/D-89 |

---

## Prioritized Action Items

### MEDIUM (should fix this cycle)
- C22-01: Fix CategoryBreakdown bar overflow — compute maxPercentage from all categories including "other"

### LOW (defer or accept)
- C22-02: Math.max spread in OptimalCardMap — extends D-73/D-89, theoretical only
- C22-03: Math.max spread in CardGrid — extends D-73/D-89, theoretical only

---

## Agent Failures

No agent failures. Single comprehensive review completed successfully.
