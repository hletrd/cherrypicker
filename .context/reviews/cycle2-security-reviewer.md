# Cycle 2 Security Review

## Review Scope
Full repository, focusing on parser package and web app.

---

## F-SEC-01: LLM fallback uses API key from environment without validation
**Severity: Low | Confidence: High**
**File**: `packages/parser/src/pdf/llm-fallback.ts` lines 38-39

The API key is read from `process.env['ANTHROPIC_API_KEY']`. While it checks for presence, the key is passed directly to the Anthropic client. No validation of key format (e.g., `sk-ant-` prefix) is performed. This is low risk since the Anthropic SDK validates the key on use.

---

## F-SEC-02: PDF text extraction has no size limit
**Severity: Low | Confidence: Medium**
**File**: `packages/parser/src/pdf/extractor.ts` lines 4-8

`pdf-parse` reads the entire PDF into memory without size limits. A malicious or extremely large PDF could cause memory exhaustion. The web-side parser has the browser's file size limit as a natural guard, but the server-side parser does not.

**Impact**: Low for CLI usage (user controls their own files). Would be higher if exposed as a web API endpoint.

---

## F-SEC-03: No input sanitization on CSV content before regex matching
**Severity: Low | Confidence: Medium**
**File**: `packages/parser/src/csv/generic.ts`, `packages/parser/src/csv/adapter-factory.ts`

CSV content is split and matched against regex patterns without any sanitization. Extremely long cells or pathological regex input could cause ReDoS. However, all regexes used are simple patterns without nested quantifiers, making ReDoS unlikely.

---

## F-SEC-04: LLM response parsing trusts JSON structure
**Severity: Low | Confidence: Medium**
**File**: `packages/parser/src/pdf/llm-fallback.ts` lines 84-109

The JSON extraction from LLM response uses a greedy bracket match, then progressively trims. While it handles malformed JSON gracefully, it trusts the LLM to produce valid transaction data. The validation at line 112-113 correctly checks for required fields (date, merchant, amount as correct types), but doesn't validate date format or amount range.

---

## F-SEC-05: Web-side encoding detection could produce garbled output silently
**Severity: Low | Confidence: Medium**
**File**: `apps/web/src/lib/parser/index.ts` lines 32-43

The encoding detection tries UTF-8 and CP949, picking the one with fewer replacement characters. If neither produces clean output (e.g., a file in a different encoding like Shift-JIS or GB2312), the least-bad option is used. The warning at line 49-53 helps, but the parsing proceeds with potentially garbled merchant names.