# Comprehensive Code Review -- Cycle 6 (2026-04-20)

**Reviewer:** Full codebase deep review (cycle 6 of 100)
**Scope:** Full repository -- all packages, apps, and shared code (40+ source files)
**Angles covered:** code quality, correctness, performance, security, UI/UX, architecture, test coverage
**Gates:** lint (0 errors), typecheck (0 errors), test (266 pass, 0 fail), build (pending)

---

## Methodology

Read every source file in the repository end-to-end. Cross-referenced with prior cycle 1-53 reviews and the cycle 5 aggregate. Focused on finding genuinely NEW issues not previously reported.

Targeted searches performed:
1. Bare `catch {}` blocks -- 2 occurrences (both documented: D-106, store.svelte.ts:225 and SpendingSummary.svelte:130)
2. `as any` usage -- 0 occurrences in web app
3. `innerHTML` / XSS vectors -- none found
4. `localStorage` usage -- none found (all migrated to sessionStorage)
5. `window.` usage -- 9 occurrences, all safe (hash navigation, scroll, href)
6. `parseInt()` without radix -- none found (all use `parseInt(x, 10)`)
7. Negative-zero handling in formatters -- all guarded
8. `Number.isFinite` guards on numeric formatters -- all present
9. `console.log/debug/info` in web code -- none found (3 `console.warn` in build-stats.ts and csv.ts only)
10. CSP header -- present with documented `unsafe-inline` justification
11. `prefers-reduced-motion` -- handled in app.css
12. Skip-to-content link -- present in Layout.astro
13. ARIA roles on interactive elements -- all present and correct
14. AI categorizer -- properly disabled with safe stubs

---

## Verification of Prior Cycle Fixes (All Confirmed)

All prior findings confirmed fixed per cycle 5 aggregate verification table. No regressions detected.

---

## Cross-File Consistency Verification (Complete Inventory)

All cross-file consistency checks from cycle 5 still pass:
1. All `formatWon` implementations (4 total) -- consistent with `Number.isFinite` guard + negative-zero normalization
2. All `formatRate` implementations (5 total) -- consistent with `Number.isFinite` guard
3. All `parseDateToISO` implementations (3 total) -- consistent with range validation
4. All `inferYear` implementations (3 total) -- identical 90-day look-back heuristic
5. All `parseAmount` implementations (3 total) -- consistent with `Number.isNaN` checks
6. Global cap rollback logic in `reward.ts:316-317` -- correct
7. SessionStorage validation via `isValidTx` -- has both `Number.isFinite` and `> 0` checks
8. Optimizer greedy marginal scoring -- correct delta calculation
9. `cachedCoreRules` module-level cache -- intentionally never invalidated (static data)
10. C5-01 `parseInt` NaN guard -- confirmed fixed at SpendingSummary.svelte:119-121

---

## New Findings

### C6-01: `CategoryBreakdown.svelte:88-89` percentage rounding can push total above 100%

- **Severity:** LOW
- **Confidence:** MEDIUM
- **File:** `apps/web/src/components/dashboard/CategoryBreakdown.svelte:88-89`
- **Description:** Each category's percentage is computed as `Math.round((a.spending / totalSpending) * 1000) / 10` (one decimal place). When multiple categories round up, the displayed total can exceed 100%. For example, 3 categories each with 33.33% would each round to 33.3%, totaling 99.9% -- or if 33.35%, each rounds to 33.4%, totaling 100.2%. The "other" bucket absorbs the remainder, but the individually displayed percentages still may not sum to exactly 100%.
- **Failure scenario:** A user with exactly 3 equal spending categories sees 33.3% + 33.3% + 33.3% = 99.9%, which is slightly off. This is a display precision issue, not a correctness bug.
- **Fix:** Use a largest-remainder method to distribute rounding error, or display a note that percentages are approximate. Alternatively, compute the "other" percentage as `100 - sum(main)` instead of independently rounding it.
- **Status:** Same class as existing deferred finding C9-06/D-59/D-72. Not new -- already deferred.

### C6-02: `CardGrid.svelte:22` `availableIssuers` derived from fully-filtered list (re-confirmed)

- **Severity:** LOW
- **Confidence:** HIGH
- **File:** `apps/web/src/components/dashboard/CardGrid.svelte:22`
- **Description:** `availableIssuers` is derived from `filteredCards` (which applies type, issuer, and search filters), not from the type-only-filtered list. When a user selects an issuer filter, the other issuers disappear from the pill row. The existing `$effect` at line 27-30 resets `issuerFilter` when it becomes unavailable, which mitigates the worst case.
- **Status:** DUPLICATE of D-66. Already deferred.

