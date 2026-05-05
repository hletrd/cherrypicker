# Cycle 16 — Security Review

**Date:** 2026-05-06
**Scope:** OWASP risks, unsafe patterns, input validation

## Findings

### C16-SEC01 [LOW] — `MIGRATIONS` object uses `any` type, bypassing type safety for persisted data
- **File:** `apps/web/src/lib/store.svelte.ts:114`
- **Issue:** `const MIGRATIONS: Record<number, (data: any) => any>` uses `any` for both input and output of migration functions. When persisted data is loaded from sessionStorage and migrations are applied, type safety is completely bypassed. A malicious or corrupted payload could exploit this.
- **Impact:** Medium — sessionStorage is same-origin only, so this is not a cross-site attack vector. However, if an attacker gains XSS access, they could inject malformed data into sessionStorage that passes through migrations without validation.
- **Fix:** Replace `any` with `unknown` and add runtime validation inside each migration function. The current Record is empty (no migrations yet), so fixing this now prevents future migration functions from inheriting the unsafe pattern.
- **Confidence:** Medium

### C16-SEC02 [LOW] — HTML files accepted for upload without additional validation
- **File:** `apps/web/src/components/upload/FileDropzone.svelte:97-106`
- **Issue:** HTML files are accepted in the upload dropzone (`text/html` in ACCEPTED_TYPES). While parsing happens entirely client-side (no server XSS risk), users could be confused if they upload arbitrary HTML files expecting statement parsing. The parser would attempt to parse non-bank HTML as transaction data.
- **Impact:** Low — client-side only, no server-side XSS. Could cause UX confusion.
- **Fix:** Add a content-sniffing validation step that checks for expected Korean bank HTML table structures before attempting full parse, or warn the user when uploaded HTML doesn't match known bank patterns.
- **Confidence:** Low

### C16-SEC03 [LOW] — `findField` uses `in` operator enabling prototype chain access
- **File:** `apps/web/src/lib/parser/json.ts:58` and `packages/parser/src/json/index.ts:65`
- **Issue:** The `findField` function uses `alias in obj` which traverses the prototype chain. If an attacker can pollute `Object.prototype` (e.g., via a vulnerable dependency or XSS), they could cause `findField` to return attacker-controlled values for transaction field names.
- **Impact:** Low — requires prototype pollution capability, which is not currently exposed.
- **Fix:** Use `Object.hasOwn(obj, alias)` for own-property lookup.
- **Confidence:** Low

## Summary
No HIGH or MEDIUM security findings in cycle 16. Three LOW-risk items around type safety and input validation.
