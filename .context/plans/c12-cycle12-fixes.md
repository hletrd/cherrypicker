# Cycle 12 Implementation Plan (2026-05-05)

**Date:** 2026-05-05
**Based on:** `.context/reviews/_aggregate.md` (cycle 12 multi-agent review, current)

---

## Verification: All HIGH/MEDIUM findings already fixed

After code inspection, the following cycle 12 findings are **already addressed** in the current codebase:

| Finding | Severity | Status | Evidence |
|---------|----------|--------|----------|
| C12-01 | HIGH | **FIXED** | `adapter-factory.ts:154-160` reports unparseable dates via `isValidISODate` + error push |
| C12-06 | MEDIUM | **FIXED** | Same code block as C12-01 — `isValidISODate` validation present |
| C12-02 | MEDIUM | **FIXED** | Web XLSX imports shared `findColumn` from `column-matcher` (line 7, 485-493) |
| C12-04 | Low-Medium | **FIXED** | `DATE_PATTERNS` in `generic.ts:25-26` already uses `[\s]*` around delimiters |
| T12-01 | HIGH | **FIXED** | `column-matcher.test.ts` exists with 2548 lines of comprehensive tests |
| T12-02 | MEDIUM | **FIXED** | `csv.test.ts` and `csv-adapters.test.ts` contain `isDateLike`/`isAmountLike` tests |
| C12-DB03 | LOW | **FALSE POSITIVE** | `fallbackDatePattern` has outer capture group; `dateMatch[1] == dateMatch[0]` |

---

## Remaining actionable items (all LOW)

### Deferred to future cycles

| Finding | Severity | Reason |
|---------|----------|--------|
| T12-03 | LOW | No test for XLSX formula error cells — deferred: requires SheetJS formula error injection |
| T12-04 | LOW | No test for PDF multi-line cell content — deferred: requires complex PDF fixture |
| C12-UX01 | LOW | CategoryBreakdown mobile affordance — deferred: minor UX polish |
| C12-UX02 | LOW | SpendingSummary focus ring — deferred: minor UX polish |
| C12-UX04 | LOW | TransactionReview scroll indicator — deferred: minor UX polish |
| C12-DS01 | MEDIUM | README MIT vs LICENSE Apache 2.0 — already deferred as D-02 |

---

## Plan Tasks

### Task 1: Update deferred items ledger [DONE]
- Record cycle 12 false positive (C12-DB03) and deferred items.

### Task 2: Commit reviews and aggregate [PENDING]
- Files: `.context/reviews/c12-*.md`, `.context/reviews/_aggregate.md`, `.context/plans/c12-cycle12-fixes.md`
- Commit: `docs(reviews): cycle 12 multi-agent reviews, aggregate, and plan`

### Task 3: Run quality gates [PENDING]
- `bun test` in packages/parser
- `npm run lint`
- `npm run typecheck`
- `bun run test` (vitest)

---

## Overall Assessment

Cycle 12 is a **convergence cycle**. All HIGH and MEDIUM findings from the review are already implemented in the codebase. The remaining items are all LOW-severity and properly deferred.
