# Test Engineer Review — Cycle 11

## Missing Test Coverage

### 1. PDF short date structured parsing (HIGH)
After fixing DATE_PATTERN, need tests verifying:
- PDF text with only MM.DD dates gets structured parsed correctly
- filterTransactionRows matches short date rows
- parseTable detects table boundaries with short dates

### 2. normalizeHeader zero-width space handling (MEDIUM)
Test that headers with U+200B, U+200C, U+200D are normalized correctly.

### 3. Web XLSX serial date error reporting (MEDIUM)
Test that out-of-range serial dates produce errors in web parser.

### 4. XLSX formula error cells (LOW)
Test that SheetJS error cells (#REF!, #VALUE!) produce null amounts and appropriate error messages.

## Current Test Count
- 296 bun tests across 8 files (server-side)
- 231 vitest tests (web-side)