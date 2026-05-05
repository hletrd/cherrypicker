# Cycle 8 Security Review

**Agent:** security-reviewer
**Date:** 2026-05-06
**Scope:** Full repository — cherrypicker Korean credit card optimizer

---

## Findings

### C8-S1: SUMMARY_ROW_PATTERN potential ReDoS on long row text

**Confidence:** Medium
**Severity:** Medium

**File:** `packages/parser/src/csv/column-matcher.ts:93`

The `SUMMARY_ROW_PATTERN` is a large regex with 40+ alternations, each containing lookbehind `(?<![가-힣])` and lookahead `(?![가-힣])` assertions. While `normalizeHeader()` caps header length at 200 characters, `SUMMARY_ROW_PATTERN.test(rowText)` operates on full joined row text which can be arbitrarily long (e.g., a row with 50 columns of 100 characters each = 5000+ characters).

On malicious or pathological input, the regex engine may spend significant time backtracking through alternations before failing. This is a potential Regular Expression Denial of Service (ReDoS) vector.

**Mitigation:** The pattern uses atomic assertions (lookbehind/lookahead) which reduce backtracking compared to greedy quantifiers, but the sheer number of alternations still creates O(n*m) behavior where n = input length and m = number of alternatives.

**Fix:** Cap row text length before testing against SUMMARY_ROW_PATTERN:
```ts
const cappedRowText = rowText.slice(0, 500);
if (SUMMARY_ROW_PATTERN.test(cappedRowText)) continue;
```

Or pre-filter: only test rows that contain at least one summary-related keyword.

---

### C8-S2: esc() missing DEL character and high-Unicode surrogates

**Confidence:** Medium
**Severity:** Low

**File:** `packages/viz/src/report/generator.ts:31-41`

The `esc()` function strips control characters in range `\x00-\x1f` but misses:
- `\x7f` (DEL character)
- U+FFFE and U+FFFF (non-characters that can cause XML/HTML parser issues)
- Unicode directional overrides (U+202A-U+202E) used in homograph attacks

**Mitigation:** CSP meta tag `script-src 'none'` is present in `report.html`, which mitigates XSS from script injection. The report is also served as a downloaded file, not from a web origin.

**Fix:** Extend esc() to strip `\x7f` and consider adding Unicode non-character stripping for defense in depth.

---

### C8-S3: Dynamic regex construction in OFX extractTag

**Confidence:** Low
**Severity:** Low

**Files:**
- `packages/parser/src/ofx/index.ts:61,65`
- `apps/web/src/lib/parser/ofx.ts:33,36`

The `extractTag` function constructs regexes dynamically from the `tagName` parameter:
```ts
const xmlRe = new RegExp(`<${tagName}[^>]*>\\s*([^<]+?)\\s*</${tagName}>`, 'i');
```

While `tagName` comes from hardcoded string literals ('DTPOSTED', 'TRNAMT', etc.), if this function were ever exposed to user input, it would be vulnerable to regex injection.

**Fix:** Validate `tagName` against an allowlist of known OFX tags before constructing the regex, or use string index operations instead of regex.

---

## Verified Security Improvements

| Improvement | File | Status |
|-------------|------|--------|
| CSP meta tag | `packages/viz/src/report/templates/report.html:6` | Present |
| Control char stripping | `packages/viz/src/report/generator.ts:33` | Implemented |
| Path traversal hardening | `tools/cli/src/validation.ts` | Maintained |
| Null byte stripping | `tools/cli/src/validation.ts` | Maintained |
| LLM consent timeout | `tools/cli/src/consent.ts` | Maintained |
