# Plan 61 — Medium Priority Fixes (Cycle 33)

**Source findings:** C33-F6 (type assertions), C33-F12 (missing tests), C33-F8 (mobile menu a11y), C33-F1 (CSP partial), C33-F4 (sessionStorage warning)
**Date:** 2026-05-06

---

## Task 1: Remove type assertions in store.svelte.ts filter callbacks [C33-F6]

**Finding:** C33-F6 — MEDIUM / High confidence
**File:** `apps/web/src/lib/store.svelte.ts:267,287,328`

### Problem
`as Record<string, unknown>` casts bypass TypeScript checking on external data.

### Implementation
1. Replace casts with runtime `typeof` guards already partially present
2. Lines 267, 287, 328

### Exit Criterion
- No `as Record<string, unknown>` on external data in filter callbacks
- TypeScript compiles
- Tests pass

---

## Task 2: Add test for getCalcFn unknown type [C33-F12]

**Finding:** C33-F12 — LOW / High confidence
**File:** `packages/core/src/calculator/reward.ts:108-111`

### Problem
No tests cover the default case.

### Implementation
1. Add test in `packages/core/__tests__/calculator.test.ts`

### Exit Criterion
- Test verifies behavior for unknown type

---

## Task 3: Add aria-pressed to theme toggle [C33-F8 partial]

**Finding:** C33-F8 — MEDIUM / High confidence
**File:** `apps/web/src/layouts/Layout.astro:89-100`

### Implementation
1. Add `aria-pressed` attribute synchronized with current theme

### Exit Criterion
- Screen readers announce theme state

---

## Task 4: Add sessionStorage security comment [C33-F4 partial]

**Finding:** C33-F4 — MEDIUM / High confidence
**File:** `apps/web/src/lib/store.svelte.ts:101-201`

### Implementation
1. Add prominent comment documenting that sessionStorage is plaintext and the mitigation strategy (truncation, validation)

### Exit Criterion
- Comment clearly documents security posture

---

## Task 5: Improve CSP where possible [C33-F1 partial]

**Finding:** C33-F1 — HIGH / High confidence
**File:** `apps/web/src/layouts/Layout.astro:50`

### Implementation
1. While full nonce-based CSP requires build-time changes, add `frame-ancestors 'none'` directive to the existing CSP
2. This provides clickjacking protection even with `unsafe-inline`

### Exit Criterion
- CSP string includes `frame-ancestors 'none'`

---

## Deferred Items

| Finding | Severity | Reason for deferral | Exit criterion |
|---------|----------|---------------------|----------------|
| C33-F2: Optimizer O(T²·C) | HIGH | Performance refactor requiring memoization redesign; affects core algorithm | Add memoized incremental reward tracking |
| C33-F7: Parser duplication | MEDIUM | Large refactor to extract shared package; risk of regression | Create `packages/parser-shared/` with shared logic |
| C33-F8: Mobile menu focus trap | MEDIUM | Requires JavaScript focus management in layout.js; non-trivial a11y implementation | Add focus trap + Escape handler + focus restoration |
| C33-F1: Full nonce-based CSP | HIGH | Requires build-time nonce generation and script tag injection | Implement nonce generation in Astro build |
| C33-F4: Full sessionStorage encryption | MEDIUM | Requires crypto key management design | Implement client-side encryption with derived key |

---

## Completion Tracking

| Task | Status | Commit |
|---|---|---|
| 1 | DONE | b8d3404 |
| 2 | DONE | 7d6c3eb |
| 3 | NOT DONE | — (deferred to C34) |
| 4 | DONE | b8d3404 |
| 5 | DONE | 653fab5 |
