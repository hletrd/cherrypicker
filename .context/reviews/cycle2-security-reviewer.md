# Cycle 2 Security Review

## Review Scope
Full repository, focusing on parser package and web app.

---

## F-SEC-01: fetcher.ts second fetch() loses abort timeout on EUC-KR detection
**Severity: Medium | Confidence: High**
**File**: `tools/scraper/src/fetcher.ts` lines 50-55

When meta charset EUC-KR is detected, the second `fetch()` omits the `AbortController.signal`, causing the request to hang indefinitely if the server is unresponsive. A malicious or slow server could keep connections open.

**Fix**: Pass `signal: controller.signal` to the second fetch.

---

## F-SEC-02: LLM fallback uses API key from environment without validation
**Severity: Low | Confidence: High**
**File**: `packages/parser/src/pdf/llm-fallback.ts` lines 38-39

Reads `process.env['ANTHROPIC_API_KEY']`. No format validation (e.g., `sk-ant-` prefix). Low risk since Anthropic SDK validates on use.

---

## F-SEC-03: PDF text extraction has no size limit
**Severity: Low | Confidence: Medium**
**File**: `packages/parser/src/pdf/extractor.ts` lines 4-8

`pdf-parse` reads entire PDF into memory without size limits. Malicious large PDF could cause memory exhaustion. Web-side has browser file size limit as guard.

---

## F-SEC-04: No input sanitization on CSV content before regex matching
**Severity: Low | Confidence: Medium**
**File**: `packages/parser/src/csv/generic.ts`, `packages/parser/src/csv/adapter-factory.ts`

CSV content split and matched against regex without sanitization. Regexes are simple without nested quantifiers, making ReDoS unlikely.

---

## F-SEC-05: LLM response parsing trusts JSON structure
**Severity: Low | Confidence: Medium**
**File**: `packages/parser/src/pdf/llm-fallback.ts` lines 84-109

Greedy bracket match for JSON extraction. Validation checks required fields but not date format or amount range. Trusts LLM to produce valid data.

---

## F-SEC-06: Web-side encoding detection could produce garbled output silently
**Severity: Low | Confidence: Medium**
**File**: `apps/web/src/lib/parser/index.ts` lines 32-43

Tries UTF-8 and CP949, picks least-bad. If neither is correct (e.g., Shift-JIS), parsing proceeds with garbled merchant names. Warning is logged but not surfaced to user.

---

## F-SEC-07: LLM fallback truncates PDF text to 8000 chars
**Severity: Low | Confidence: Medium**
**File**: `packages/parser/src/pdf/llm-fallback.ts` line 48

Truncates to 8000 chars. Long statements may have transactions after the cutoff that are silently missed.
