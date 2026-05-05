# Cycle 21 — Debugger Review

## C21-DB01: Web-side amount parsing edge case — full-width plus sign (LOW)

**File:** `apps/web/src/lib/parser/csv.ts:126-131`, `apps/web/src/lib/parser/xlsx.ts:315-321`
**Confidence:** High

Reproduction: An amount string like `＋1,234` (with full-width plus sign U+FF0B) will fail to parse correctly.

In `csv.ts` line 128:
```ts
.replace(/，/g, ',').replace(/．/g, '.').replace(/－/g, '-')
```
The full-width plus `＋` (U+FF0B) is NOT replaced with ASCII `+`. Then `parseFloat(cleaned)` receives `＋1234` which produces NaN.

The PDF parser (`pdf.ts:250`) correctly handles this: `.replace(/＋/g, '+')`.
The server-side (`packages/parser/src/csv/shared.ts:145`) also handles it.

**Impact:** Low frequency — few Korean banks use full-width plus signs. But when they do, the transaction is silently dropped (amount parses to null, then skipped by `isValidAmount`).

**Fix:** Add `.replace(/＋/g, '+')` to web CSV `parseAmount`. For XLSX, fix C21-01 (use shared `parseAmountString`) which will inherit the fix.

---

## C21-DB02: Web-side format detection fails for files with mismatched extensions (LOW)

**File:** `apps/web/src/lib/parser/detect.ts:107-118`
**Confidence:** High

Reproduction: A user downloads a CSV statement but the bank serves it with `.txt` extension, or an HTML export is saved as `.xls`. `detectFormatFromFile('statement.txt')` returns `'csv'` without any content validation. The CSV parser then receives JSON/OFX/HTML content and produces confusing errors.

The server-side (`packages/parser/src/detect.ts:234-318`) handles this by sniffing magic bytes and content headers.

**Fix:** Implement content sniffing in `detectFormatFromFile` as described in C21-02.
