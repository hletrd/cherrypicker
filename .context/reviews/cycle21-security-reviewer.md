# Cycle 21 — Security Review

## C21-SEC01: No new security findings this cycle

After reviewing all source files, no new security issues were identified beyond those already addressed in previous cycles:
- C20-SEC02 (HTML sanitization before SheetJS) — FIXED in cycle 20
- C19-SEC01 (numeric entity pre-decoding in HTML report) — FIXED in cycle 19
- C19-SEC02 (runtime BankId validation) — FIXED in cycle 19
- C19-SEC03 (backslash removal from HTML report esc()) — FIXED in cycle 19

The codebase maintains good security hygiene:
- HTML report uses proper entity encoding with numeric entity pre-decoding
- HTML parser sanitizes script/style/iframe/event-handler content before SheetJS
- BankId is validated against a whitelist before parsing
- No eval/new Function/innerHTML usage in parser code

**Note:** The `normalizeHTML` function in `apps/web/src/lib/parser/html.ts` (line 29) strips `<script>`, `<style>`, `<iframe>`, `<object>`, `<embed>`, and event handlers. This is defense-in-depth since SheetJS does not execute JavaScript, but the sanitization is appropriate for handling untrusted HTML uploads.
