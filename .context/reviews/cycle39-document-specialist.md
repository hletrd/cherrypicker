# Documentation Review — CherryPicker Cycle 39

**Reviewer:** document-specialist (manual, Agent tool unavailable)
**Date:** 2026-05-06
**Cycle:** 39 / 100
**HEAD:** d265c46

---

## Findings

### DOC-39-01 — Low — `parseOFXDate` JSDoc still misleading

**File:** `packages/parser/src/ofx/index.ts:80-87`
**File:** `apps/web/src/lib/parser/ofx.ts:49-56`

The JSDoc claims:
> "Using local getters (getFullYear etc.) would be incorrect in non-KST envs"

But the code uses `getUTCFullYear()`, `getUTCMonth()`, `getUTCDate()` on a Date object that was shifted by +9 hours. The comment implies this is a KST conversion, but it's actually a manual timezone offset calculation that happens to work for KST. The implementation is correct for the use case (Korean banks), but the explanation is confusing.

**Fix:** Simplify the JSDoc to explain what the function actually does: "Converts OFX datetime with timezone offset to YYYY-MM-DD in Korea Standard Time (UTC+9)".

**Confidence:** Low

---

### DOC-39-02 — Low — Missing `@throws` on entry functions

**Files:** All parser entry functions (`parseHTML`, `parseJSON`, `parseOFX`, `parseXLSX`, `parseCSV`, `parsePDF`)

None of the public parser functions document their error behavior. While most return `ParseResult` with an `errors` array, some (like the PDF LLM fallback) throw exceptions.

**Fix:** Add JSDoc `@returns` and `@throws` annotations to all public parser APIs.

**Confidence:** Low

---

## Carryover Status

| ID | Status | Notes |
|----|--------|-------|
| DOC-37-01 | OPEN | parseOFXDate JSDoc still misleading |
| DOC-37-02 | OPEN | Missing `@throws` on entry functions |
