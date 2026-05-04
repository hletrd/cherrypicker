# Cycle 67 Code Review

## F1: Web-side CSV missing splitCSVContent (FIX - HIGH)
File: `apps/web/src/lib/parser/csv.ts` lines 216, 406
Both `parseGenericCSV` and `createBankAdapter.parseCSV` use naive `content.split('\n').filter(l => l.trim())`. Need to add a local `splitCSVContent` implementation (matching server-side) or port the logic.

## F2: Web-side bank adapter skip condition (FIX - LOW)
File: `apps/web/src/lib/parser/csv.ts` line 441
`if (!dateRaw && !merchantRaw) continue;` should be `if (!dateRaw && !merchantRaw && !amountRaw) continue;`

## F3: Web-side missing console.warn (FIX - LOW)
File: `apps/web/src/lib/parser/csv.ts` signature-detect loop
Add `console.warn('[cherrypicker] Bank adapter ${adapter.bankId} (detect) failed:', err);`

## F4: Web-side missing column detection failure error (FIX - LOW)
File: `apps/web/src/lib/parser/csv.ts` in `parseGenericCSV`
Add error reporting when `dateCol === -1 || amountCol === -1` after data-inference.