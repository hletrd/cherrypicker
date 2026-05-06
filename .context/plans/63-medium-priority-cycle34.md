# Plan 63 — Medium Priority Fixes (Cycle 34)

**Source findings:** C34-N2 (API key regex), C34-N3 (card source fallback)
**Date:** 2026-05-06

---

## Task 1: Future-proof API key regex [C34-N2]

**Finding:** C34-N2 — LOW / Medium confidence
**File:** `packages/parser/src/pdf/llm-fallback.ts:66`

### Problem
Regex `sk-ant-api[0-9]{2}` only matches exactly 2 digits. Future Anthropic key formats with 3+ digits would be rejected.

### Implementation
1. Change `[0-9]{2}` to `[0-9]{2,}` to match 2 or more digits.
2. Verify existing test keys still pass.

### Exit Criterion
- Regex matches 2-digit and 3+ digit version numbers
- Existing tests pass

---

## Task 2: Warn on unknown card source [C34-N3]

**Finding:** C34-N3 — LOW / Medium confidence
**File:** `apps/web/src/lib/analyzer.ts:65-67`

### Problem
Unknown `card.source` values are silently mapped to `'web'`, obscuring data quality issues.

### Implementation
1. Add a `console.warn` when an unknown source is encountered:
   ```ts
   source: VALID_SOURCES.has(rule.card.source)
     ? (rule.card.source as ...)
     : (() => { console.warn(`Unknown card source "${rule.card.source}" for ${rule.card.id}, defaulting to "web"`); return 'web'; })(),
   ```

### Exit Criterion
- Unknown sources log a warning
- No test failures
