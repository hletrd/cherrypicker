# Cycle 2 Debugger Review — Latent Bugs and Failure Modes

---

## F-DBG-01: Server-side XLSX parser header detection lacks category requirement
**Severity: High | Confidence: High**
**File**: `packages/parser/src/xlsx/index.ts` lines 161-169

The server-side XLSX parser checks `matchCount >= 2` for header detection but does NOT require keywords from 2+ distinct categories. The web-side parser (xlsx.ts lines 378-387) and both generic CSV parsers require categories. This means the server-side XLSX parser can match a summary row with two amount-related keywords (e.g., '이용금액' and '승인금액') as the header.

**Failure scenario**: A Samsung XLSX export with a summary table above the real header containing '이용금액' and '승인금액' would be misidentified, causing all subsequent rows to be parsed incorrectly.

---

## F-DBG-02: Server-side XLSX `parseDateToISO` silently returns raw string for unparseable dates
**Severity: Medium | Confidence: High**
**File**: `packages/parser/src/xlsx/index.ts` lines 29-53

The server-side XLSX parser's `parseDateToISO` returns `String(raw)` for unparseable dates without pushing to an error array. The web-side parser (xlsx.ts lines 187-221) pushes error messages. This means server-side users don't see warnings about malformed dates.

---

## F-DBG-03: PDF fallback line scanner doesn't validate month/day in short dates
**Severity: Medium | Confidence: High**
**File**: `packages/parser/src/pdf/index.ts` line 188, `apps/web/src/lib/parser/pdf.ts` line 350

The fallback date pattern includes `\d{1,2}[.\-\/]\d{1,2}(?![.\-\/\d])` which matches "99.99" or "13.32". While these would fail `parseDateStringToISO`'s validation, they could still trigger false-positive date matching in `filterTransactionRows`, causing non-transaction lines to be parsed.

---

## F-DBG-04: Generic CSV merchant inference can pick wrong column
**Severity: Medium | Confidence: High**
**File**: `packages/parser/src/csv/generic.ts` lines 124-131

When headers don't match keywords, the merchant column is inferred as "the first column that is not date and not amount." This picks the first remaining column which could be installments, category, or memo — not the actual merchant. The same issue exists in the web-side (csv.ts lines 229-236).

**Fix**: When inferring merchant from data, prefer the column with the most Korean text characters.

---

## F-DBG-05: Server-side CSV `parseCSV` may use wrong adapter for bank override
**Severity: Low | Confidence: High**
**File**: `packages/parser/src/csv/index.ts` lines 46-49

When a bank is specified, the code finds the adapter by `a.bankId === resolvedBank`. But the server-side only has 10 adapters (the "big 10" Korean banks), while BankId includes 24 banks. For banks like 'kakao', 'toss', 'kbank', etc., the code falls through to the generic parser, which is correct. But there's no warning or logging for this fallthrough.

---

## F-DBG-06: PDF `extractText` error message doesn't distinguish encrypted PDFs
**Severity: Low | Confidence: Medium**
**File**: `packages/parser/src/pdf/extractor.ts` lines 4-8

When `pdf-parse` fails on an encrypted PDF, it throws a generic error. The user sees "PDF 텍스트 추출 실패: [generic error]" without guidance that the PDF might be password-protected.