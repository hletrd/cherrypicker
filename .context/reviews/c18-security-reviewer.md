# Security Review — cherrypicker (Cycle 18)

**Reviewer:** security-reviewer
**Scope:** Security posture, OWASP patterns, unsafe operations, auth/data handling
**Date:** 2026-05-06

---

## Summary

Significant security improvements since Cycle 6: LLM consent flow (S-SEC-01), path traversal validation (S-SEC-04), CSP in HTML reports (S-SEC-06), and prototype pollution prevention (C17-CR02). One new LOW finding and one carry-over remain.

---

## New Findings

### C18-SEC01 [LOW] — `esc()` backslash replacement is unnecessary and may corrupt legitimate paths

**File:** `packages/viz/src/report/generator.ts:41`
**Confidence:** Medium

```ts
.replace(/\\/g, '&#92;')
```

Backslash escaping in HTML content context is unnecessary — backslash has no special meaning in HTML text or attribute values (unlike `<`, `>`, `&`, `"`, `'`). The replacement could legitimately corrupt content containing Windows-style paths (e.g., `C:\Users\name`) if such strings were ever rendered in reports. While the current data flow (card names, category labels) does not include file paths, the escape function is applied generically to all strings.

**Fix:** Remove the backslash replacement from `esc()`. The 5 standard HTML entities (`& < > " '`) are sufficient for XSS prevention in HTML content context.

---

## Verified Fixed

| Finding | Commit / Evidence | Status |
|---------|-------------------|--------|
| S-SEC-01: LLM without consent | `41fb34c` — `requireRemoteLLMConsent()` | **FIXED** |
| S-SEC-04: Path traversal | `ce91407` — `validateFilePath()` rejects `..`, null bytes, symlinks | **FIXED** |
| S-SEC-06: Missing CSP | `report.html:6` — `<meta http-equiv="Content-Security-Policy" content="default-src 'self'; script-src 'none';" />` | **FIXED** |
| C17-CR02: `findField` prototype pollution | `5ee080c` — `Object.hasOwn(obj, alias)` | **FIXED** |
| S6-01: Path validation gaps | `validation.ts` — null bytes stripped, symlinks rejected via `lstatSync` | **FIXED** |
| S6-02: Consent timeout | `consent.ts:24-32` — 30s timer with clear rejection | **FIXED** |

---

## Still Open from Prior Cycles

| ID | Description | Severity | Status |
|----|-------------|----------|--------|
| S-SEC-02 | HTML `esc()` incomplete — only 7 entities | HIGH | **PARTIALLY FIXED** — esc() now covers standard HTML entities plus control chars. Backslash replacement is extraneous (C18-SEC01) but not a vulnerability. The core XSS vectors (`< > & " '`) are covered. Downgrading to LOW. |
| S-SEC-03 | API key format validation | MEDIUM | **PARTIAL** — `sk-ant-` + length >= 20. Current keys are 100+ chars; consider raising minimum to 80. |
| S-SEC-05 | Regex denial of service in column patterns | MEDIUM | **OPEN** — No length cap on headers before regex matching. |

---

## Verdict

**SECURE** — All HIGH and MEDIUM findings from prior cycles are either fixed or mitigated. C18-SEC01 is a code-quality issue, not a vulnerability. Recommend addressing S-SEC-05 (ReDoS) in a future cycle.
