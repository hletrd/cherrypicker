# Cycle 14 Test Engineer Review

## Test Coverage Assessment

### Current: 446 bun + 231 vitest + 74 playwright tests

### Findings

#### F-TEST-1: No test for XLSX formula error cells (Medium)
No test verifies that XLSX cells containing Excel error strings (#VALUE!, #REF!, #DIV/0!) are handled gracefully. `parseAmount` returns null for these, but `parseDateToISO` produces confusing error messages. Should add a test case.

#### F-TEST-2: No test for web PDF Y-coordinate line breaks (Medium)
The web PDF parser's text extraction joins items with spaces but has no test verifying that column alignment is preserved or that multi-line table rows are handled.

#### F-TEST-3: No test for `extractPages` missing space insertion (Medium)
`extractor.ts` exports `extractPages` which lacks the space-insertion logic. No test exercises this function.

#### F-TEST-4: CSV generic parser English error messages untested (Low)
The English error messages 'Empty file' and 'Cannot parse amount: ...' are not specifically asserted in tests. Tests may pass by checking for partial matches.

#### F-TEST-5: Good coverage for core paths
Column matching, date parsing, amount parsing, header detection, and bank adapters all have thorough test coverage. The 118 column-matcher tests provide strong coverage for the shared module.

### Recommended Test Additions
1. XLSX formula error cell handling test
2. Web PDF text extraction test with positional items
3. `extractPages` space-insertion parity test