### C6-03: `analyzer.ts:300` `tx.date.slice(0, 7)` without length guard

- **Severity:** LOW
- **Confidence:** MEDIUM
- **File:** `apps/web/src/lib/analyzer.ts:300`
- **Description:** In `analyzeMultipleFiles`, the monthly spending calculation does `tx.date.slice(0, 7)` to extract the YYYY-MM prefix. If a transaction has a malformed date string shorter than 7 characters (e.g., just "2026"), `slice(0, 7)` returns the whole string, producing an incorrect month key like "2026" instead of "2026-01". However, the `parseDateToISO` functions in all three parsers validate month/day ranges and produce full ISO dates, so in practice this should never happen with well-parsed data. The `isValidTx` check in store.svelte.ts also requires `tx.date.length > 0`, but doesn't validate the full ISO format.
- **Failure scenario:** If a user loads corrupted sessionStorage data with a transaction that has `date: "2026"`, the monthly breakdown would have an entry keyed by "2026" instead of "2026-XX", causing a display glitch in the SpendingSummary prevLabel computation.
- **Fix:** Add a length check: `const month = tx.date.length >= 7 ? tx.date.slice(0, 7) : null; if (month) { ... }`.

### C6-04: `store.svelte.ts:134-136` bare `catch {}` in persistToStorage silently swallows quota errors

- **Severity:** LOW
- **Confidence:** LOW
- **File:** `apps/web/src/lib/store.svelte.ts:134-136`
- **Description:** The `persistToStorage` function has a bare `catch {}` that sets `_persistWarningKind = 'corrupted'` but doesn't log or differentiate between different failure modes. If sessionStorage is unavailable (SSR) or the data is too large, the error is silently absorbed. However, the `_persistWarningKind` mechanism does inform the user via UI banners, so this is more of a code hygiene issue than a functional bug.
- **Status:** Already documented as D-106 variant. Not new.

### C6-05: `pdf.ts:284` bare `catch {}` in tryStructuredParse silently swallows all errors

- **Severity:** LOW
- **Confidence:** HIGH
- **File:** `apps/web/src/lib/parser/pdf.ts:284`
- **Description:** The `tryStructuredParse` function wraps its entire body in a try/catch that returns `null` on any error. This means if the structured parser encounters a bug (e.g., TypeError from unexpected data), the error is silently swallowed and the fallback parser is used instead. While this is intentional for resilience, it makes debugging PDF parsing issues difficult because errors are never surfaced.
- **Status:** Already documented as D-106. Not new.

---

## Summary of Genuinely New Findings (not already fixed or deferred)

| ID | Severity | Confidence | File | Description | Status |
|---|---|---|---|---|---|
| C6-03 | LOW | MEDIUM | `analyzer.ts:300` | `tx.date.slice(0, 7)` without length guard | NEW |

**Only 1 genuinely new finding this cycle: C6-03 (LOW/MEDIUM).**

---

## Still-Open Deferred Findings (carried forward, not new)

| Finding | Severity | Note |
|---|---|---|
| C4-06/C52-03/C9-02/D-40/D-82 | LOW | Annual savings projection label unchanged |
| C4-09/C52-05/D-42/D-46/D-64/D-78/D-96 | LOW | Hardcoded `CATEGORY_COLORS` in CategoryBreakdown (dark mode contrast) |
| C4-10 | MEDIUM | E2E test stale dist/ dependency |
| C4-11 | MEDIUM | No regression test for findCategory fuzzy match |
| C4-13/C9-08/D-43/D-74 | LOW | Small-percentage bars nearly invisible |
| C4-14/D-44 | LOW | Stale fallback values in Layout footer |
| C9-04/D-71 | LOW | Complex fallback date regex in PDF parser |
| C9-06/D-59/D-72 | LOW | Percentage rounding can shift "other" threshold |
| C9-07/D-73/D-89 | LOW | Math.max spread stack overflow risk (theoretical) |
| C9-09/D-07/D-54 | LOW | Categories cache never invalidated |
| C9-10/D-52/D-75 | LOW | HTML-as-XLS double-decode and unnecessary re-encode |
| C9-12/D-76 | LOW | Module-level cache persists across store resets |
| D-106 | LOW | `apps/web/src/lib/parser/pdf.ts:284` bare `catch {}` |
| D-110 | LOW | Non-latest month edits have no visible optimization effect |
| C3-01/C4-01 | LOW | `build-stats.ts:25` catch block misleading message (now more accurate after fix) |
| D-66 | LOW | CardGrid issuer filter shows issuers with 0 cards after type filter |
| D-01 through D-111 | Various | See deferred items file for full list |
