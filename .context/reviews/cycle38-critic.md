# Critic Review — Cycle 38

## Systemic Observation

The cycle 37 fix for silent data loss (BUG-37-01) was **incomplete**. It only addressed JSON and OFX parsers, leaving HTML and XLSX parsers with the old silent-skip behavior. This creates a **format-dependent user experience** where the same data produces different feedback depending on file format.

This is a classic example of the "parity comment trap" — the codebase relies on "parity with server-side" comments instead of shared code, so fixes applied to one parser don't automatically propagate to others.

## Findings

### C38-CRIT01: Format-dependent error reporting
**Severity:** Medium | **Confidence:** High**

JSON/OFX → ParseError for non-spending amounts
HTML/XLSX/CSV → silent skip

This violates the principle of least surprise. Users should get consistent behavior regardless of upload format.

### C38-CRIT02: isValidCSVAmount design flaw
**Severity:** Medium | **Confidence:** High**

The `isValidCSVAmount` function is documented as a "type guard" that "returns false" for zero/negative amounts. But the doc comment explicitly says "Zero/negative amounts are silently skipped." This is by-design silent data loss that was never revisited after the JSON/OFX parsers gained error reporting.

## Recommendation

Extract a shared `validateSpendingAmount` function that all parsers call. It should:
1. Return `null` for unparseable amounts (with ParseError)
2. Return `null` for non-positive amounts (with ParseError)
3. Return `number` for valid positive amounts

This eliminates the duplication and ensures consistent behavior.
