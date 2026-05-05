# Cycle 10 Critic Review — Multi-Perspective Critique

**Reviewer:** critic  
**Cycle:** 10  
**Date:** 2026-05-05

---

## Findings

### [P1-HIGH] Infinity amounts silently corrupt transaction data
**Description:** From user perspective: upload a statement with a malformed amount, get Infinity in results. The UI may show "0원" (due to formatWon fallback) but internal calculations could be wrong.
**Impact:** User sees confusing results. Trust in calculation accuracy drops.
**Fix:** Treat Infinity/NaN as parse errors, show clear error messages.
**Confidence:** High

### [P2-MEDIUM] FileDropzone bank detection skips PDFs
**Description:** `detectBankFromFile()` returns early for PDF files without attempting detection.
**Impact:** Users uploading PDFs never see the "detected bank" hint, even though PDF parser supports detection.
**Fix:** Implement lightweight PDF text extraction for detection (first 4KB may contain bank name).
**Confidence:** Medium

### [P2-MEDIUM] Previous spending clamped at 10B but not validated in UI
**Description:** `MAX_PREVIOUS_SPENDING_KRW = 10_000_000_000`. The input has `max="10000000000"` but browser enforcement is client-side only.
**Impact:** Malicious or buggy client could bypass the limit.
**Fix:** Server-side validation of previousMonthSpending.
**Confidence:** Medium

### [P3-LOW] Missing i18n infrastructure
**Description:** All UI text is hardcoded Korean. No i18n framework or translation keys.
**Impact:** Future internationalization requires massive refactoring.
**Fix:** Introduce translation keys (even if only Korean for now).
**Confidence:** Low

---

## Summary Table

| Severity | Count |
|----------|-------|
| P1-HIGH | 1 |
| P2-MEDIUM | 2 |
| P3-LOW | 1 |

**Verdict:** FIX AND SHIP
