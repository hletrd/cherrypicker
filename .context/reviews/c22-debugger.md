# Cycle 22 — Debugger

**Date:** 2026-05-05
**Scope:** packages/parser/, apps/web/src/lib/parser/, apps/web/src/lib/store.svelte.ts
**Previous:** 21 cycles completed

---

## Finding C22-DEBUG01: SessionStorage truncation records original transactionCount, not truncated count [LOW]

**File:** `apps/web/src/lib/store.svelte.ts:174`

**Problem:** When transactions are truncated due to size limits, the persisted data omits the `transactions` array but keeps the original `transactionCount` field unchanged. This means the UI would display "5,000 transactions" while the actual persisted data has 0 transactions (all truncated). The user sees a misleading transaction count.

**Fix:** When truncation occurs, update `transactionCount` to 0 (or some sentinel) in the persisted data, or document that `transactionCount` reflects the original analysis and `transactions` may be absent due to truncation.

**Confidence:** Medium

---

## Finding C22-DEBUG02: Web-side `detectFormatFromFile` does not handle `.dat` extension for HTML [LOW]

**File:** `apps/web/src/lib/parser/detect.ts:107-113`

**Problem:** Some Korean bank exports use `.dat` extension for HTML content. The web-side format detection only checks `.html` and `.htm`, falling through to content sniffing. The content sniffing path DOES check for `<table` in the first 2048 bytes, so `.dat` files with HTML content would be correctly detected. However, the server-side `detectFormat` function has explicit extension handling for `.csv`, `.tsv`, `.xlsx`, `.xls`, `.pdf`, `.json`, `.ofx`, `.qfx`, `.html`, `.htm` but not `.dat` either.

This is not a bug (content sniffing catches it), but worth noting for consistency.

**Confidence:** Low

---

## Latent Bug Surface Analysis

| Area | Risk | Notes |
|------|------|-------|
| HTML parsing | Low | SheetJS handles malformed HTML gracefully; normalizeHTML adds defense |
| JSON parsing | Low | JSON.parse wrapped in try/catch; wrapper key detection is robust |
| OFX parsing | Low | SGML/XML dual-mode extraction handles both formats |
| CSV parsing | Low | Quote handling and delimiter detection are well-tested |
| Store persistence | Low-Medium | Truncation path could mislead users about data completeness |

---

## Regressions

None found. All tests pass.
