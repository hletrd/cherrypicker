# Cycle 31 Debugger Review

**Scope:** Latent bugs, failure modes, edge cases, and regression risks in parser and web code.

---

## New Findings

### C31-DEBUG01 | LOW | Medium | `apps/web/src/lib/parser/html.ts:183-189` and `packages/parser/src/html/index.ts:176-182`

**Forward-fill uses `isSummaryRow(String(rawDateValue))` but `rawDateValue` could be a number**

When `rawDateValue` is a numeric cell (e.g., Excel serial date), `String(rawDateValue)` produces e.g. `"45292"`. The `isSummaryRow` check looks for Korean summary keywords, so a numeric value would never match. This is harmless but represents a type inconsistency: `isSummaryRow` expects text but receives `String(number)`.

More importantly, if SheetJS parses a cell as a number and the number happens to contain digits that match a summary pattern (extremely unlikely), it could incorrectly reset forward-fill state.

**Fix:** No action needed; the probability is negligible. Document the assumption that summary rows contain Korean text.

### C31-DEBUG02 | LOW | Medium | `packages/parser/src/pdf/llm-fallback.ts:54`

**Truncation at 8000 chars may cut multi-byte Korean characters**

The LLM fallback truncates text at 8000 characters: `text.slice(0, 8000)`. If a Korean character (3 bytes in UTF-8) straddles the boundary, `slice` operates on UTF-16 code units (not bytes), so it won't split surrogate pairs. However, if the text contains combining characters or variation selectors, the slice could be mid-sequence.

**Fix:** Use a byte-aware truncation or ensure the slice ends at a word boundary.

### C31-DEBUG03 | LOW | Low | `apps/web/src/lib/parser/ofx.ts:55` and `packages/parser/src/ofx/index.ts:82`

**OFX date regex may not handle all timezone formats**

The regex `^\d{4}\d{2}\d{2}(?:(\d{2})(\d{2})(\d{2})(?:\.\d+)?(?:\[([+-]?\d+):[A-Z]+\])?)?` expects the timezone in `[offset:TZNAME]` format. Some OFX files use `[offset]` without the `:TZNAME` part, or use named timezones without offsets. These would fail the regex and fall back to `raw.replace(/[^0-9].*$/, '').slice(0, 8)`.

**Fix:** Test with real Korean bank OFX exports to verify timezone format coverage.

---

## Prior Open Findings Verified

| Finding | Status | Evidence |
|---|---|---|
| C30-02 | FIXED | parseCSV generic fallback now has try/catch (C30-02 fix confirmed in csv.ts) |
| C30-03 | OPEN (LOW) | loadFromStorage bare catch still inconsistent with clearStorage (C27-01) |
| C18-02 | OPEN (LOW) | VisibilityToggle effect still runs on dashboard page where stat elements don't exist |
| C22-05 | OPEN (LOW) | TransactionReview changeCategory O(n) array copy still present |

---

## Final Sweep

1. No new race conditions detected
2. No null pointer risks in newly added code
3. All async operations properly awaited
4. No infinite loop risks in parser loops
