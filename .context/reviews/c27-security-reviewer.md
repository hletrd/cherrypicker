# Cycle 27 — Security Review

## Summary
No new critical or high-severity security findings. Two low-severity defensive coding items identified.

---

## LOW: normalizeHTML in web XLSX parser may over-sanitize HTML-as-XLS content

**Files:** `apps/web/src/lib/parser/xlsx.ts:5`, `apps/web/src/lib/parser/html.ts:29-47`
**Confidence:** Medium

The web XLSX parser imports `normalizeHTML` from the HTML parser module to handle HTML-as-XLS files. The `normalizeHTML` function strips script tags, event handlers, iframe/object/embed tags, and style blocks. While this is correct for security, it means the XLSX parser is exposed to changes in the HTML sanitizer. If a future HTML parser update changes sanitization rules (e.g., strips more content), XLSX parsing could be affected.

**Mitigation:** The current behavior is correct. Consider decoupling by extracting `normalizeHTML` to a shared utility module.

---

## LOW: OFX regex construction is safe but lacks defense-in-depth for malformed input

**Files:** `packages/parser/src/ofx/index.ts:65-76`, `apps/web/src/lib/parser/ofx.ts:40-46`
**Confidence:** Medium

The `extractTag` function uses `escapeRegExp` before interpolating tag names into regex patterns. The escape function covers all JS regex metacharacters. However, if a future code change removes or weakens `escapeRegExp`, the regex construction could throw `SyntaxError` on malformed OFX with special characters in tag names.

**Recommendation:** Add a try/catch around the `new RegExp(...)` calls as defense-in-depth. This is a one-line change that provides robustness against future regressions.
