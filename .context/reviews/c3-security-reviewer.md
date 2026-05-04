# Security Reviewer — Cycle 3

## F-SEC-01: PDF text extraction has no size limit
**Severity: Low | Confidence: Medium**
**File**: packages/parser/src/pdf/extractor.ts

extractText() extracts all text from PDF without size limit. A maliciously crafted PDF with enormous text content could cause memory exhaustion. The LLM fallback truncates to 8000 chars but the structured parser processes everything.

## F-SEC-02: LLM fallback truncates text without indication to user
**Severity: Low | Confidence: Medium**
**File**: packages/parser/src/pdf/llm-fallback.ts line 48

Text is truncated to 8000 chars with "...(truncated)" appended. If the truncation cuts mid-transaction, partial data could be returned. Users won't know some transactions were missed.

## F-SEC-03: No input sanitization on merchant names
**Severity: Low | Confidence: Medium**
**Files**: All parsers

Merchant names are taken directly from file content with only quote-stripping. If stored in a database and rendered in HTML, XSS is possible. However, this is an application-level concern, not a parser concern.
