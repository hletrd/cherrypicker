# Comprehensive Code Review -- Cycle 36

**Date:** 2026-04-19
**Reviewer:** Multi-angle comprehensive review (cycle 36)
**Scope:** Full repository -- all packages, apps, and shared code
**Angles covered:** code quality, correctness, performance, security, UI/UX, architecture, test coverage

---

## Methodology

Read every source file in the repository (40+ source files across packages/core, packages/parser, packages/rules, packages/viz, tools/cli, tools/scraper, apps/web). Cross-referenced with prior cycle 1-35 reviews. Verified that all prior cycle 35 findings (C35-01 through C35-05) are already fixed in the current codebase. Ran `bun test` (266 pass, 0 fail). Focused on finding genuinely NEW issues not previously reported, with particular attention to:

1. Cross-file consistency between server-side and web-side parsers (especially `parseAmount` and `installments` handling)
2. Installment field semantic consistency across all parsers
3. Numeric precision in XLSX parsing (rounding of Won amounts)
4. Error handling and edge cases in the reward calculation pipeline
5. UI state management correctness

---

## Verification of Cycle 35 Findings

| Finding | Status | Evidence |
|---|---|---|
| C35-01 | **FIXED** | `packages/parser/src/csv/generic.ts:42-116` now has full month/day range validation on all date format branches |
| C35-02 | **FIXED** | `packages/parser/src/pdf/llm-fallback.ts:74-109` now uses greedy match with progressive fallback |
| C35-03 | **DEFERRED** | Known algorithmic limitation -- deferred per cycle 35 plan |
| C35-04 | **FIXED** | `packages/parser/src/csv/generic.ts:76` now has `.padStart(2, '0')` on short-year branch |
| C35-05 | **FIXED** | Short-year branch now has range validation (part of C35-01 fix) |

---

## New Findings

### C36-01: Web generic CSV parser uses `inst > 0` for installment check instead of `inst > 1`

- **Severity:** MEDIUM (correctness)
- **Confidence:** High
- **File:** `apps/web/src/lib/parser/csv.ts:258`
- **Description:** The web-side generic CSV parser's installment check uses `inst > 0`, while ALL other 22+ parsers (10 bank-specific adapters in `apps/web/src/lib/parser/csv.ts`, 10 bank-specific adapters in `packages/parser/src/csv/`, the generic server-side adapter in `packages/parser/src/csv/generic.ts`, and both PDF parsers) use `inst > 1`. The semantic convention across the entire codebase is that `installments` should only be set when the value is > 1 (lump-sum/일시불 transactions with installment=1 should NOT have the field set). This is explicitly documented in `packages/parser/src/pdf/llm-fallback.ts:22`: "If installment is 1 or 일시불, omit the installments field".

  The web-side generic CSV parser is the ONLY parser that uses `inst > 0`. This means a CSV from an unrecognized bank with an installment value of 1 (lump sum) would incorrectly set `tx.installments = 1` in the web generic path, while the same CSV parsed server-side would correctly omit the field.

- **Failure scenario:** A user uploads a CSV from an unrecognized bank where the installment column contains "1" (일시불). The web-side generic parser sets `installments: 1` on the transaction. Downstream code in the reward calculator at `packages/core/src/calculator/reward.ts:121` checks `tx.installments > 1`, so the erroneous `installments: 1` would not directly affect reward calculation. However, the UI in `TransactionReview.svelte` and other display components would show "1개월 할부" for what should be a lump-sum transaction, confusing the user. Additionally, the `CategorizedTx` type definition includes installments as optional, and the web analyzer at `analyzer.ts:119` copies it through, perpetuating the incorrect value.

- **Fix:** Change `inst > 0` to `inst > 1` at `apps/web/src/lib/parser/csv.ts:258` to match all other parsers.

### C36-02: Server-side XLSX `parseAmount` does not round numeric values to integers

- **Severity:** LOW (correctness)
- **Confidence:** High
- **File:** `packages/parser/src/xlsx/index.ts:125`
- **Description:** The server-side XLSX parser's `parseAmount` returns raw numeric values without rounding: `Number.isFinite(raw) ? raw : null`. The web-side equivalent at `apps/web/src/lib/parser/xlsx.ts:286` explicitly rounds: `Number.isFinite(raw) ? Math.round(raw) : null`, with a comment explaining: "Korean Won amounts must be integers -- round to prevent decimal values (e.g., from formula cells) from polluting reward math."

  Excel cells can contain formula-derived values with floating-point precision artifacts (e.g., `=SUM(A1:A10)` might produce `12345.000000000002`). The server-side parser would pass this through as a non-integer Won amount, while the web-side parser correctly rounds it.

  The impact is mitigated by the reward calculator using `Math.floor(amount * rate)` which would absorb minor floating-point noise, and `calculateFixedReward` uses `Math.floor(tx.amount / 1500)`. However, the `RawTransaction.amount` type is documented as `number` in Won with the convention that all amounts are integers (per CLAUDE.md: "All amounts in Korean Won (integer, no decimals)"). A non-integer amount violates this invariant.

