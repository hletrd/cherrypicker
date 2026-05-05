# Security Reviewer — cherrypicker (Cycle 13)

**Reviewer:** security-reviewer
**Date:** 2026-05-05

---

## Summary

No new security issues identified. The codebase continues to follow secure patterns: no dynamic code execution, pre-compiled regex constants (no ReDoS), explicit opt-in for LLM fallback, and no network requests from parser code.

---

## Security Findings

### S13-01: No new security issues [INFORMATIONAL]

The parser code does not introduce any new security concerns:
- No user input used in `eval()` or dynamic code execution
- No file path traversal (files are opened by the caller)
- No network requests from parser code (LLM fallback is opt-in only)
- Regex patterns are pre-compiled constants (no ReDoS from dynamic patterns)
- XLSX parsing uses SheetJS which handles malformed inputs safely

### S13-02: LLM fallback requires explicit opt-in (GOOD)

The PDF LLM fallback requires `--allow-remote-llm` flag. This is the correct default — no data leaves the system without explicit user consent.

---

## Re-confirmed Deferred Items

| ID | Severity | Description |
|---|---|---|
| D-32 | LOW | No SRI on external script (same-origin inline, not applicable) |
| D-31 | LOW | sessionStorage parse errors silently swallowed |
| D-109 | LOW | Web-side encoding detection silent errors |
| D-107 | LOW | Server-side CSV silent adapter errors |

---

## Gate Evidence

- `npm run lint` — PASS
- `npm run typecheck` — PASS
- `bun run test` — PASS
- `npx vitest run` — PASS
