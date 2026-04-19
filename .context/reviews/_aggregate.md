# Review Aggregate — 2026-04-19 (Cycle 21)

**Source reviews (this cycle):**
- `.context/reviews/2026-04-19-cycle21-comprehensive.md` (multi-angle review)

**Prior cycle reviews (still relevant):**
- All cycle 1-20 per-agent and aggregate files

---

## Deduplication with Prior Reviews

All cycle 1-20 findings have been verified as fixed or deferred. Cycle 20 findings C20-01 through C20-07 are confirmed fixed or deferred.

C21-02 is a new finding (inconsistent rate precision). C21-03 extends D-42/D-57 (third copy of bank names). C21-04 repeats C20-06 (fee sort not fixed). C21-05 is a new finding (early exit in PDF table parser). C21-06 extends D-73/D-89 (Math.max spread).

Deferred items D-01 through D-105 remain unchanged and are not re-listed here.

---

## Verification of Cycle 20 Fixes

| Finding | Status | Evidence |
|---|---|---|
| C20-01 | FIXED | `CardDetail.svelte:22-31,231` — categoryLabels Map built in onMount, used in table display |
| C20-02 | DEFERRED | LOW, theoretical |
| C20-03 | DEFERRED | LOW, cosmetic |
| C20-04 | DEFERRED (D-87) | LOW, style only |
| C20-05 | DEFERRED (D-73/D-89) | LOW |
| C20-06 | NOT FIXED | `CardGrid.svelte:62-65` — still sorts only by domestic fee |
| C20-07 | DEFERRED (D-42/D-57) | LOW, long-term |

---

## Active Findings (New in Cycle 21, Deduplicated)

| ID | Severity | Confidence | File | Description | Cross-ref |
|---|---|---|---|---|---|
| C21-02 | LOW | High | `SavingsComparison.svelte:150` vs `OptimalCardMap.svelte:117` | Inconsistent rate formatting precision (1dp vs 2dp) | New |
| C21-03 | LOW | High | `FileDropzone.svelte:72-97` | Third hardcoded copy of bank names | Extends D-42/D-57 |
| C21-04 | LOW | High | `CardGrid.svelte:62-65` | Fee sort ignores international annual fee | Same as C20-06 |
| C21-05 | LOW | Medium | `pdf.ts:82-85` | `parseTable` exits early after blank line within table | New |
| C21-06 | LOW | High | `pdf.ts:26` | Math.max spread stack overflow risk | Extends D-73/D-89 |

---

## Prioritized Action Items

### MEDIUM (should fix this cycle)
- C21-04/C20-06: Fix CardGrid fee sort to include international fee as secondary key (simple fix)
- C21-05: Fix PDF parseTable early exit to handle blank lines within tables

### LOW (defer or accept)
- C21-02: Inconsistent rate precision — minor UX issue, defer
- C21-03: Third copy of bank names — extends D-42/D-57, long-term fix
- C21-06: Math.max spread — extends D-73/D-89, already deferred

---

## Agent Failures

No agent failures. Single comprehensive review completed successfully.
