# Cycle 4 Comprehensive Review -- 2026-04-22

Full re-read of all source files across packages/core, packages/parser, packages/rules, packages/viz, apps/web, tools/cli, tools/scraper. Verification of prior cycle fixes, search for new issues, and cross-file interaction analysis.

**Searches performed:** `classList.add/remove/toggle/contains`, `document.getElementById/querySelector`, `innerHTML/outerHTML`, `as any`, `catch {`, `console.log/warn/error`, `window.`

---

## Verification of Prior Cycle Fixes

| Finding | Status | Evidence |
|---|---|---|
| C91-01 | **CONFIRMED FIXED** | `SavingsComparison.svelte:242` -- `formatSavingsValue(displayedSavings, opt.savingsVsSingleCard)` uses unconditional `Math.abs()` |
| C93-01 | **CONFIRMED FIXED** | `ReportContent.svelte:80,116` -- `{@const}` is now a direct child of `{#each}` blocks |
| C92-01 | **CONFIRMED FIXED** | `formatSavingsValue()` in `formatters.ts:215-218` now centralizes sign-prefix logic. All three components (SavingsComparison:242, VisibilityToggle:97, ReportContent:48) use it. Triplication resolved. |
| C94-01 | **CONFIRMED FIXED** | `formatSavingsValue()` uses unconditional `Math.abs(value)` (formatters.ts:217), so the style inconsistency is eliminated. |
| C89-01 | **CONFIRMED OPEN (LOW)** | `VisibilityToggle.svelte:70-71` forward-direction `classList.toggle` has no `isConnected` guard. Cleanup at lines 123-124 has guard. |
| C89-02 | **CONFIRMED OPEN (LOW)** | `CategoryBreakdown.svelte:129` `rawPct < 2` threshold uses unrounded value. |
| C89-03 | **CONFIRMED OPEN (LOW)** | `formatters.ts:155-157` `m!` non-null assertion after length check. |
| C90-02 | **CONFIRMED OPEN (LOW)** | KakaoBank issuer badge `#fee500` (yellow) on white text fails WCAG AA. |
| C92-02 | **CONFIRMED OPEN (LOW)** | `ALL_BANKS` in FileDropzone.svelte:80-105 is the 5th copy of the bank list. |

---

## New Findings (This Cycle)

After thorough re-reading of all source files, targeted grep sweeps, and cross-file interaction analysis, no new HIGH or MEDIUM severity issues were found.

| ID | Severity | Confidence | File | Description |
|---|---|---|---|---|
| C4-01 | LOW | LOW | `store.svelte.ts:318` | Bare `catch {}` in loadFromStorage() silently swallows all errors including unexpected ones. The inner catch at line 319-327 logs some failures but the outer catch at line 318 does not. This is a known pattern (also present in FileDropzone:257, SpendingSummary:37, CardDetail:32, TransactionReview:104) for expected DOMExceptions in SSR/sandboxed environments. The pattern is consistent and documented. Not a new finding per se, but noting that the codebase has 7 bare catch blocks, all in expected-failure contexts (sessionStorage access, Astro navigation). |

---

## Cross-File Interaction Analysis

### formatSavingsValue centralization (C92-01 resolution verified)

The `formatSavingsValue(value, prefixValue?)` helper in `formatters.ts:215-218` is now used by all three components that previously had triplicated savings sign-prefix logic:

1. **SavingsComparison.svelte:242** -- `formatSavingsValue(displayedSavings, opt.savingsVsSingleCard)` -- passes animated value as `value` and final target as `prefixValue` to prevent '+' prefix flicker during animation.
2. **VisibilityToggle.svelte:97** -- `formatSavingsValue(opt.savingsVsSingleCard)` -- single argument, uses final value for both prefix and magnitude.
3. **ReportContent.svelte:48** -- `formatSavingsValue(opt.savingsVsSingleCard)` -- same single-argument pattern as VisibilityToggle.

This is correct and consistent. The `prefixValue` parameter was specifically designed for the animated case in SavingsComparison (C82-03/C84-01).

### Data flow: parseFile -> analyzeMultipleFiles -> optimizeFromTransactions

Verified that the data flow from parsing through categorization to optimization is consistent:
- `parseFile()` returns `ParseResult` with `transactions: RawTransaction[]`
- `parseAndCategorize()` maps `RawTransaction[]` to `CategorizedTx[]` via `MerchantMatcher.match()`
- `optimizeFromTransactions()` converts `CategorizedTx[]` to `CategorizedTransaction[]` for the core optimizer
- Card rules are loaded once, cached, and validated before use

### sessionStorage persistence

The persistence layer (store.svelte.ts) correctly handles:
- Schema versioning with migrations (STORAGE_VERSION=1, MIGRATIONS={})
- Size limits (MAX_PERSIST_SIZE=4MB, transactions truncated first)
- Error discrimination (truncated/corrupted/error kinds)
- AbortError vs genuine failure distinction
- Version mismatch warnings without silent data deletion

---

## Security Scan Results

- **No XSS risk**: All dynamic content rendered through Svelte/Astro template syntax which auto-escapes. No `innerHTML` patterns found in source code (confirmed by grep).
- **No `as any` casts**: No `as any` type assertions found in apps/web/src (confirmed by grep).
- **No exposed secrets**: No API keys, tokens, or credentials found in source files.
- **7 bare `catch {}` blocks**: All in expected-failure contexts (sessionStorage, Astro navigation). Not security issues.

---

## Gate Status

| Gate | Status |
|---|---|
| `tsc --noEmit` (workspace) | PASS -- all 6 packages typecheck clean |
| `vitest` / `bun test` | PASS -- 195 tests across all packages |
| `astro check` | PASS -- 0 errors, 0 warnings, 0 hints |
| `turbo run build` | PASS -- 7 packages built successfully |
| `eslint` | N/A -- no eslint.config.js in repo |

---

## Summary

The codebase is in a healthy, stable state. Two previously-open LOW findings are now confirmed FIXED this cycle: C92-01 (savings sign-prefix triplication) and C94-01 (conditional vs unconditional Math.abs inconsistency) are both resolved by the centralized `formatSavingsValue()` helper. No new HIGH or MEDIUM findings this cycle. All remaining open items are LOW severity deferred issues that have been stable across many cycles.
