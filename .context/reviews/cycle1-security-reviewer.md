# Security Review — Cycle 1 (security-reviewer)

## Scope
Full repository review focusing on OWASP patterns, secrets, and unsafe patterns.

---

## C1-SR-01: No input size limits on file parsing — potential DoS
**Severity: Medium | Confidence: Medium**

`packages/parser/src/index.ts` reads entire files into memory via `readFile()` with no size limit. A maliciously large file (hundreds of MB) could cause OOM.

**Impact**: Low for a local CLI tool (user controls their own files), but higher for the web app where files are uploaded by users.

**Fix**: Add a configurable file size limit (e.g., 50MB) before reading.

---

## C1-SR-02: LLM fallback sends file content to external API
**Severity: Low | Confidence: High**

`packages/parser/src/pdf/llm-fallback.ts` sends extracted PDF text to the Claude API. The text may contain sensitive financial data (card numbers, transaction details).

**Mitigation**: The `allowRemoteLLM` flag defaults to `false`, and the user must explicitly opt in. This is correctly gated.

---

## C1-SR-03: No path traversal validation in file reading
**Severity: Low | Confidence: Medium**

`packages/parser/src/index.ts` takes a `filePath` parameter and reads it directly. If used in a web server context without input validation, this could allow reading arbitrary files.

**Mitigation**: This is a library function, not an endpoint. The web app should validate paths before calling it.

---

## C1-SR-04: Regex patterns are safe — no ReDoS risk
**Severity: None | Confidence: High**

All regex patterns in the parser are simple and bounded. No nested quantifiers or catastrophic backtracking patterns were found. The date patterns, amount patterns, and delimiter detection patterns are all linear-time.