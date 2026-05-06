# Cycle 27 — Test Engineer Review

## Summary
Test coverage is generally good for server-side parsers but gaps remain in web-side parsers, particularly for XLSX forward-fill edge cases and summary row handling.

---

## MEDIUM: No tests for XLSX forward-fill reset on summary rows

**Files:** `packages/parser/__tests__/xlsx.test.ts`, `apps/web/__tests__/` (no xlsx tests)
**Confidence:** High

The XLSX parsers in both server and web lack tests for the forward-fill reset behavior when summary rows appear between data groups. The HTML parser tests were added for this scenario (C20-TEST03, C25-TEST01), but XLSX has no equivalent coverage.

**Missing tests:**
1. Server XLSX: A summary row between two data groups with merged cells should not corrupt forward-fill state
2. Web XLSX: Same scenario for browser-side parser
3. Both: Multi-table XLSX files where each table has its own summary row

---

## LOW: No tests for duplicate parseAmount in web csv.ts vs pdf.ts

**Files:** `apps/web/src/lib/parser/csv.ts`, `apps/web/src/lib/parser/pdf.ts`
**Confidence:** Medium

The two `parseAmount` implementations could drift over time. There's no test that verifies they produce identical output for the same inputs. A parity test would catch divergence.

---

## LOW: Missing test for reoptimize metadata consistency after C25-COR02 fix

**Files:** `apps/web/src/lib/store.svelte.ts`
**Confidence:** Medium

The `reoptimize()` function now recomputes `transactionCount`, `totalTransactionCount`, `statementPeriod`, and `fullStatementPeriod` from edited transactions (C25-COR02). There's no automated test verifying this behavior. The cycle 25 plan noted this as potentially deferred due to complex mocking requirements.

**Recommendation:** Add a focused unit test for `reoptimize` that mocks `optimizeFromTransactions` and `getCategoryLabels`, then verifies metadata fields are recomputed.
