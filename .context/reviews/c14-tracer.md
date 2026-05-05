# Cycle 14 Tracer Review

## Traced Flows

### Flow: Invalid date through CSV parser
1. `parseGenericCSV` receives row with date "2024-99-99"
2. `parseDateStringToISO("2024-99-99")` → no format matches → returns "2024-99-99"
3. `isValidISODate("2024-99-99")` → `/^\d{4}-\d{2}-\d{2}$/` matches → returns `true`
4. No ParseError is pushed
5. Transaction gets `date: "2024-99-99"`
6. `analyzeMultipleFiles` → `monthlySpending` accumulation: `tx.date.length < 7` is false (length=10), so it proceeds
7. `months = [...monthlySpending.keys()].sort()` includes "2024-99"
8. `getLatestMonth` returns "2024-99"
9. `latestTransactions = editedTransactions.filter(tx => tx.date.startsWith("2024-99"))` works
10. But the date is semantically invalid and may cause issues in UI formatting or external APIs

### Flow: console.warn in production
1. `optimizeFromTransactions` calls `toCoreCardRuleSets`
2. Unknown `source` field triggers `console.warn` with card ID
3. In production browser, warning visible in dev tools
4. Information leakage: card IDs and internal field values exposed

### Flow: PDF text extraction space insertion
1. `renderPageText` processes text items from pdf-parse
2. `lastEndX = transform[4] + item.str.length * 6`
3. Korean font has wider characters than Latin font
4. Approximation underestimates width for Korean text
5. Next item's `transform[4]` may be > `lastEndX`, so no space inserted
6. "CU" + "편의점" → "CU편의점"
7. Table parser sees merged text → column detection degrades
