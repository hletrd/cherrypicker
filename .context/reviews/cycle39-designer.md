# Designer / UX Review — CherryPicker Cycle 39

**Reviewer:** designer (manual, Agent tool unavailablen**Date:** 2026-05-06
**Cycle:** 39 / 100
**HEAD:** d265c46

---

## Findings

### U-DES-39-01 — Medium — Parse errors not differentiated by severity

All parsers now emit `ParseError` for non-spending amounts, unparseable dates, and malformed values. However, these errors are all presented with equal weight in the UI. A refund being filtered (informational) and a corrupted date (potentially data loss) look the same.

**Recommendation:** Add a `severity` or `type` field to `ParseError` so the UI can distinguish:
- `info`: filtered transactions (refunds, zero amounts)
- `warning`: ambiguous parsing (unparseable date fallback)
- `error`: data loss (required column missing, file unreadable)

**Confidence:** Low

---

### U-DES-39-02 — Low — No feedback when ALL transactions are filtered out

If a user uploads a file containing only refunds, payments, or zero-amount rows, all parsers will emit ParseErrors but return an empty transaction array. The web UI shows "거래 내역을 찾을 수 없어요" which is technically correct but unhelpful — the user should see that N transactions were filtered and why.

**Recommendation:** Include the count of filtered transactions in the parse result, or show a summary like "5개 거래 중 5개가 환불/입금으로 필터되었습니다".

**Confidence:** Low

---

## Carryover Status

| ID | Status | Notes |
|----|--------|-------|
| U-DES-37-01 | OPEN | No feedback when transactions filtered — partially addressed by ParseError addition |
| U-DES-37-02 | OPEN | Parse errors not differentiated by file/format |
