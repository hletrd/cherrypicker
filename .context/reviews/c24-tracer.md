# Tracer — cherrypicker (Cycle 24)

**Reviewer:** tracer
**Scope:** Causal tracing of suspicious flows, competing hypotheses
**Date:** 2026-05-06

---

## Summary

Traced the causal chain from cycle 22's initial HTML sanitization fix through cycle 23's regression patch to cycle 24's residual gap.

---

## Causal Chain

**Cycle 22 (C22-SEC01):** Introduced single regex `/\son\w+=[^>\s]*/gi` to strip event handlers.
- **Hypothesis A:** Regex handles all event handler variants.
- **Reality:** Quoted values with spaces (e.g., `onclick="doThing()"`) were only partially stripped — the regex matched `onclick="doThing` and left `">` behind, corrupting the HTML.

**Cycle 23 (C23-SEC01):** Added second regex `/\son\w+=(?:"[^"]*"|'[^']*')/gi` for quoted values.
- **Hypothesis B:** Two-pattern approach covers all variants.
- **Reality:** Whitespace around `=` (`onclick = "doThing()"`) bypasses BOTH patterns because neither allows `\s*` around `=`.

**Cycle 24 (C24-SEC01):** Same root cause — incomplete regex coverage.

---

## Root Cause

The web-side `normalizeHTML` was written from scratch rather than copied from the server-side implementation (`packages/parser/src/csv/shared.ts`), which uses a different regex pattern. The server-side pattern was not consulted during the cycle 23 fix.

**Competing Hypotheses:**
1. The server-side pattern is also incomplete.
2. The server-side pattern handles whitespace correctly.

**Evidence:** Server-side `packages/parser/src/csv/shared.ts:191-192`:
```ts
.replace(/\son\w+=[^>\s]*/gi, '')
.replace(/\son\w+="[^"]*"/gi, '')
```

The server-side ALSO lacks whitespace handling. Both implementations share the same gap.

**Conclusion:** The gap exists in BOTH server and web implementations. Fixing only the web-side creates a new parity issue.

---

## Recommended Fix Priority

1. Fix BOTH server and web `normalizeHTML` regexes to handle whitespace.
2. Add shared test fixture verifying identical behavior.
