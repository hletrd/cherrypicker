# Cycle 17 — Designer (UI/UX) Review

**Date:** 2026-05-05
**Scope:** UI/UX, accessibility, responsive design, perceived performance

## Findings

### C17-UI01 [LOW] — `FileDropzone.svelte` accepts HTML files without content-sniffing validation
- **File:** `apps/web/src/components/upload/FileDropzone.svelte:97-106`
- **Issue:** HTML files are accepted in the upload dropzone. While parsing happens client-side, users could upload arbitrary HTML files expecting statement parsing. The parser would attempt to parse non-bank HTML as transaction data, producing confusing error messages.
- **UX Impact:** Users may see "HTML 테이블을 읽을 수 없습니다" or empty results when uploading wrong HTML files. No guidance is given about what kind of HTML files are expected.
- **Fix:** Add content-sniffing validation that checks for expected Korean bank HTML table structures before attempting full parse, or show a more specific error message when uploaded HTML doesn't match known bank patterns.
- **Confidence:** Low

### C17-UI02 [LOW] — Persistence warning messages could be more actionable
- **File:** `apps/web/src/lib/store.svelte.ts:135-148`
- **Issue:** The `PersistWarningKind` types ('truncated', 'corrupted', 'quota_exceeded', 'error') are surfaced to the UI but the actual warning messages shown to users are not reviewed here. If the messages are too technical, users won't know what action to take.
- **UX Impact:** Users see warnings but may not understand that their data won't survive a tab close.
- **Fix:** Ensure UI strings for each warning kind explain the impact in plain Korean and suggest a concrete action (e.g., "파일이 너무 커서 일부 거래 내역이 저장되지 않았어요. 다시 업로드하면 모든 내역을 볼 수 있어요").
- **Confidence:** Low

## Summary

No HIGH or MEDIUM UI/UX findings. Two LOW items around error message clarity and file validation. The web app has good visual design and accessibility coverage from previous cycles.

| Severity | Count |
|----------|-------|
| LOW | 2 |
