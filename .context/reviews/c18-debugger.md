# Debugger — cherrypicker (Cycle 18)

**Reviewer:** debugger
**Scope:** Root-cause analysis, edge cases, failure modes, latent bugs
**Date:** 2026-05-06

---

## Summary

Prior failure modes (FileDropzone ReferenceError, PDF non-null assertion, OFX timezone, HTML forward-fill) are all resolved. The persistence layer (`loadFromStorage`) has robust validation and migration support. No new critical failure modes were found. One edge case in the optimizer's rate recalculation and a minor persistence callback type issue were identified.

---

## New Findings

### C18-DB01 [LOW] — `buildAssignments` rate recalculation divides by zero on empty spending

**File:** `packages/core/src/optimizer/greedy.ts:86`
**Confidence:** Medium

```ts
current.rate = current.spending > 0 ? current.reward / current.spending : 0;
```

The guard prevents division by zero, but the resulting rate of `0` may be misleading when the first transaction in a category is a refund (negative amount) followed by positive transactions. In practice, the optimizer pre-filters positive amounts at line 198, so this path is unreachable. However, if `buildAssignments` is ever called with unfiltered data (e.g., from a test or future code path), the rate would be silently clamped to 0 rather than surfacing the data quality issue.

**Fix:** Add a runtime assertion or comment documenting the pre-filter invariant. Consider making `buildAssignments` require a `precondition: all amounts > 0` in its docstring.

---

### C18-DB02 [LOW] — `loadFromStorage` `any` callbacks bypass TypeScript guard rails

**File:** `apps/web/src/lib/store.svelte.ts:247,286`
**Confidence:** Medium

Related to C18-CR01. The `any` types in `.filter()` and `.map()` callbacks mean TypeScript cannot detect if the property access patterns drift during refactors. For example, if `cardId` is renamed to `cardID` in the `CardRewardResult` type, the runtime check `typeof cr.cardId === 'string'` would silently fail (returning `false` for `undefined`) and strip all card results rather than producing a compile error.

**Fix:** Replace `any` with `unknown` and use user-defined type guards.

---

## Verified Fixed

| Finding | Status | Evidence |
|---------|--------|----------|
| D-DEB-01: FileDropzone ReferenceError | **FIXED** | `errorMessages` consistent throughout FileDropzone.svelte |
| D-DEB-02: PDF non-null assertion | **FIXED** | `packages/parser/src/pdf/index.ts:358` uses nullish coalescing chain |
| D-DEB-03: OFX timezone strip | **FIXED** | `parseOFXDate` captures timezone offset and converts to KST |
| D-DEB-04: AbortController timeout | **FIXED** | `finally` block clears timeout in llm-fallback.ts |
| D-DEB-05: HTML forward-fill mutation | **FIXED** | Current code reads from `rows[i]` but never writes back; uses local `last*` variables |

---

## Verdict

**STABLE** — No critical new failure modes. C18-DB01 and C18-DB02 are preventive maintenance items.
