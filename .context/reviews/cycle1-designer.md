# Designer Review — Cycle 1 (designer)

## Scope
UI/UX review — the repo contains a web frontend (Astro 6 + Svelte 5).

---

## C1-UX-01: FileDropzone does not show format-specific guidance
**Severity: Medium | Confidence: Medium**

The upload component (`apps/web/src/components/upload/FileDropzone.svelte`) accepts files but doesn't guide users on what formats are supported or how to export from their specific bank. Korean users need bank-specific export instructions.

---

## C1-UX-02: Parse errors are not surfaced with actionable recovery steps
**Severity: Medium | Confidence: Medium**

When parsing fails, the error messages are technical (e.g., "헤더 행을 찾을 수 없습니다."). Users don't know what to do next. The UI should show:
- Which format was detected
- What the parser expected vs. what it found
- Suggested actions (re-export, try different format, check encoding)