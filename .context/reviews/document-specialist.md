# Document Specialist — cherrypicker (Cycle 20)

**Reviewer:** document-specialist (sonnet)
**Scope:** Documentation completeness, API contracts, code comments
**Date:** 2026-05-05

---

## Summary

Cycle 19 added inline comments explaining monthly spending conventions (C1-01) but these comments now appear in 3+ files with slight wording variations. The OFX parser has a misleading comment about amount parsing. No new external documentation was added.

---

## New Findings

### [C20-DOC01-MEDIUM] C1-01 comment duplicated across multiple files with slight variations

**Files:** `apps/web/src/lib/analyzer.ts:339-341`, `apps/web/src/lib/store.svelte.ts:506-508`
**Confidence:** High

Both files contain nearly identical 3-line comments explaining why `tx.amount > 0` is used. The comments cite "C1-01/C5-01" in analyzer.ts but "C1-01" in store.svelte.ts. This is a maintenance risk: if the convention changes, every copy must be updated.

**Fix:** Extract the convention to a shared constant comment or document in `docs/conventions.md` and reference it inline.

---

### [C20-DOC02-LOW] OFX parser comment contradicts implementation

**Files:** `packages/parser/src/ofx/index.ts:104-107`
**Confidence:** High

```ts
// Parse amount — in OFX: negative amounts = charges/debits (money out), positive = credits.
// We want charges (spending), so convert negative to positive for storage.
```

The comment is correct but the function name `parseOFXAmount` and its minimal implementation suggest it's just a basic formatter. The comment doesn't explain WHY full-width normalization is NOT performed (unlike the web-side which does).

**Fix:** Add comment explaining the parity gap with web-side: `// NOTE: Unlike web-side parseAmountString, this minimal version does not handle full-width digits.`

---

### [C20-DOC03-LOW] isValidAmount comment is misleading

**Files:** `apps/web/src/lib/parser/csv.ts:169-170`
**Confidence:** High

```ts
// Skip zero-amount rows (balance inquiries) but accept negative amounts
// (refunds/credits) by letting callers take absolute value (C100-02).
```

The comment says "accept negative amounts" but the code returns `true` for negatives, which are then skipped by the caller's `if (amount <= 0) continue;`. The amounts are NOT accepted.

**Fix:** Correct comment to: `// Skip zero and negative amounts. Refunds are filtered at the caller.`

---

## Previously Reported — Status

| ID | Description | Status |
|----|-------------|--------|
| F-DOC-01 | No API contract between parser and optimizer | **OPEN** |
| F-DOC-02 | Card rule YAML schema undocumented | **OPEN** |
| F-DOC-03 | No architecture documentation | **OPEN** |

---

## Verdict

**FIX AND SHIP** — C20-DOC03 is a one-line comment fix. C20-DOC01 requires extracting shared documentation.
