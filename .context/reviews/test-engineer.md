# Test Engineer Review -- Cycle 15

## Test Coverage Gaps

### 1. PDF Header-Aware Parsing (NEW -- needs tests)
No tests exist for PDF header row detection because the feature doesn't exist yet. Once implemented, need tests for:
- PDF with clear header row ("이용일  가맹점  금액")
- PDF with header keywords but extra columns
- PDF without header (falls back to positional heuristics)
- PDF with split-column-header (multi-column text)

### 2. XLSX Memo Forward-Fill (NEW -- needs tests)
No tests for memo column forward-fill in merged cells. Need:
- XLSX with merged memo cells across installment rows

### 3. Server extractor.ts dedup (no new tests needed)
Internal refactor, existing tests cover extractText/extractPages behavior.

## Current Test Counts
- bun: 703 tests across 22 files
- vitest: 231 tests across 9 files
- playwright: (not checked this cycle)
