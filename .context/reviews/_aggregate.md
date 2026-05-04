# Cycle 11 Aggregate Review

## Findings Summary

### HIGH Priority
1. **PDF DATE_PATTERN missing short dates (MM.DD)** — `parseTable()` and `filterTransactionRows()` use a DATE_PATTERN that doesn't include MM.DD short dates. Structured PDF parsing fails silently for PDFs using short date formats, falling through to the less reliable line scanner. (code-reviewer)

### MEDIUM Priority
2. **Web XLSX missing serial date error reporting** — Server XLSX parser reports errors for out-of-range serial dates but web parser silently returns the raw value. Parity issue. (code-reviewer, verifier)
3. **normalizeHeader doesn't strip zero-width spaces** — JavaScript `\s` doesn't match U+200B/U+200C/U+200D. Korean bank exports with these characters will fail header matching. (code-reviewer)

### LOW Priority
4. **No tests for PDF short date structured parsing** — After fix #1, comprehensive tests needed. (test-engineer)
5. **XLSX formula error cells untested** — SheetJS error cells (#REF!, #VALUE!) should be handled gracefully. (test-engineer)

### DEFERRED (no action this cycle)
| # | Item |
|---|------|
| D-01 | Server/web shared module refactoring |
| D-02 | Web CSV adapter factory pattern |
| D-03 | PDF parser deduplication |
| D-04 | PDF multi-line transaction support |
| D-05 | Historical amount display format |
| D-06 | Card name suffixes |
| D-07 | Global config integration |
| D-08 | Generic parser fallback behavior |
| D-09 | CSS dark mode complete migration |

## Total: 5 findings (1 HIGH, 2 MEDIUM, 2 LOW)