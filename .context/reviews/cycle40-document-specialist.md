# Documentation Review — CherryPicker Cycle 40

**Reviewer:** document-specialist
**Scope:** README, inline comments, JSDoc, type annotations
**Date:** 2026-05-06

---

## Summary

One new documentation issue: the `parseAmountString` JSDoc does not mention the `(1,234)` parenthesized negative format. One carryover remains.

| Category | Count | Severity |
|---|---|---|
| New Findings | 1 | Low |
| Carryover | 6 | — |

---

## NEW FINDINGS

### DOC-40-01: `parseAmountString` JSDoc Omits Parenthesized Negative Format Detail
**File:** `packages/parser/src/csv/shared.ts:134-147`
**Severity:** Low | **Confidence:** High

The JSDoc lists these formats:
- Fullwidth digits, KRW prefix, Won sign, 마이너스 prefix
- Parenthesized negatives: `(1,234) → -1234`
- Trailing minus: `1,234- → -1234`
- Leading plus: `+1,234 → 1234`

But it does NOT mention that parenthesized negatives are accounting-style (the parentheses themselves indicate negation). This omission makes the double-negative bug (BUG-40-02) harder to discover.

**Fix:** Update the JSDoc to explicitly state: "Parentheses indicate accounting-style negatives: `(1234)` is treated as `-1234`."

---

## CARRYOVER

| ID | Severity | File | Description |
|----|----------|------|-------------|
| DOC-37-01 | Medium | `ofx/index.ts:85` | Misleading parseOFXDate JSDoc |
| DOC-37-02 | Low | New parsers | Missing `@throws` docs |
| DOC-01 | High | `README.md:82` | Stale "TypeScript 6" claim |
| DOC-02 | High | `README.md:79` | Card count inconsistency |
| DOC-03 | Medium | `README.md:34` | AI classification wording |
| DOC-06 | Medium | Pervasive | Cycle-reference convention burden |
