# Cycle 1 (fresh) — designer pass

**Date:** 2026-05-03

## Scope

UI/UX review of the web app.

## Findings

### C1-UX01: FileDropzone bank selector does not show which bank was auto-detected

- **Severity:** LOW
- **Confidence:** Medium
- **File+line:** `apps/web/src/components/upload/FileDropzone.svelte:450-536`
- **Description:** After file upload, the bank selector shows "자동 인식" but never reveals which bank was actually detected. Users cannot verify detection before analysis starts.
- **Fix:** After bank detection, display the detected bank name (e.g., "자동 인식: 현대카드").

### C1-UX02: No loading skeleton for card detail page

- **Severity:** LOW
- **Confidence:** Low
- **File+line:** `apps/web/src/components/cards/CardDetail.svelte`
- **Description:** Card detail page loads data asynchronously but has no loading skeleton, unlike the dashboard pages.
- **Fix:** Add skeleton loading state matching dashboard pattern.

## Summary

2 net-new UI/UX findings (both LOW).
