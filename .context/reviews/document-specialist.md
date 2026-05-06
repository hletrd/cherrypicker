# Documentation Review — CherryPicker Cycle 37

**Reviewer:** document-specialist
**Scope:** README, inline comments, JSDoc, type annotations, cross-file consistency
**Date:** 2026-05-06

---

## Summary

Cycle 37 added substantial inline documentation for the new parsers (HTML, OFX, JSON). JSDoc quality on new modules is above average. However, the cycle-reference convention continues to expand, and README accuracy issues from Cycle 32 remain unaddressed.

| Category | Count | Severity |
|---|---|---|
| New Findings | 2 | 1 Medium, 1 Low |
| Carryover (still open) | 6 | — |
| Positive Findings | 3 | — |

---

## NEW FINDINGS (Cycle 37)

### DOC-37-01: Inaccurate JSDoc Claim in `parseOFXDate`
**File:** `packages/parser/src/ofx/index.ts:85-86`, `apps/web/src/lib/parser/ofx.ts:54-55`
**Severity:** Medium | **Confidence:** High

```typescript
// The KST conversion works by computing UTC ms, adding 9 hours, then reading
// back with getUTC* — which yields KST values because the Date is shifted +9h.
```

This comment is misleading. `getUTC*` methods always return UTC values, not KST values. The code happens to produce the correct calendar date because the timezone conversion math cancels out in a specific way, but `getUTCFullYear()` does not "yield KST values." A future maintainer might "fix" this comment into a real bug.

**Fix:** Rewrite the comment to explain the actual math:
```typescript
// Convert OFX local time to UTC (subtract offset), then to KST calendar date
// (add 9h). Using getUTC* on the shifted Date gives the KST calendar date.
```

---

### DOC-37-02: Missing `@throws` Documentation on New Parsers
**File:** `packages/parser/src/html/index.ts`, `packages/parser/src/ofx/index.ts`, `packages/parser/src/json/index.ts`
**Severity:** Low | **Confidence:** Medium

None of the new parser entry functions (`parseHTML`, `parseOFX`, `parseJSON`) document their error behavior. `parseHTML` can throw if SheetJS fails; `parseOFX` and `parseJSON` do not throw but return `ParseError` objects in the `errors` array. This distinction is not documented.

**Fix:** Add JSDoc `@returns` blocks describing the `errors` array contents for each parser.

---

## CARRYOVER (still open from prior cycles)

| ID | Severity | File | Description |
|----|----------|------|-------------|
| DOC-01 | High | `README.md:82` | Stale "TypeScript 6" claim |
| DOC-02 | High | `README.md:79` | Card count inconsistency (561 vs 683) |
| DOC-03 | Medium | `README.md:34` | AI classification wording contradicts actual state |
| DOC-04 | Medium | `packages/rules/src/index.ts` | Missing module-level JSDoc |
| DOC-05 | Medium | `greedy.ts` | Internal functions undocumented |
| DOC-06 | Medium | Pervasive | Cycle-reference convention creates maintenance burden |

---

## Positive Findings

### P1. Excellent JSDoc on OFX Parser
**File:** `packages/parser/src/ofx/index.ts:1-16`

The module-level comment clearly explains:
- OFX 1.x vs 2.x format differences
- SGML vs XML tag styles with concrete examples
- Scope (bank + credit card statements)

### P2. JSON Parser Alias Lists Are Self-Documenting
**File:** `packages/parser/src/json/index.ts:14-63`

The alias arrays include both English and Korean field names with clear grouping. The comment at line 55-57 explains the `description` fallback behavior in `MEMO_ALIASES`.

### P3. HTML Parser Forward-Fill Rationale Is Well-Documented
**File:** `packages/parser/src/html/index.ts:135-138`, `apps/web/src/lib/parser/html.ts:152-153`

Comments explain WHY forward-fill exists (Korean bank HTML exports merge cells) and reference the matching server-side logic.

---

## Recommendations

1. Fix README accuracy issues (DOC-01, DOC-02) — these are user-facing and erode trust.
2. Correct the misleading `parseOFXDate` comment (DOC-37-01) before it causes a bug.
3. Document error behavior for all new parser entry points.
4. Consider creating a `docs/cycle-references.md` index or removing references older than Cycle 20.
