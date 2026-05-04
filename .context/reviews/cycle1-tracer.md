# Tracer Review — Cycle 1 (tracer)

## Scope
Causal tracing of suspicious flows and failure mode analysis.

---

## C1-TR-01: TRACE — What happens when a new bank CSV format is uploaded?

**Flow**: User uploads CSV -> `parseStatement()` -> `detectFormat()` -> `parseCSV()` -> bank detection -> adapter selection -> parsing

**Trace through a hypothetical "Kakao Bank" CSV** (no dedicated CSV adapter):
1. `detectFormat()` returns format='csv', bank=null (no bank text in first bytes)
2. `parseCSV()` calls `detectBank()` which finds '카카오뱅크' -> bank='kakao'
3. `ADAPTERS.find(a => a.bankId === 'kakao')` returns undefined (no kakao adapter)
4. Falls to signature detection loop — no adapter matches
5. Falls to `parseGenericCSV(content, 'kakao')`
6. Generic parser scans 5 lines for header with Korean text
7. If header found, uses regex-based column detection

**Failure point**: Step 6 — if the Kakao CSV has >5 lines of metadata, header detection fails. The web-side version would succeed (scans 30 lines).

---

## C1-TR-02: TRACE — What happens with an Excel file exported as HTML with .xls extension?

**Flow**: User uploads .xls file -> `parseStatement()` -> `detectFormat()` returns 'xlsx' -> `parseXLSX()`

**Trace**:
1. `parseXLSX()` reads file buffer
2. `isHTMLContent()` checks first 512 bytes for HTML markers
3. If HTML detected: normalizes HTML, detects bank, reads as HTML table
4. If not HTML: reads as binary XLSX

**This works correctly** — the HTML-as-XLS detection is a good resilience feature. However, this only works for XLSX parser, not for files with .csv extension that contain HTML.

---

## C1-TR-03: TRACE — What happens when column order is different from expected?

**Scenario**: A bank exports CSV with columns in order [amount, date, merchant] instead of [date, merchant, amount].

**Trace through bank-specific adapter (e.g., hyundai)**:
1. Header row found (contains '이용일', '이용처', '이용금액')
2. `dateIdx = headers.indexOf('이용일')` -> correctly finds date column by name
3. `amountIdx = headers.indexOf('이용금액')` -> correctly finds amount column by name
4. Parsing uses column indices, not positions

**This works correctly** — `indexOf` finds columns by name regardless of position. The issue is only when column NAMES change, not when column ORDER changes.

---

## C1-TR-04: TRACE — What happens when a bank adds extra columns to their export?

**Scenario**: Hyundai adds a "카드종류" column between "이용처" and "이용금액".

**Trace through hyundai adapter**:
1. Header row found
2. `dateIdx = headers.indexOf('이용일')` -> correct
3. `merchantIdx = headers.indexOf('이용처')` -> correct
4. `amountIdx = headers.indexOf('이용금액')` -> correct (shifted right by 1)
5. All data rows parsed using correct indices

**This works correctly** — column name-based matching handles extra columns gracefully.

---

## C1-TR-05: TRACE — What happens when a bank changes a column name?

**Scenario**: Samsung changes "이용일" to "승인일자" in a new export format.

**Trace through samsung adapter**:
1. Header scanning: `cells.includes('이용일')` -> FALSE (column renamed)
2. `cells.includes('가맹점명')` -> TRUE
3. Only 1 of 2 required headers found -> `headerIdx` stays -1
4. Returns error: "헤더 행을 찾을 수 없습니다."
5. Falls to generic parser
6. Generic parser regex: `/이용일|거래일|날짜|일시/` -> doesn't match '승인일자'
7. Generic parser's data-driven inference might detect dates from data

**Failure**: The bank-specific adapter fails AND the generic parser may not recover because '승인일자' isn't in the regex list. However, the XLSX parser's regex includes '승인일' which is close.

**Fix**: Add '승인일자' to the generic parser's date column regex. Use fuzzy/partial matching for column names.