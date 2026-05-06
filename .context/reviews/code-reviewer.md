# Code Review — CherryPicker Cycle 37

**Reviewer:** code-reviewer
**Scope:** Correctness, maintainability, cross-platform compatibility, type safety
**Date:** 2026-05-06

---

## Summary

One critical bug (BUG-1, per-transaction cap) verified fixed. Two Cycle 36 findings verified fixed (C32-V09, C32-V01). Four new code-quality issues identified in recently added parsers. All prior carryover findings remain open.

| Category | Count | Severity |
|---|---|---|
| Verified Fixed | 3 | 1 Critical, 2 Medium |
| New Findings | 4 | 1 Medium, 3 Low |
| Carryover (still open) | 14 | — |

---

## VERIFIED FIXED

| ID | Finding | Status | Evidence |
|----|---------|--------|----------|
| BUG-1 | Per-transaction cap on amount (20x undercalc) | **FIXED** | `reward.ts:271-277` now caps reward, not amount |
| C32-V09 | JSON non-deterministic field matching | **FIXED** | Both json parsers now scan aliases in priority order (lines 75-79) |
| C32-V01 | XLSX blank-row forward-fill leak | **FIXED** | Both xlsx parsers now reset last* values on blank rows (lines 307-316) |

---

## NEW FINDINGS (Cycle 37)

### CR-37-01: JSON Parser Drops Negative Amounts Without Error
**File:** `packages/parser/src/json/index.ts:138`, `apps/web/src/lib/parser/json.ts:130`
**Severity:** Medium | **Confidence:** High

`if (amount <= 0) return null;` silently filters out refunds and credits. Unlike the OFX parser (which has an explanatory comment), the JSON comment only says "Skip zero and negative amounts... Parity with CSV, HTML, XLSX, and OFX." There is no error reported to the user.

**Fix:** Add a `ParseError` for negative amounts, or include them as transactions (calculator already handles negatives via `skippedTransactions`).

---

### CR-37-02: HTML Parser Assumes UTF-8 Input
**File:** `packages/parser/src/html/index.ts:47`, `apps/web/src/lib/parser/html.ts:65`
**Severity:** Low | **Confidence:** Medium

Server-side: `xlsx.read(Buffer.from(normalized, 'utf-8'), { type: 'buffer' })`
Web-side: `xlsx.read(encoder.encode(normalized), { type: 'array' })`

Both paths assume UTF-8 encoding. Korean bank HTML exports may use CP949/EUC-KR. The `normalizeHTML` function operates on strings, so any encoding conversion must happen before it. In the web app, `parseFile` tries `['utf-8', 'cp949']` for CSV but not for HTML.

**Fix:** Try CP949 decoding before UTF-8 for HTML files, similar to CSV detection.

---

### CR-37-03: OFX `extractTag` Regex Construction Missing Length Validation
**File:** `packages/parser/src/ofx/index.ts:67-78`, `apps/web/src/lib/parser/ofx.ts:38-46`
**Severity:** Low | **Confidence:** Low

`extractTag` compiles a regex from `tagName` after `escapeRegExp`. If `tagName` is extremely long (not possible with current call sites which use hardcoded short strings), the regex could exceed engine limits. More importantly, if `block` contains null bytes or other control characters, the regex match behavior is undefined.

**Fix:** Add a precondition check for `tagName.length < 100` and sanitize `block` before regex operations.

---

### CR-37-04: `normalizeHTML` While-Loop Regex Risk
**File:** `apps/web/src/lib/parser/html.ts:33-35`
**Severity:** Low | **Confidence:** Medium

```typescript
while (/<script[\s\S]*?<\/script>/i.test(cleaned)) {
  cleaned = cleaned.replace(/<script[\s\S]*?<\/script>/gi, '');
}
```

This pattern could loop many times on pathological input (nested script-like substrings). Each iteration creates a new string. A 1MB file with 1000 `<script>`-like patterns would create 1000 intermediate strings.

**Fix:** Replace with a single pass using a more precise regex, or add an iteration limit (e.g., max 10 loops).

---

## CARRYOVER (still open from prior cycles)

| ID | Severity | File | Description |
|----|----------|------|-------------|
| CR-01 | Medium | `detect.ts:286-295` | Silent JSON.parse error swallowing |
| CR-02 | Medium | `html/index.ts:48` | Silent HTML parser error swallowing |
| CR-05 | Low | `greedy.ts:55` | Zero-amount guard missing in optimizer |
| CR-07 | Low | `store.svelte.ts` | Type duplication between core and web |
| CR-08 | Low | `analyzer.ts:260` | Empty categoryLabels Map not validated |
| CR-09 | Medium | `tools/cli/` | Windows path bug |
| CR-10 | Medium | `extractor.ts:34` | Outdated hardcoded model name |
| CR-11 | Low | `detect.ts` / `index.ts` | CSV buffer not reused |
| CR-12 | Low | `detect.ts:43` | CP949 ratio inflation for small buffers |
| CR-13 | Low | `store.svelte.ts:244` | `any` for parsed storage data |
| CR-14 | Low | `cards.ts` | No timeout on static JSON fetches |
| CR-15 | Medium | `column-matcher.ts` | ReDoS risk in SUMMARY_ROW_PATTERN |
| CR-16 | Low | `store.svelte.ts` | No cancellation for in-flight analyze/reoptimize |
| CR-17 | Low | `packages/parser/` vs `apps/web/src/lib/parser/` | Parser duplication |

---

## Commonly Missed Checks

- `normalizeHTML` does not strip `<svg>` tags which can contain `onload` handlers
- `parseJSON` wrapper key scan uses `obj[objKey]` without `Object.hasOwn` (SEC-37-01)
- `parseOFXAmount` still delegates to `parseAmountString` with extended format support (C32-V10)
- No upper bound on JSON array size before parsing (could exhaust memory with `[{},{},...]` x 1M)
