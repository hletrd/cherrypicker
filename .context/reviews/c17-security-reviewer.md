# Cycle 17 — Security Review

**Date:** 2026-05-05
**Scope:** OWASP risks, unsafe patterns, input validation, secrets

## Findings

### C17-SEC01 [MEDIUM] — OFX `extractTag` uses dynamically constructed regex without input sanitization
- **File:** `apps/web/src/lib/parser/ofx.ts:33-36`, `packages/parser/src/ofx/index.ts`
- **Issue:** The `extractTag` function constructs a RegExp from the `tagName` parameter: `new RegExp('<${tagName}[^>]*>\\s*([^<]+?)\\s*</${tagName}>', 'i')`. If `tagName` contains regex metacharacters (e.g., `.`, `*`, `+`, `?`, `[`, `]`, `(`, `)`, `{`, `}`, `^`, `$`, `|`, `\`), the resulting regex may have unintended behavior or cause ReDoS.
- **Impact:** Low-Medium — the function is only called with hardcoded tag names ('DTPOSTED', 'TRNAMT', 'NAME', 'MEMO', 'TRNTYPE') in the current code. However, the function is exported-adjacent and could be called with user-controlled input in future modifications.
- **Fix:** Sanitize `tagName` before embedding in regex, or validate it against an allowlist of known OFX tags.
- **Confidence:** Medium

### C17-SEC02 [LOW] — `findField` prototype chain traversal
- **File:** `apps/web/src/lib/parser/json.ts:58`, `packages/parser/src/json/index.ts:65`
- **Issue:** `alias in obj` traverses the prototype chain. If `Object.prototype` is polluted, `findField` could return attacker-controlled values.
- **Impact:** Low — requires prototype pollution capability.
- **Fix:** Use `Object.hasOwn(obj, alias)`.
- **Confidence:** Medium

### C17-SEC03 [LOW] — `MIGRATIONS` uses `any` type
- **File:** `apps/web/src/lib/store.svelte.ts:115`
- **Issue:** Migration functions typed with `any` bypass type safety for persisted sessionStorage data.
- **Impact:** Low — same-origin only, but XSS could exploit this.
- **Fix:** Use `unknown` with runtime validation.
- **Confidence:** Medium

## Summary

No CRITICAL or HIGH security findings. Three LOW-MEDIUM items around input validation and type safety. No hardcoded secrets detected. No dependency vulnerabilities flagged.

| Severity | Count |
|----------|-------|
| MEDIUM | 1 |
| LOW | 2 |

**Risk Level:** LOW
