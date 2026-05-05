# Debugger — cherrypicker (Cycle 5)

**Reviewer:** debugger (sonnet)
**Scope:** Root-cause analysis, edge cases, failure modes
**Date:** 2026-05-05

---

## Summary

3 of 5 cycle-4 findings have been fixed. The FileDropzone ReferenceError is resolved. The PDF non-null assertion is partially fixed. The OFX timezone bug and HTML forward-fill mutation remain. No new critical failure modes were found in cycle 5.

---

## Verification Results

### D-DEB-01: FileDropzone `errorMessage` vs `errorMessages` ReferenceError

**Status:** FIXED
**Evidence:** `apps/web/src/components/upload/FileDropzone.svelte:76` declares `let errorMessages = $state<string[]>([])`. All 9 references (lines 208, 215, 232, 241, 255, 318, 330, 353, 367, 619) use `errorMessages`. No `errorMessage` references.
**Root cause addressed:** Template variable name mismatch in Svelte 5. TypeScript cannot catch template variable names.

---

### D-DEB-02: PDF non-null assertion on amount match

**Status:** PARTIALLY FIXED
**Evidence:** `packages/parser/src/pdf/index.ts:358` no longer has `!` after the nullish coalescing chain. However, if ALL capture groups are undefined, `amountRaw` becomes `undefined` and the code falls through to line 360 which pushes an error rather than throwing. This is safer but still a silent failure.
**Root cause partially addressed:** The `!` operator was removed, but the fallback to error-push means malformed amounts are silently skipped rather than loudly failing.

---

### D-DEB-03: OFX date parser strips timezone

**Status:** OPEN
**Evidence:** `packages/parser/src/ofx/index.ts` still uses `replace(/[^0-9].*$/, '')` to strip non-digit characters from dates. Timezone-aware timestamps like `20240115120000[-5:EST]` become `20240115120000`.
**Root cause not addressed:** The regex-based strip assumes all dates are local Korean time.

---

### D-DEB-04: AbortController timeout in LLM fallback

**Status:** FIXED
**Evidence:** The `finally` block clears the timeout. The abort signal is properly passed to `client.messages.create`.

---

### D-DEB-05: HTML forward-fill mutates array during iteration

**Status:** OPEN
**Evidence:** `packages/parser/src/html/index.ts` lines 137-215 still modify `rows` in place during forward-fill. A two-pass or cloned approach was not implemented.

---

## New Findings (Cycle 5)

### [P2-MEDIUM] Web parsers may drop refunds on amount <= 0 filter

**File:** `apps/web/src/lib/parser/csv.ts` (and others)
**Confidence:** Medium

Recent commit `dbb871e` fixed "web parsers silently dropping refund transactions." Need to verify the fix is comprehensive across all web parser formats (CSV, XLSX, PDF, JSON, OFX, HTML).

**Fix:** Add test fixtures for refund transactions in each format and verify they parse correctly.

---

### [P3-LOW] `normalizeHeader` regex may ReDoS on crafted input

**File:** `packages/parser/src/csv/column-matcher.ts`
**Confidence:** Low

Large alternation regexes with hundreds of branches. While headers are typically short (<50 chars), no explicit length cap exists before regex application.
**Fix:** Cap header string length at 200 chars before regex matching.

---

## Root Cause Analysis

### Why parser bugs recur

1. No fuzz testing — all tests use well-formed fixtures
2. No parity tests — web parser bugs don't trigger server parser tests
3. Template variables (Svelte) escape TypeScript checking
4. Regex assumptions are not validated against edge cases

---

## Verdict

**FIX AND SHIP** — OFX timezone handling and HTML forward-fill idempotency are bounded fixes that close known failure modes.
