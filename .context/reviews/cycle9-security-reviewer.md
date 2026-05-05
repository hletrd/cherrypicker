# Cycle 9 — Security Reviewer

**Reviewer:** security-reviewer (manual)
**Scope:** OWASP top 10, secrets, unsafe patterns, XSS, injection
**Date:** 2026-05-06

---

## Summary

No new critical security findings. Cycle 6 security improvements (LLM consent, path validation) remain intact. One MEDIUM finding from Cycle 8 (C8-05) is partially addressed but still has gaps.

---

## Verified Fixes

### S-SEC-01 FIXED: LLM transmits financial data without consent
- `tools/cli/src/consent.ts` — explicit `--allow-remote-llm` flag required

### S-SEC-04 FIXED: Path traversal in CLI file args
- `tools/cli/src/validation.ts` — rejects `..` segments, null bytes, symlinks

---

## Still Open Findings

### C8-05 [MEDIUM] esc() missing DEL and high-Unicode surrogates

**File:** `packages/viz/src/report/generator.ts:31-41`
**Confidence:** Medium

Current esc() strips control characters `\x00-\x08\x0b\x0c\x0e-\x1f` but misses:
- `\x7f` (DEL character) — can corrupt HTML parsing
- U+FFFE and U+FFFF (Unicode non-characters) — can cause XML/HTML parser errors
- U+FEFF (BOM) — already handled elsewhere but not in esc()

**Impact:** Maliciously crafted merchant names or category labels containing these characters could produce malformed HTML reports. Mitigated by CSP presence but defense-in-depth warranted.

**Fix:** Add `.replace(/\x7f/g, '').replace(/￾|￿/g, '')` to esc().

---

### S-SEC-05 [MEDIUM] Regex denial of service in column patterns

**Status:** PARTIALLY FIXED

`isSummaryRow` now caps input at 500 chars (C8-02). However, other regex patterns in column-matcher.ts (DATE_COLUMN_PATTERN, MERCHANT_COLUMN_PATTERN, AMOUNT_COLUMN_PATTERN) are still applied to unconstrained input lengths during column detection.

**Impact:** Lower than SUMMARY_ROW_PATTERN since header rows are typically short (<100 chars), but no explicit cap exists.

**Fix:** Add length caps to all regex-based column detection patterns, or document the assumption that headers are bounded.

---

## New Findings

None this cycle.

---

## Verdict

**FIX NOW:** C8-05 (esc() gaps — low effort, high confidence)
**MONITOR:** Regex surface for new patterns
