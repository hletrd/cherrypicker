# Cycle 17 — Critic Review

**Date:** 2026-05-05
**Scope:** Multi-perspective critique of the whole change surface

## Findings

### C17-CRIT01 [MEDIUM] — The server/web parity maintenance model is showing strain
After 17 review cycles, the manual parity maintenance between server-side (Bun) and web-side (Astro/Svelte) parsers continues to produce divergences. C17-CR01 (trailing-minus capture group) is the latest example of a pattern that repeats every few cycles. The architectural decision to maintain separate copies is producing real bugs.

**Alternative perspective:** Extracting shared patterns into a pure-JS package would add build complexity and coupling. The current approach keeps each parser self-contained and simple.
**Trade-off:** Coupling vs correctness. The current model favors simplicity but sacrifices correctness guarantees.
**Synthesis:** The parity tests introduced in earlier cycles are not sufficient. Consider adding a build-time parity check that compares the regex literals and function bodies between server and web parser files.

### C17-CRIT02 [LOW] — The JSON parser's `findField` is symptomatic of a broader pattern
The `in` operator is used in `findField` but similar patterns may exist elsewhere. A systematic search for `in obj` or `in ` in parser code would reveal if this is an isolated issue or a recurring pattern.

### C17-CRIT03 [LOW] — Migration system is premature but correctly designed
The `MIGRATIONS` object is empty and uses `any` types, which feels like technical debt. However, the comment at lines 110-117 shows careful thought about future evolution. Fixing the types now is low-cost preventive maintenance.

## Cross-Agent Agreement

| Finding | Agents agreeing |
|---------|-----------------|
| C17-CR01 trailing-minus | code-reviewer, architect, debugger, verifier, tracer |
| C17-CR02 `findField` `in` | code-reviewer, security-reviewer, verifier, tracer |
| C17-CR03 `MIGRATIONS` any | code-reviewer, security-reviewer, architect, verifier |

High agreement on C17-CR01 increases signal confidence to HIGH.