- **Failure scenario:** An XLSX file from a Korean card company contains a formula cell that produces an amount like `15000.000000000002` due to floating-point arithmetic. The server-side parser produces a transaction with `amount: 15000.000000000002`. The reward calculator's `Math.floor(15000.000000000002 * 0.05)` = `Math.floor(750.0000000000001)` = `750`, which is correct in this case. However, if the formula produces `14999.999999999998`, `Math.floor(14999.999999999998 * 0.05)` = `Math.floor(749.999999999999)` = `749` instead of the expected `750`. The rounding would prevent this class of errors.

- **Fix:** Add `Math.round(raw)` to the server-side XLSX `parseAmount` at `packages/parser/src/xlsx/index.ts:125`, matching the web-side implementation.

---

## Final Sweep -- Cross-File Interactions

1. **All prior findings confirmed fixed:** C35-01 through C35-05 (except C35-03 which is deferred) are verified as resolved in the current codebase.

2. **Installment handling consistency audit:** I verified all 22+ installment parsing locations:
   - 10 bank-specific adapters in `apps/web/src/lib/parser/csv.ts` -- all use `inst > 1` (correct)
   - 10 bank-specific adapters in `packages/parser/src/csv/` -- all use `inst > 1` (correct)
   - `packages/parser/src/csv/generic.ts:247` -- uses `inst > 1` (correct)
   - `packages/parser/src/pdf/index.ts:157` -- uses `inst > 1` (correct)
   - `apps/web/src/lib/parser/pdf.ts:276` -- uses `inst > 1` (correct)
   - `apps/web/src/lib/parser/csv.ts:258` (generic) -- uses `inst > 0` **(BUG -- C36-01)**
   - `apps/web/src/lib/parser/xlsx.ts:304` -- uses `inst > 1` (correct)
   - `packages/parser/src/xlsx/index.ts:140` -- uses `inst > 1` (correct)

3. **parseAmount consistency audit (XLSX numeric handling):**
   - Web XLSX: `Math.round(raw)` -- correctly rounds (line 286)
   - Server XLSX: `raw` (no rounding) **(BUG -- C36-02)**
   - All CSV parsers: use `parseInt` which truncates to integers (correct)

4. **Date validation consistency audit:** All parseDateToISO implementations now have range validation. No regressions found.

5. **Deferred items unchanged:** D-01 through D-105 (plus C35-03) remain unchanged from prior cycles.

6. **`cachedCoreRules` module-level cache:** Still present in `analyzer.ts:47`. Intentionally never invalidated since `cards.json` static data never changes within a session. Not a bug.

7. **AI categorizer disabled:** `categorizer-ai.ts` correctly stubs all methods to throw. `TransactionReview.svelte` checks `aiAvailable` before showing the AI button. No dead-code path issues.

8. **E2E test isolation:** `bunfig.toml` correctly excludes `e2e/**` from `bun test`. Confirmed working.

9. **Report HTML generator** (`packages/viz/src/report/generator.ts`): Uses `esc()` for HTML escaping of user-provided strings. The savings sign prefix (line 36) correctly prepends "+" for non-negative savings. No issues found.

10. **LLM fallback security:** The `ANTHROPIC_API_KEY` is read from `process.env` and only used server-side. The browser guard (`typeof window !== 'undefined'`) prevents client-side execution. The 30-second timeout and text truncation (8000 chars) are reasonable safeguards. No new security issues found.

11. **SessionStorage persistence:** The 4MB limit with transaction truncation fallback is well-implemented. The validation on load (`isValidTx`) correctly filters corrupted entries. No issues found.

12. **SavingsComparison.svelte count-up animation:** The `$effect` correctly returns a cleanup function that cancels the animation frame. No memory leak.

---

## Summary of Active Findings (New in Cycle 36)

| ID | Severity | Confidence | File | Description |
|---|---|---|---|---|
| C36-01 | MEDIUM | High | `apps/web/src/lib/parser/csv.ts:258` | Web generic CSV parser uses `inst > 0` instead of `inst > 1` for installment check -- inconsistent with all 22+ other parsers, causes incorrect `installments: 1` on lump-sum transactions |
| C36-02 | LOW | High | `packages/parser/src/xlsx/index.ts:125` | Server-side XLSX `parseAmount` does not round numeric values to integers -- can produce non-integer Won amounts from formula cells, unlike the web-side version which uses `Math.round()` |
