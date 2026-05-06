# Cycle 27 — Code Review

## Summary
Cycle 26 fixed JSON negative-amount parity, reward calculator redundancy, and unsafe assertions. Cycle 27 finds that the same forward-fill reset bug fixed in HTML parsers (C25-COR01, C20-04) persists in both XLSX parsers. Also finds intra-web duplication of parseAmount between csv.ts and pdf.ts.

---

## MEDIUM: Server XLSX parser skips summary rows without resetting forward-fill state

**Severity: MEDIUM** | **Confidence: High** | File: `packages/parser/src/xlsx/index.ts:325`

The server XLSX parser detects summary rows and skips them with `continue` (line 325), but does not reset the forward-fill tracking variables (`lastDate`, `lastMerchant`, `lastCategory`, `lastInstallments`, `lastMemo`, `lastAmount`). When a summary row has merged cells (common in Korean bank XLSX exports), the summary row values get stored into the `last*` variables via the forward-fill update logic at lines 336-387, then propagate to all subsequent data rows with empty merged cells.

This is the exact same bug pattern that was fixed in:
- Server HTML parser (C25-COR01, committed 2026-05-06)
- Web HTML parser (C20-04, committed earlier)

The XLSX parsers were never audited for this issue.

**Failure scenario:** A Korean bank XLSX export with monthly subtotals. The subtotal row has a date and amount. After the subtotal, installment rows with merged date/merchant cells forward-fill the subtotal values instead of the actual transaction values, producing incorrect data.

**Fix:** Wrap the `continue` in a block that resets all six `last*` variables to `''` before continuing, matching the fix pattern from `packages/parser/src/html/index.ts:156-166`.

---

## MEDIUM: Web XLSX parser skips summary rows without resetting forward-fill state

**Severity: MEDIUM** | **Confidence: High** | File: `apps/web/src/lib/parser/xlsx.ts:484`

Same bug as above. The web XLSX parser at line 484 does `if (isSummaryRow(rowText)) continue;` without resetting forward-fill state. The web HTML parser was fixed in C20-04 but the XLSX parser was missed.

**Fix:** Same pattern - reset `lastDate`, `lastMerchant`, `lastCategory`, `lastInstallments`, `lastMemo`, `lastAmount` to `''` before continuing.

---

## LOW: Duplicate parseAmount implementations in web-side csv.ts and pdf.ts

**Severity: LOW** | **Confidence: High** | Files: `apps/web/src/lib/parser/csv.ts:123-151`, `apps/web/src/lib/parser/pdf.ts:246-274`

Both files define nearly identical `parseAmount()` functions (full-width digit normalization, Won sign stripping, 마이너스 handling, trailing minus, parenthesized negatives, rounding). The only difference is that pdf.ts exports `parseAmount` while csv.ts keeps it module-private (but exports aliases `parseCSVAmount` and `parseAmountString`).

This is intra-web duplication separate from the server/web duplication (A-ARCH-01). Fixing this requires extracting a shared utility within the web parser directory.

**Fix:** Create `apps/web/src/lib/parser/amount.ts` with the shared `parseAmount` function. Import from there in csv.ts and pdf.ts.

---

## LOW: Web XLSX normalizeHTML import creates unnecessary coupling

**Severity: LOW** | **Confidence: Medium** | File: `apps/web/src/lib/parser/xlsx.ts:5`

The web XLSX parser imports `normalizeHTML` from `./html.ts`. This means the XLSX module depends on the HTML module. If the HTML parser changes (e.g., adds more aggressive sanitization), XLSX parsing could be affected unexpectedly. The server-side XLSX parser has its own `normalizeHTML` copy.

**Fix:** Either inline a minimal HTML normalization in xlsx.ts for the HTML-as-XLS path, or extract `normalizeHTML` to a shared utility module.
