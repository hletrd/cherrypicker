# Cycle 78 Deep Code Review — Format Diversity Focus

## Summary
After 77 cycles of iterative improvement, the parser package is highly mature with 24 bank adapters, extensive column patterns, and robust edge-case handling. This cycle focuses on remaining format diversity gaps: missing column header terms, missing summary row patterns, and test coverage gaps.

## Findings

### F78-01: Missing Korean Column Header Terms (HIGH — format diversity)

**DATE_COLUMN_PATTERN** — missing:
- `결제일시` (payment datetime — distinct from `결제일`)
- `주문시간` (order time — distinct from `주문일`)
- `승인완료` (approval complete — without 일 suffix)
- `처리일시` (processing datetime)
- `조회시간` (lookup time)

**MERCHANT_COLUMN_PATTERN** — missing:
- `상점` (shop/store — common in digital wallet exports)
- `판매점` (sales point — used by some banks)
- `이용매장명` (usage store name — variant)
- `구매내용` (purchase content)

**AMOUNT_COLUMN_PATTERN** — missing:
- `이용대금` (usage fee — KB/신한 variant)
- `실결제액` (actual payment amount — variant)
- `청구액` (billing amount — short form of 청구금액)
- `사용액` (usage amount — short form of 사용금액)
- `할인금액` (discount amount — some exports include this)
- `포인트할인` (point discount — some exports)

**CATEGORY_COLUMN_PATTERN** — missing:
- `결제구분` (payment type — common in 신한/하나)
- `가맹점유형` already present, but `매장유형` (store type) missing

**MEMO_COLUMN_PATTERN** — missing:
- `비고사항` is present, but `메모사항` missing
- `참고사항` is present, but `기타` (etc.) missing
- `카드종류` (card type) missing — some exports put card name here

### F78-02: Missing English Column Header Terms (HIGH — format diversity)

**DATE_COLUMN_PATTERN** — missing:
- `statementdate` (statement date)
- `paymentdate` (payment date — distinct from `settlementdate`)
- `invoicedate` (invoice date)
- `timestamp` (generic datetime)

**MERCHANT_COLUMN_PATTERN** — missing:
- `vendor` is present, but `vendorname` would match after normalization
- `supplier` (supplier — some exports)
- `brand` (brand name)
- `location` (location)

**AMOUNT_COLUMN_PATTERN** — missing:
- `transactionamount` (transaction amount — not normalized to `totalamount`)
- `paymentamount` (payment amount)
- `billedamount` (billed amount)
- `gross` (gross amount)
- `netamount` (net amount)

### F78-03: Missing Summary Row Patterns (MEDIUM — false positive prevention)
- `승인취소합계` (approval cancel total) — some banks use this as footer
- `포인트합계` (point total) — some banks list this in footers
- `할인합계` covered, but `쿠폰할인` (coupon discount) not covered as summary

### F78-04: Missing HEADER_KEYWORDS Entries (MEDIUM — header detection)
The HEADER_KEYWORDS array used for header validation must stay in sync with the column patterns. Currently missing terms from F78-01 and F78-02 that would be needed for header row detection.

### F78-05: Test Coverage Gaps (MEDIUM — robustness)
- No test for CSV tab-delimiter with Korean content
- No test for CSV semicolon-delimiter
- No test for combined column headers with 3+ parts (e.g., "이용일/승인일/매출일")
- No test for English-only headers in the generic CSV parser
- No test for `+` combined headers (only `/`, `|`, `,` tested in findColumn)

### F78-06: Server-Web Parity (LOW — no regression)
Server and web column-matcher, date-utils, and patterns are in parity. The xlsx-parity tests verify this. No divergences detected.

### F78-07: Architecture (LOW — technical debt)
- The 45+ column pattern terms in each regex are getting unwieldy. Could be refactored to use a keyword array + dynamic regex construction, but this is a style preference and not a bug.
- The `normalizeHeader` regex character class is very long but functionally correct.

## Verdict
The parser is in excellent shape after 77 cycles. The remaining improvements are incremental: adding missing column header terms to handle more diverse bank export formats, and adding test coverage for untested delimiter/header combinations.