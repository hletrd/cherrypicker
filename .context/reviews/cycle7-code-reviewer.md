# Cycle 7 Code Review

**Date:** 2026-05-05
**Scope:** Post-Cycle-6 fixes — parser parity, category label extraction, CLI validation
**Reviewer:** code-reviewer

---

## Summary

Cycle 6 fixes (ParseError parity, buildCategoryLabelMap, path validation, LLM consent) are mechanically correct but introduced one HIGH-severity parity regression and left one MEDIUM finding from Cycle 6 unaddressed. All gates pass (0 failures, 10 test suites green).

---

## HIGH

### C7-CR-01: Web-side JSON parser still takes Math.abs on negative amounts

**File:** `apps/web/src/lib/parser/json.ts:101`
**Confidence:** High

The server-side JSON parser was fixed in commit `fcd398b` (Cycle 6) to preserve negative amounts (refunds/credits) instead of silently converting them to positive purchases. However, the web-side JSON parser at line 101 still does:

```ts
const absAmount = Math.abs(amount);
// ...
amount: absAmount,
```

The comment at lines 98-99 incorrectly claims this "accepts negative amounts by taking absolute value, matching server-side JSON parser behavior (C100-02)" — but the server-side does NOT take absolute value anymore.

**Impact:** Refunds and credits in JSON-formatted statements are silently converted to purchases on the web side, corrupting spending analysis.

**Fix:** Remove `Math.abs()`. Use `amount` directly, matching the server-side behavior at `packages/parser/src/json/index.ts:114-124`.

---

## MEDIUM

### C7-CR-02: Web-side HTML parser diverges from server on negative amount handling

**File:** `apps/web/src/lib/parser/html.ts:223`
**Confidence:** High

The web-side HTML parser does `amount: Math.abs(amount)` at line 223, while the server-side HTML parser (`packages/parser/src/html/index.ts:228`) uses `if (amount <= 0) continue;`. These are semantically different: the web version converts negatives to positives (keeping them as spending), while the server version skips non-positive amounts entirely.

**Fix:** Align web-side with server-side — skip non-positive amounts instead of taking absolute value.

### C7-CR-03: Web-side HTML parser uses `type: 'string'` for xlsx.read

**File:** `apps/web/src/lib/parser/html.ts:39`
**Confidence:** Medium

Web-side passes normalized HTML as `type: 'string'` directly to xlsx.read. Server-side (`packages/parser/src/html/index.ts:46`) wraps in `Buffer.from(normalized, 'utf-8')` with `type: 'buffer'`. For non-ASCII Korean content, the string path may produce different encoding behavior than the buffer path.

**Fix:** Align web-side with server-side buffer wrapping.

### C7-CR-04: No tests for JSON negative amount preservation

**File:** `packages/parser/__tests__/json.test.ts`
**Confidence:** High

T6-03 from Cycle 6 remains unaddressed. The server-side JSON parser now preserves negative amounts, but there are no tests verifying this behavior. A future refactor could regress this silently.

**Fix:** Add a test case with `amount: -15000` asserting the output transaction has `amount: -15000`.

---

## LOW

### C7-CR-05: `buildCategoryNamesKo` returns Record, `buildCategoryLabelMap` returns Map

**File:** `packages/rules/src/category-names.ts`
**Confidence:** Low

Inconsistent return types between the old `buildCategoryNamesKo` (Record) and new `buildCategoryLabelMap` (Map). Callers must know which type they're getting. The Record version is effectively deprecated but still exported.

**Fix:** Consider deprecating `buildCategoryNamesKo` explicitly or removing it if all callers have migrated.

---

## Verified Fixes (Cycle 6)

| Issue | Commit | Status |
|-------|--------|--------|
| ParseError class parity | `c55005d` | Verified — web-side now uses class extending Error |
| buildCategoryLabelMap extraction | `88836e7` | Verified — used in CLI commands and web analyzer |
| Path validation null bytes + symlinks | `ea98316` | Verified — tests cover both cases |
| LLM consent localization + timeout | `2f3a3ee` | Verified — Korean prompt, 30s timeout |
| Anthropic model name | `86100a8` | Verified — `claude-3-7-sonnet-latest` |
| JSON negative amounts (server) | `fcd398b` | Verified — preserves negatives |

---

## Still Open from Previous Cycles

- C-CR-01: Non-KRW transactions silently dropped (`packages/core/src/calculator/reward.ts:220`)
- F-CRI-01 / A-ARCH-01: Server/web parser structural duplication
- S-SEC-02: HTML report `esc()` incomplete (`packages/viz/src/report/generator.ts:31-40`)
- Regex DoS in column patterns (Cycle 4)
- PDF three code paths (Cycle 4)
- Missing CSP in HTML reports (Cycle 5)
