# Security Review — Cycle 3 (2026-04-19)

**Reviewer:** security-reviewer
**Scope:** OWASP top 10, secrets, unsafe patterns, auth/authz

---

## Findings

### C3-S01: `process.env` access in `llm-fallback.ts` can leak via error messages

- **Severity:** MEDIUM
- **Confidence:** High
- **File:** `packages/parser/src/pdf/llm-fallback.ts:39-41`
- **Description:** When `ANTHROPIC_API_KEY` is not set, the error message is "ANTHROPIC_API_KEY 환경변수가 설정되지 않았습니다." This reveals the name of the environment variable to anyone who sees the error. While the browser guard (C2-S01 fix) prevents this from running in the browser, if this code is ever used in a server-side context (e.g. Astro SSR endpoint), the error message could be logged or displayed to an end user.
- **Failure scenario:** A misconfigured server-side rendering path triggers this error, and the error message (with env var name) appears in a user-facing error page or monitoring dashboard.
- **Fix:** Change the error message to "API 키가 설정되지 않았습니다." without mentioning the specific environment variable name.

### C3-S02: No input size limit on file uploads

- **Severity:** MEDIUM
- **Confidence:** High
- **File:** `apps/web/src/components/upload/FileDropzone.svelte:110-132`
- **Description:** The `addFiles` function accepts any file without checking file size. A user could upload a multi-gigabyte file, which would be read entirely into memory via `file.arrayBuffer()`. For PDF files, this means `pdfjs-dist` would attempt to parse the entire file, consuming significant memory and CPU. For XLSX files, the SheetJS library would parse the entire workbook. There is no server-side validation since this is a client-side-only app.
- **Failure scenario:** A user (or automated script) drops a 2GB PDF file. The browser tab runs out of memory and crashes, or becomes unresponsive for minutes.
- **Fix:** Add a file size check (e.g. max 10MB per file, max 50MB total) before reading the file. Display an error message if the file is too large.

### C3-S03: sessionStorage data is parsed without try/catch for specific JSON errors

- **Severity:** LOW
- **Confidence:** Medium
- **File:** `apps/web/src/lib/store.svelte.ts:119-120`
- **Description:** `JSON.parse(raw)` is wrapped in a try/catch, but the catch block is at line 145 and only removes the storage key. It doesn't log the error or report it to the user. If sessionStorage is corrupted by an XSS attack or a browser bug, the error is silently swallowed and the user sees an empty dashboard with no explanation.
- **Failure scenario:** An XSS attack modifies `cherrypicker:analysis` in sessionStorage to contain malicious JSON. On next page load, the parse fails silently, and the user has no idea their data was lost.
- **Fix:** Log the parse error (at minimum to `console.warn`) so developers can debug storage corruption. Consider adding a UI notification that stored data was invalid.

### C3-S04: `is:inline` script in Layout.astro runs before CSP is enforced

- **Severity:** LOW
- **Confidence:** Medium
- **File:** `apps/web/src/layouts/Layout.astro:53`
- **Description:** The `<script is:inline src="/cherrypicker/scripts/layout.js"></script>` loads an external script that executes in the page context. Since CSP currently allows `'self'` for script-src, this is allowed. However, if the hosting server is compromised and serves a modified `layout.js`, it would execute in the page context with full access to DOM and sessionStorage (which contains analysis results). This is a supply-chain risk inherent to any external script.
- **Fix:** Consider adding `integrity` attributes (Subresource Integrity) to the script tag so the browser verifies the hash before executing. This requires computing SHA256/384/512 hashes at build time.
