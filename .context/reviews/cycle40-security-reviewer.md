# Security Review — CherryPicker Cycle 40

**Reviewer:** security-reviewer
**Scope:** OWASP Top 10, XSS, injection, CSP, secrets handling
**Date:** 2026-05-06

---

## Summary

No new critical or high security findings. One minor finding related to sessionStorage data integrity. All prior findings remain open or deferred.

| Category | Count | Severity |
|---|---|---|
| New Findings | 1 | Low |
| Carryover | 5 | — |
| Deferred | 1 | — |

---

## NEW FINDINGS

### SEC-40-01: NaN in sessionStorage Enables Persistence of Corrupted State
**File:** `apps/web/src/lib/store.svelte.ts:347`, `apps/web/src/lib/store.svelte.ts:490-492`
**Severity:** Low | **Confidence:** Medium

The `loadFromStorage` function validates `previousMonthSpendingOption` using `typeof === 'number'`, which is true for `NaN`. A corrupted or manipulated sessionStorage entry can persist `NaN` as a "valid" number. While this does not directly enable XSS or injection, it violates data integrity assumptions and causes a downstream throw that leaks internal error messages to the UI.

**Fix:** Use `Number.isFinite()` for validation in `loadFromStorage`.

---

## CARRYOVER

| ID | Severity | File | Description |
|----|----------|------|-------------|
| SEC-01 | Medium | `Layout.astro:50` | CSP unsafe-inline |
| SEC-03 | Low | `llm-fallback.ts:77-79` | LLM input size limit (fixed in C39) |
| SEC-04 | Low | `llm-fallback.ts:66` | API key regex (fixed in C39) |
| SEC-07 | Low | `reward.ts:220` | Non-KRW transactions (now tracked) |
| C32-V13 | Low | `csv/shared.ts:192-210` | normalizeHTML XSS gaps |

---

## DEFERRED

| ID | Reason |
|----|--------|
| SEC-08 | sessionStorage encryption requires UX key management design |
