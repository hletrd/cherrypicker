# Cycle 10 Medium-Priority Fixes

**Created:** 2026-05-05  
**Source:** cycle10 aggregate review (_aggregate.md)  
**Status:** Completed

---

## C10-10: Fix JSON MEMO_ALIASES parity (server-side)
**Severity:** P2-MEDIUM  
**File:** `packages/parser/src/json/index.ts:56-59`  
**Description:** Web-side JSON parser has `'description'` in MEMO_ALIASES; server-side does not.
**Fix:** Add `'description'` to server-side MEMO_ALIASES.
**Status:** completed

---

## C10-11: Remove console.warn from CSV parser
**Severity:** P3-LOW  
**File:** `packages/parser/src/csv/index.ts:101`  
**Description:** `console.warn` for adapter failures in production code.
**Fix:** Remove the `console.warn` line. Errors are already collected in `signatureFailures`.
**Status:** completed

---

## C10-12: Fix esc() over-escaping forward slash
**Severity:** P3-LOW  
**File:** `packages/viz/src/report/generator.ts:42`  
**Description:** `.replace(/\//g, '&#47;')` is unnecessary in HTML text content.
**Fix:** Remove the forward-slash replacement line.
**Status:** completed

---

## C10-13: Add aria-busy to upload button
**Severity:** P2-MEDIUM  
**File:** `apps/web/src/components/upload/FileDropzone.svelte`  
**Description:** Upload button during analysis lacks `aria-busy`.
**Fix:** Add `aria-busy={uploadStatus === 'uploading'}` to the upload button.
**Status:** completed
