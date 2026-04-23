# Cycle 6 — security-reviewer

## New findings this cycle

1. **(HIGH, High) C6UI-16 — Data-loss on F5 during upload.**
   `apps/web/src/components/upload/FileDropzone.svelte:232-266`. A refresh / accidental navigation while `uploadStatus === 'uploading'` discards the uploaded statement contents; the parser buffer is in-memory only. Not a classic security bug, but is a data-integrity / trust-loss issue explicitly called out by the user-injected TODO-U1 for this cycle. Remediation: `beforeunload` guard returning a non-empty string while uploading.

2. **(MEDIUM, High) C6UI-34 — Unbounded numeric input flows into optimizer perf-tier selection.**
   `FileDropzone.svelte:439-448`. No `max` on the 전월실적 input; a 10-digit slip pushes every card to its top tier and inflates the projected savings the user sees. The user can be socially engineered into a false sense of reward rate. Add `max="10000000000"` + parser clamp.

3. **(LOW, High) CSP — `script-src 'self' 'unsafe-inline'` remains.**
   `Layout.astro:42`. Documented TODO: migrate to nonce-based CSP. Defer per layout comment; no change this cycle.

4. **(LOW, Low) sessionStorage persistence is not encrypted.**
   All analysis results — transaction merchant names, amounts, dates — are stored in sessionStorage in plaintext. Acceptable for same-origin single-user, but if the machine is shared, any subsequent tab opener on the same origin reads the data. Deferred; would require a cryptographic user-side key which the app currently has no flow for.

5. **(LOW, High) inline `onclick="window.print()"` on results.astro:100.**
   This is allowed under the current CSP (`'unsafe-inline'`). Consolidating to a named handler (C6UI-13) reduces the attack surface for future nonce migration.

## No new auth/authz or secret-leak findings — data stays client-side.
