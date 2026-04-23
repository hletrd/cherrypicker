# Cycle 98 — security-reviewer pass

**Date:** 2026-04-23

## Scope

OWASP top 10, secrets, unsafe patterns, auth/authz.

## Findings

None net-new.

## Security posture

- **XSS** — `grep -r "innerHTML|outerHTML|eval\(|new Function\(|document\.write|{@html}"` across `apps/web/src/` returns no matches. All rendering uses Svelte's automatic escaping.
- **Secret scanning** — `ANTHROPIC_API_KEY` used server-side only (scraper, tools/cli). No client-side secret exposure. `scripts/` and data files are safe.
- **CSP headers** — `script-src 'self' 'unsafe-inline'` unchanged. `'unsafe-inline'` is accepted deferred item D-XX for Astro inline-styles support.
- **sessionStorage data is PII-adjacent** — transaction amounts and merchant names are stored. Same-origin only; no network transmission. The C97-01 fix narrows sessionStorage input to valid ISO dates, reducing the surface for non-attacker-controlled junk strings landing in persistent storage.
- **CSRF** — purely static site, no server-side mutation endpoints. N/A.
- **Dependency audit** — no new dependencies since cycle 96. No known CVEs surfaced in prior audits.
- **Same-origin fetch** — `fetch(${getBaseUrl()}data/cards.json)` uses relative base URL, same-origin. Safe.
- **Input validation** — parser input is user-uploaded CSV/XLSX/PDF. Parsers do not `eval()` or execute content. Row extraction uses `TextDecoder` with replacement-char fallback (cards.ts:32-42) — no buffer overruns.
- **Abort handling** — `AbortController` lifecycle guards against leaked signals (cards.ts:183-241). Safe.

## Commonly-missed-security sweep

- No prototype pollution vectors (no `Object.assign(x, JSON.parse(y))` onto a prototype).
- No `new Function(...)` or `eval()` calls.
- No unsafe deserialization (JSON.parse with type guards).
- No SQL/command injection (no DB or shell invocations).
- No open redirects in `buildPageUrl` (formatters.ts:237-241) — path is prepended to `BASE_URL`, not used as target.

## Summary

0 net-new security findings. The C97-01 fix is defense-in-depth against polluted sessionStorage inputs, mildly improving posture.
