# Code Reviewer — Cycle 13 (2026-04-24)

## Scope
Full repository: packages/core, packages/parser, packages/rules, packages/viz, apps/web, tools

## Summary
After 12+ prior multi-agent review cycles, the codebase has reached strong convergence. No HIGH findings remain. Re-examining all source files from scratch confirms that previously identified systemic patterns (hardcoded taxonomy duplicates C7-01/C7-02/C9-01, duplicate parsers D-01, license mismatch D-02) remain the dominant MEDIUM-severity items — all deferred with clear exit criteria. No new HIGH or MEDIUM findings.

## New Findings

### C13-CR01: `findRule` skips wildcard rules when `tx.subcategory` is set but `rule.subcategory` is not
- **Severity:** LOW
- **Confidence:** Low
- **File:** `packages/core/src/calculator/reward.ts:81`
- **Detail:** The guard `if (tx.subcategory && !rule.subcategory && rule.category !== '*') return false;` means a broad-category rule (e.g., `category: 'dining'` with no subcategory) never matches a `dining.cafe` transaction — correct for Korean card terms. However, a wildcard rule (`category: '*'`) explicitly bypasses this guard. If a card has both a wildcard rule and a broad-category rule for the same transaction, the wildcard may match but the broad-category rule won't, which is correct behavior but the asymmetry is not documented. The TODO at line 79-80 already covers the `includeSubcategories` extension.
- **Fix:** Add a comment clarifying the wildcard exemption's intent at line 81.

### C13-CR02: `formatSavingsValue` prefix logic tied to magnitude threshold
- **Severity:** LOW
- **Confidence:** Low
- **File:** `apps/web/src/lib/formatters.ts:224-227`
- **Detail:** The `prefixValue >= 100` threshold for showing '+' prefix means that during count-up animation, the '+' appears/disappears mid-animation if the target crosses 100 won. This is a minor visual artifact that has been noted before (C82-03) and the current behavior is intentional — the prefix is stable once animation completes.

## Re-confirmed Findings (no change from prior cycles)
- C7-01 (CATEGORY_NAMES_KO drift): MEDIUM — confirmed, deferred, exit criterion unchanged
- C7-02 (FALLBACK_CATEGORY_LABELS duplicate): LOW — confirmed, deferred
- C9-01 (CATEGORY_COLORS fourth duplicate): MEDIUM — confirmed, deferred
- D-01 (duplicate parsers): MEDIUM — confirmed, deferred
- D-02 (license mismatch): MEDIUM — confirmed, deferred

## Gate Evidence
- `npm run lint` — PASS
- `npm run typecheck` — PASS
- `bun run test` — PASS (FULL TURBO)
