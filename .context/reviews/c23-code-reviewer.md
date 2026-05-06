# Code Review — cherrypicker (Cycle 23)

**Reviewer:** code-reviewer
**Scope:** Full repository — correctness, maintainability, type safety
**Date:** 2026-05-05

---

## Summary

Cycle 22 fixed several issues (Korean regex, sessionStorage bytes, HTML tests). Cycle 23 review identifies a code quality regression in the HTML sanitizer, a parity gap between server and web normalizeHTML, and carry-over items from previous cycles.

---

## New Findings

### [C23-CR01-MEDIUM] normalizeHTML regex parity gap between server and web

**Files:** `apps/web/src/lib/parser/html.ts:40` vs `packages/parser/src/csv/shared.ts:191-192`
**Confidence:** High

The server-side `normalizeHTML` uses two explicit regexes for event handler removal:
```ts
.replace(/\son\w+=["'][^"']*["']/gi, '')  // quoted
.replace(/\son\w+=\w+/gi, '')             // unquoted
```

The web-side uses a single regex:
```ts
.replace(/\son\w+=[^>\s]*/gi, '')
```

This is less maintainable (two divergent implementations of the same function) and less correct (the web version fails on spaces in quoted values, see C23-SEC01).

**Fix:** The web-side should import `normalizeHTML` from a shared location instead of redefining it. The server-side already exports it from `packages/parser/src/csv/shared.ts`. The web-side `html.ts` should import it instead of defining its own copy.

---

### [C23-CR02-LOW] JSON parser allows negative amounts to propagate

**Files:** `apps/web/src/lib/parser/json.ts:98-100`
**Confidence:** High

```ts
// Skip zero amounts (balance inquiries). Negative amounts (refunds/credits)
// are preserved — the optimizer's positive-only filter handles them.
if (amount === 0) return null;
```

Negative amounts are passed through to the transaction stream, relying on the optimizer's filter to exclude them. This is the same pattern as C22-CR03. The server-side JSON parser (if it exists) should be checked for parity.

**Fix:** Either reject negative amounts at parse time (matching CSV/XLSX behavior) or document why JSON is different. Ensure parity with server-side.

---

## Carry-overs from Previous Cycles

| ID | Description | Severity | Status |
|----|-------------|----------|--------|
| C22-CR03 | Negative amounts rely on optimizer filter | LOW | **OPEN** — same pattern in json.ts |
| C22-ARCH01 | normalizeHTML duplicated web-side | LOW | **OPEN** — now also causes security regression |

---

## Verdict

**FIX AND SHIP** — C23-CR01 is the most actionable. Unifying normalizeHTML fixes both the code quality issue and the security regression.
