# Plan 60 — High Priority Fixes (Cycle 33)

**Source findings:** C33-F9 (security headers), C33-F3 (LLM sanitization), C33-F10 (previousMonthSpending negative), C33-F11 (HTML sanitization), C33-F5 (getCalcFn default), C33-F13 (Blob→TextEncoder)
**Date:** 2026-05-06

---

## Task 1: Add missing security headers to Layout.astro [C33-F9]

**Finding:** C33-F9 — MEDIUM / High confidence
**File:** `apps/web/src/layouts/Layout.astro`

### Problem
No `X-Frame-Options`, `X-Content-Type-Options`, or `Referrer-Policy` headers present.

### Implementation
1. Add `<meta http-equiv="X-Frame-Options" content="DENY" />`
2. Add `<meta http-equiv="X-Content-Type-Options" content="nosniff" />`
3. Verify `Referrer-Policy` is already present (strict-origin-when-cross-origin)

### Exit Criterion
- Security headers present in rendered HTML
- No layout regressions

---

## Task 2: Sanitize LLM fallback inputs against prompt injection [C33-F3]

**Finding:** C33-F3 — MEDIUM / High confidence
**File:** `packages/parser/src/pdf/llm-fallback.ts`

### Problem
Raw PDF text is interpolated directly into the LLM user message without sanitization.

### Implementation
1. Before interpolating `truncated`, run it through a sanitization function that removes or escapes patterns like:
   - `Ignore previous instructions`
   - `Forget your instructions`
   - `You are now...`
   - XML tag-like injection patterns
2. Add the sanitization as a pure function in `llm-fallback.ts`

### Exit Criterion
- Crafted PDF with injection text is sanitized before reaching LLM
- Existing legitimate PDFs still parse correctly
- Test added for injection sanitization

---

## Task 3: Reject negative previousMonthSpending values [C33-F10]

**Finding:** C33-F10 — LOW / Medium confidence
**File:** `apps/web/src/lib/store.svelte.ts:567`

### Problem
`Number.isFinite(options.previousMonthSpending)` allows negative values.

### Implementation
1. Change line 567 from:
   ```typescript
   if (options?.previousMonthSpending !== undefined && Number.isFinite(options.previousMonthSpending)) {
   ```
   to:
   ```typescript
   if (options?.previousMonthSpending !== undefined && Number.isFinite(options.previousMonthSpending) && options.previousMonthSpending >= 0) {
   ```

### Exit Criterion
- Negative values are rejected
- Zero and positive values pass through
- Test verifies rejection

---

## Task 4: Fix HTML sanitization regex for nested script tags [C33-F11]

**Finding:** C33-F11 — LOW / Medium confidence
**File:** `apps/web/src/lib/parser/html.ts:32`

### Problem
`/<script[\s\S]*?<\/script>/gi` stops at first closing tag, missing nested scripts.

### Implementation
1. Run the regex in a loop until no more matches
2. Or use a more robust pattern

### Exit Criterion
- Nested script tags are fully stripped
- Existing tests pass

---

## Task 5: Throw on unknown reward types in getCalcFn [C33-F5]

**Finding:** C33-F5 — MEDIUM / High confidence
**File:** `packages/core/src/calculator/reward.ts:108-111`

### Problem
Unknown types silently default to `calculateDiscount`.

### Implementation
1. Replace default case with `throw new Error(`Unknown reward type: ${type}`)`
2. Or add runtime validation in rule loader

### Exit Criterion
- Unknown reward types throw instead of silently defaulting
- All existing card rules use valid types (verified by tests)
- New test covers unknown type behavior

---

## Task 6: Replace Blob with TextEncoder for size calculation [C33-F13]

**Finding:** C33-F13 — LOW / Medium confidence
**File:** `apps/web/src/lib/store.svelte.ts:170`

### Problem
`new Blob([serialized]).size` creates unnecessary Blob overhead.

### Implementation
1. Replace with `new TextEncoder().encode(serialized).length`

### Exit Criterion
- Size calculation is accurate
- No functional change
- Tests pass

---

## Completion Tracking

| Task | Status |
|---|---|
| 1 | pending |
| 2 | pending |
| 3 | pending |
| 4 | pending |
| 5 | pending |
| 6 | pending |
