# Designer Review — CherryPicker Web Frontend (Cycle 40)

**Reviewer:** designer
**Scope:** UI/UX, visual design, accessibility
**Date:** 2026-05-06

---

## Summary

No new UI components or visual changes in Cycle 40. One UX issue identified: error messages from the calculator NaN guard leak internal implementation details to the user.

| Category | Count | Severity |
|---|---|---|
| New Findings | 1 | Low |
| Carryover | 26 | — |

---

## NEW FINDINGS

### U-DES-40-01: Calculator Error Message Leaks Implementation Detail
**File:** `packages/core/src/calculator/reward.ts:190-193`
**Severity:** Low | **Confidence:** High

```typescript
throw new Error(
  `previousMonthSpending must be a non-negative finite number, got ${previousMonthSpending}`
);
```

This English error message with a parameter name (`previousMonthSpending`) bubbles up to the UI as `error = e instanceof Error ? e.message : '재계산 중 문제가 생겼어요'`. Users see a developer-facing message instead of a Korean UX-appropriate message.

**Fix:** Either catch and translate the error in `store.svelte.ts` / `analyzer.ts`, or use a typed error with a Korean-friendly `message` field.

---

## CARRYOVER

See Cycle 32 designer review for the complete list of 26 open findings. Key high-priority carryovers:

| Priority | Finding | File |
|----------|---------|------|
| High | 2.1 — KB issuer badge contrast | `formatters.ts:150` |
| High | 2.2 — Rate bars too thin | `OptimalCardMap.svelte:125` |
| High | 2.5 — Hover tooltip not touch-friendly | `CategoryBreakdown.svelte:201` |
| High | 3.1 — Tables on mobile | Multiple |
| High | 1.1 — Hardcoded colors bypass tokens | Multiple |
| Medium | U-DES-37-01 | All parsers | No feedback when transactions filtered |
| Medium | U-DES-37-02 | `store.svelte.ts` | Parse errors not differentiated by file |
