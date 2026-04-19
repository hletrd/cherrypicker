# Review Aggregate -- 2026-04-19 (Cycle 42)

**Source reviews (this cycle):**
- `.context/reviews/2026-04-19-cycle42-comprehensive.md` (multi-angle comprehensive review)

**Prior cycle reviews (still relevant):**
- All cycle 1-41 per-agent and aggregate files

---

## Deduplication with Prior Reviews

C42-L01 is a carry-over from C41 sweep item 17 (web-side PDF bare catch). Already tracked as a known inconsistency.
C42-L02 is a carry-over from C41 sweep item 19 (server-side CSV silent error swallowing). Already tracked as a known limitation.

No new findings that were not already identified in prior cycles.

---

## Verification of Cycle 41 Fixes

| Finding | Status | Evidence |
|---|---|---|
| C41-01 | **FIXED** | All 10 server-side CSV bank adapters now have `if (isNaN(amount))` guard with `continue` before `transactions.push()`. Verified: hyundai.ts:99, samsung.ts:101, shinhan.ts:98, kb.ts:98, lotte.ts:98, hana.ts:98, woori.ts:98, nh.ts:98, ibk.ts:98, bc.ts:98. |

---

## Verification of Prior Deferred Fixes

| Finding | Status | Evidence |
|---|---|---|
| D-99 | **STILL FIXED** | `apps/web/src/lib/store.svelte.ts:147-148` has `Number.isFinite(tx.amount) && tx.amount > 0` |

---

## Active Findings (New in Cycle 42)

| ID | Severity | Confidence | File | Description | Status |
|---|---|---|---|---|---|
| C42-L01 | LOW | High | `apps/web/src/lib/parser/pdf.ts:284` | Web-side PDF tryStructuredParse catches all exceptions (bare catch {}) while server-side only catches specific types | DEFERRED (carry-over) |
| C42-L02 | LOW | High | `packages/parser/src/csv/index.ts:56-65` | Server-side CSV parseCSV silently swallows adapter errors during content-signature detection | DEFERRED (carry-over) |

---

## Agent Failures

No agent failures. Single comprehensive review completed successfully.
