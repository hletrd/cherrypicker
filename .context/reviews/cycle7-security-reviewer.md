# Cycle 7 — security-reviewer

Focus: XSS, CSP, data-loss, input validation, storage safety.

## Findings

### S7-01 — `unsafe-inline` in script-src CSP [MEDIUM / High]

- File: comments in `e2e/web-regressions.spec.js:9-10`, `e2e/ui-ux-review.spec.js:12-13`.
- Evidence: CSP now includes `'unsafe-inline'` for script-src. This is documented in test comments but not verified here. `unsafe-inline` weakens XSS defence. Astro may need it for inline hydration scripts.
- Fix: investigate if `'nonce-<random>'` can replace `'unsafe-inline'` using Astro's built-in nonce support. Defer if not straightforward.

### S7-02 — sessionStorage version migration applies without re-signing [LOW / Medium]

- File: `apps/web/src/lib/store.svelte.ts:228-252`.
- Evidence: `loadFromStorage` runs migrations on stored data. An attacker with XSS could persist a v0 payload with malicious fields, and the migration path would accept it. Since XSS already means game-over, this is defensive-in-depth rather than a new risk.
- Fix: keep current validation guards; consider Zod schema validation of the full payload on load.

### S7-03 — `beforeunload` listener accepts any return-string [LOW / Low]

- File: `apps/web/src/components/upload/FileDropzone.svelte:240-245`.
- Evidence: returns a literal string. Modern browsers ignore the string content (only care if it's truthy), so no injection risk.
- Fix: none.

### S7-04 — `analysisStore.reset()` clears `cherrypicker:analysis` but not `cherrypicker:theme` [LOW / Low]

- File: `apps/web/src/lib/store.svelte.ts:332-348`.
- Evidence: theme is in localStorage; reset is only analysis-related. Good — theme should persist.

### S7-05 — File upload size limits enforced client-side only [LOW / High]

- File: `apps/web/src/components/upload/FileDropzone.svelte:123-124, 132, 157-160`.
- Evidence: MAX_FILE_SIZE = 10MB per file, MAX_TOTAL = 50MB total, enforced in `addFiles`. There is no server-side enforcement because this is a client-side-only app. Acceptable — the data never leaves the browser.

### S7-06 — No PII sanitization in sessionStorage [INFO]

- Evidence: transactions include merchant names, amounts, dates. Stored in sessionStorage. Browser clears on tab close. PII stays client-side, which is the design intent ("내 명세서는 밖으로 나가지 않아요").
- Fix: none.

### S7-07 — Error messages may include partial paths/URLs [LOW / Low]

- File: analyzer.ts error-throw paths.
- Evidence: `throw new Error('거래 내역을 찾을 수 없어요')` and similar. Korean strings, no file paths, no sensitive info.
- Fix: none.

## Summary

No new security findings worth scheduling this cycle. Cycle 6 and earlier already hardened input validation (C6UI-34 clamp) and data-loss guard (C6UI-16 beforeunload).
