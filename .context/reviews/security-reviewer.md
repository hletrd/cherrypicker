# Security Review — CherryPicker Cycle 37

**Reviewer:** security-reviewer
**Scope:** OWASP Top 10, XSS, injection, CSP, secrets handling, data exposure
**Date:** 2026-05-06

---

## Summary

No new critical security findings in Cycle 37. The recently added HTML/JSON/OFX parsers do not introduce new attack surfaces beyond those already present in the CSV/XLSX paths. One minor finding in JSON wrapper key matching. All prior security findings remain open or deferred.

| Category | Count | Severity |
|---|---|---|
| New Findings | 1 | Low |
| Carryover (still open) | 7 | — |
| Deferred | 1 | — |
| Verified Safe | 5 | — |

---

## NEW FINDINGS (Cycle 37)

### SEC-37-01: JSON Wrapper Key Matching Missing `Object.hasOwn` Guard
**File:** `packages/parser/src/json/index.ts:212-216`, `apps/web/src/lib/parser/json.ts:193-198`
**Severity:** Low | **Confidence:** Medium

When parsing wrapped JSON formats (`{ transactions: [...] }`), the case-insensitive key matcher iterates `Object.keys(obj)` and accesses `obj[objKey]` without `Object.hasOwn`. While `Object.keys` only returns own properties, a crafted object with a modified prototype could expose prototype properties through this path. This is a low-severity prototype pollution vector because:
1. The value must be an array to match `Array.isArray(obj[objKey])`
2. The wrapper keys are well-known (`transactions`, `data`, `items`, etc.)
3. `JSON.parse` does not preserve prototype chains

**Fix:** Add `Object.hasOwn(obj, objKey)` check for defense in depth.

---

## CARRYOVER (still open from prior cycles)

| ID | Severity | File | Description |
|----|----------|------|-------------|
| SEC-01 | Medium | `Layout.astro:50` | CSP unsafe-inline for script/style |
| SEC-03 | Low | `llm-fallback.ts:77-79` | No max-size check before LLM processing |
| SEC-04 | Low | `llm-fallback.ts:66` | API key regex too permissive |
| SEC-05 | Low | `llm-fallback.ts` | No rate limiting on LLM fallback |
| SEC-06 | Low | `llm-fallback.ts` | Regex-based LLM sanitization incomplete |
| SEC-07 | Low | `reward.ts:220` | Non-KRW transactions silently skipped |
| C32-V13 | Low | `csv/shared.ts:192-210` | `normalizeHTML` XSS gaps (data: URLs, SVG onload) |

---

## DEFERRED

| ID | Severity | Reason |
|----|----------|--------|
| SEC-08 | Low | sessionStorage encryption requires UX key management design |

---

## VERIFIED SAFE

- `normalizeHTML` (web-side) strips script tags, event handlers, and JS URLs before SheetJS parsing
- JSON parser uses `Object.hasOwn` for exact-match path (fast path)
- OFX parser regex construction uses `escapeRegExp` for tag names
- HTML parser `normalizeHTML` runs before any DOM insertion ( SheetJS operates on strings )
- No `eval()`, `Function()`, or dynamic code execution in new parser code

---

## Cross-File Risk: Parser Input Surface Expansion

Cycle 37 added three new input formats (HTML, OFX, JSON), increasing the attack surface for:
- **Malicious file uploads** (already mitigated by normalizeHTML, no DOM rendering)
- **Prototype pollution via JSON** (mitigated by Object.hasOwn in exact-match path, but case-insensitive fallback is unguarded — SEC-37-01)
- **ReDoS via regex** (OFX `extractTag` constructs regex from block content; `escapeRegExp` handles metacharacters but not length limits)

**Recommendation:** Add a global file-size limit (e.g., 50MB) before any parser runs, and a per-format line/record limit to prevent CPU exhaustion from pathological inputs.
