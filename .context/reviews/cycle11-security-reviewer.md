# Cycle 11 — Security Reviewer Findings

**Date:** 2026-05-05
**Reviewer:** security-reviewer (simulated)
**Scope:** Security-focused review of parser, web, and CLI surfaces

## Summary

No CRITICAL or HIGH security issues in current HEAD. One MEDIUM finding from cycle 10 is reassessed as LOW. One MEDIUM remains deferred.

---

## Findings

### C11-SR01 — [LOW] OFX dynamic regex ReDoS risk reassessed

**File:** `packages/parser/src/ofx/index.ts:61,65`
**File:** `apps/web/src/lib/parser/ofx.ts:33,36`

Cycle 10 flagged this as P1-HIGH ReDoS. Re-evaluation: the `extractTag()` function receives `tagName` exclusively from hardcoded string literals ('DTPOSTED', 'TRNAMT', 'NAME', 'MEMO', 'TRNTYPE') — never from user input. The regex is constructed dynamically but the pattern is controlled entirely by the caller.

However, the `extractTransactionBlocks` function at line 31-52 uses `/[\s\S]*?/` (lazy match) which is safe. The XML-style pattern at line 36 `/<STMTTRN[^>]*>([\s\S]*?)<\/STMTTRN>/gi` could theoretically cause issues on pathological inputs with many nested tags, but `[\s\S]*?` is lazy and bounded by `<\/STMTTRN>`, making catastrophic backtracking unlikely.

**Impact:** Theoretical only. No exploitable ReDoS vector exists with current call sites.

**Reassessment:** LOW (down from P1-HIGH in cycle 10)

**Fix:** If defensive hardening is desired, cap `content.length` before regex extraction at a reasonable bound (e.g., 50MB).

**Confidence:** High

---

### C11-SR02 — [MEDIUM] CSP unsafe-inline in script-src remains

**File:** `apps/web/src/layouts/Layout.astro:50`

`script-src 'self' 'unsafe-inline'` allows inline script execution, weakening XSS defense-in-depth. The comment at line 38-48 explains that Astro injects inline scripts and Tailwind v4 uses scoped styles requiring `style-src 'unsafe-inline'`.

**Impact:** If a reflected XSS vulnerability exists in any dependency or user-controlled content, `unsafe-inline` removes a significant mitigation layer.

**Fix:** Migrate to nonce-based CSP or hash-based CSP per the TODO comment. This requires Astro framework-level support.

**Confidence:** High
**Status:** DEFERRED per D7-M13 (requires upstream Astro nonce support)

---

### C11-SR03 — [LOW] Path validation in CLI verified correct

**File:** `tools/cli/src/validation.ts`

The `resolvePath` function validates against null bytes (`\0`) and symlink traversal (`../`). Implementation is correct. No new issues.

**Status:** VERIFIED CORRECT

---

### C11-SR04 — [LOW] HTML escape in report generator verified correct

**File:** `packages/viz/src/report/generator.ts:31-42`

`esc()` properly escapes `& < > " '` and strips control characters. The forward-slash over-escaping bug was fixed in cycle 10. No XSS vector exists in report generation.

**Status:** VERIFIED FIXED (cycle 10)

---

### C11-SR05 — [LOW] API key validation in scraper verified

**File:** `tools/scraper/src/fetcher.ts`

The Anthropic API key format is validated via regex before use. No hardcoded keys found in source.

**Status:** VERIFIED CORRECT

---

## Verdict

**COMMENT** — No exploitable vulnerabilities. CSP `unsafe-inline` is the only MEDIUM finding and is deferred pending framework support.
