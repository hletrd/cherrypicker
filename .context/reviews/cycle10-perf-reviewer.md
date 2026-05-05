# Cycle 10 Performance Review

**Reviewer:** perf-reviewer  
**Cycle:** 10  
**Date:** 2026-05-05

---

## Findings

### [P2-MEDIUM] Greedy optimizer O(n*m) score calculation
**Description:** `scoreCardsForTransaction` calls `calculateCardOutput` for every card for every transaction. `calculateCardOutput` iterates over all transactions for that card.
**Impact:** For a user with 1000 transactions and 10 cards, this is ~10,000 calls to `calculateCardOutput`, each iterating over the card's transactions. Total complexity is O(n*m*t) where t grows with assignments.
**Fix:** The in-place push/pop optimization (C68-02) helps but doesn't change asymptotic complexity. Consider memoizing reward calculations per (card, category, amount) tuple.
**Confidence:** Medium

### [P2-MEDIUM] PDF parser reads entire file into memory
**Description:** `apps/web/src/lib/parser/pdf.ts` and `packages/parser/src/pdf/` process PDF files by extracting all text.
**Impact:** Large PDF statements (100+ pages) could cause memory pressure in browser.
**Fix:** Add file size limits or streaming PDF parsing. Already has 10MB per-file limit in FileDropzone.
**Confidence:** Low

### [P3-LOW] HTML table parser iterates all sheets
**Description:** `parseHTML` tries all sheets and picks the one with most transactions.
**Impact:** For HTML with many tables, this is wasteful. Could exit early if a sheet has >N transactions.
**Confidence:** Low

---

## Summary Table

| Severity | Count |
|----------|-------|
| P2-MEDIUM | 2 |
| P3-LOW | 1 |

**Verdict:** FIX AND SHIP
