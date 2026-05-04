# Verifier Review — Cycle 1 (verifier)

## Scope
Evidence-based correctness verification of the parser package.

---

## C1-VF-01: CONFIRMED — Server-side generic CSV parser scans only 5 lines for headers
**Severity: High | Confidence: High**

Evidence: `packages/parser/src/csv/generic.ts` line 43: `for (let i = 0; i < Math.min(5, lines.length); i++)`

The web-side equivalent scans 30 lines: `apps/web/src/lib/parser/csv.ts` line 164: `for (let i = 0; i < Math.min(30, lines.length); i++)`

Korean bank CSV exports commonly have 5-15 lines of metadata before the header. The server-side parser will fail on these files.

---

## C1-VF-02: CONFIRMED — Server-side generic CSV parser lacks keyword category validation
**Severity: High | Confidence: High**

Evidence: `packages/parser/src/csv/generic.ts` lines 44-48 only checks for `hasNonNumeric` (any Korean/English text). The web-side additionally requires header keywords from at least 2 distinct categories (date, merchant, amount) — see `apps/web/src/lib/parser/csv.ts` lines 171-183.

---

## C1-VF-03: CONFIRMED — Server-side CSV entry point missing BOM stripping
**Severity: Medium | Confidence: High**

Evidence: `packages/parser/src/csv/index.ts` line 29 passes content directly to adapters without BOM stripping. The web-side strips BOM at `apps/web/src/lib/parser/csv.ts` line 969: `const cleanContent = content.replace(/^﻿/, '');`

---

## C1-VF-04: CONFIRMED — All bank adapters use exact string indexOf for column matching
**Severity: High | Confidence: High**

Evidence across all 10 adapters:
- `hyundai.ts` line 36: `headers.indexOf('이용일')`
- `kb.ts` line 35: `headers.indexOf('거래일시')`
- `shinhan.ts` line 35: `headers.indexOf('이용일')`
- etc.

No header normalization (trim, whitespace collapse) is applied before matching.

---

## C1-VF-05: CONFIRMED — XLSX parser has flexible regex-based column matching
**Severity: Informational | Confidence: High**

Evidence: `packages/parser/src/xlsx/index.ts` lines 193-198 use regex patterns:
```typescript
const dateCol = findCol(config?.date, /이용일|이용일자|거래일|거래일시|날짜|일시|결제일|승인일|매출일/);
```

This is the correct approach that CSV adapters should also use.

---

## C1-VF-06: CONFIRMED — Web-side CSV parser has more date patterns than server-side
**Severity: Medium | Confidence: High**

Web-side `apps/web/src/lib/parser/csv.ts` lines 109-116 has 6 date patterns including Korean formats. Server-side `packages/parser/src/csv/generic.ts` lines 7-11 has only 3 patterns (missing Korean full date, Korean short date, and YY-MM-DD).

---

## C1-VF-07: UNCONFIRMED — Test fixture files may be incomplete
**Severity: Medium | Confidence: Medium**

The detect.test.ts references `fixtures/sample-kb.csv` and `fixtures/sample-samsung.csv`. Could not verify if additional fixture files exist for other banks.