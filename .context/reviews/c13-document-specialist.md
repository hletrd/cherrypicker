# Document Specialist — cherrypicker (Cycle 13)

**Reviewer:** document-specialist
**Date:** 2026-05-05

---

## Summary

No new doc/code mismatches beyond D-02 (README MIT vs LICENSE Apache 2.0). One new documentation gap: the PDF fallback trailing-minus regex (C13-04) has no inline comment explaining the capture group boundary, which contributed to the bug going undetected.

---

## Findings

### C13-DS01: PDF fallback amount pattern lacks capture-group documentation [LOW]

**File:** `apps/web/src/lib/parser/pdf.ts:560-565`
**Detail:** The `fallbackAmountPattern` has 7 capture groups with different semantics (parenthesized negative, currency prefix, "minus" prefix, fullwidth minus, KRW prefix, trailing minus, plain amount). The inline comments explain what each format means but do not document which capture group corresponds to which alternative. This made the group 6 boundary error (C13-04) harder to spot during review.

**Fix:** Add a comment mapping each capture group to its alternative, or consider using named captures if the target JS runtime supports them.

---

### C13-DS02: `CLAUDE.md` tech stack versions may be slightly outdated [LOW]

**File:** `.claude/CLAUDE.md`
**Detail:** The CLAUDE.md lists "Astro 6" and "Svelte 5" as the tech stack. The actual installed versions should be verified periodically.

---

## Re-confirmed

| ID | Severity | Description |
|---|---|---|
| D-02 | MEDIUM | README says MIT, LICENSE is Apache 2.0 (deferred) |

---

## Gate Evidence

- `npm run lint` — PASS
- `npm run typecheck` — PASS
- `bun run test` — PASS
- `npx vitest run` — PASS
