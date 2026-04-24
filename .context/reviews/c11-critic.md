# Cycle 11 — Critic (Multi-Perspective)

Date: 2026-04-24

## Findings

### C11-CR01: `formatSavingsValue` uses `Math.abs(value)` unconditionally — sign information is always stripped
- **File:** `apps/web/src/lib/formatters.ts:226`
- **Severity:** LOW
- **Confidence:** Medium
- **Description:** The function always calls `formatWon(Math.abs(value))`, which strips the sign. The caller is expected to provide context ("추가 절약" vs "추가 비용") to convey direction. If a future caller passes a negative value without providing the appropriate label context, the user would see a positive amount that contradicts the semantics. This is documented behavior, but worth noting as a footgun.
- **Failure scenario:** Future developer calls `formatSavingsValue(-5000)` without wrapping it in a "추가 비용" label — user sees "5,000원" which looks like savings.
- **Fix:** Consider adding a `direction` parameter or returning an object with `{ formatted, isNegative }` to make the API harder to misuse.

### C11-CR02: `store.svelte.ts` persistToStorage has inconsistent error categorization
- **File:** `apps/web/src/lib/store.svelte.ts:176-190`
- **Severity:** LOW
- **Confidence:** Low
- **Description:** When `JSON.stringify` throws a circular reference error, the code returns `{ kind: 'error', ... }`. But when `sessionStorage.setItem` throws `QuotaExceededError`, it returns `{ kind: 'corrupted', ... }`. The term "corrupted" is misleading for a quota error — the data isn't corrupted, it's just too large. The naming could confuse future maintainers.
- **Failure scenario:** Developer reading the code assumes "corrupted" means data integrity loss, not quota limit.
- **Fix:** Rename to `quota_exceeded` or `too_large` for clarity. Very low priority.

## Convergence

- No new HIGH or MEDIUM findings from a multi-perspective critique.
- The codebase is in a mature state with extensive defensive coding and inline documentation of design decisions.
- Prior cycle fixes (C9-06, C9-07, C8-02) remain intact and correct.

## Final sweep

Examined: error handling paths, state management invariants, API surface consistency, naming clarity. No critical issues found.
