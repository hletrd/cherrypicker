# Document Specialist Review — cherrypicker (Cycle 19)

**Reviewer:** document-specialist
**Scope:** Doc/code mismatches, undocumented features, stale comments
**Date:** 2026-05-06

---

## Summary

Cycle 18's documentation gap for new parser formats remains. Additionally, conflicting comments about 전월실적 calculation conventions create maintenance confusion.

---

## New Findings

### C19-DOC01 [MEDIUM] — New parser formats still undocumented

**File:** `packages/parser/src/{json,ofx,html}/`
**Confidence:** High

JSON, OFX, and HTML parsers were added in cycles 97-100 but have no top-level documentation explaining:
- Supported formats and field aliases
- Expected input structures
- Error handling behavior
- Differences from CSV/XLSX parsing

The only documentation is inline code comments. New contributors or API consumers have no authoritative reference.

**Fix:** Add a `PARSER_FORMATS.md` document to `packages/parser/docs/` or the repo root.

---

### C19-DOC02 [MEDIUM] — Conflicting comments for C1-01 convention

**File:** `apps/web/src/lib/analyzer.ts:327-332`, `apps/web/src/lib/store.svelte.ts:498-519`
**Confidence:** High

Both functions cite C1-01 but describe opposite conventions:
- analyzer.ts: "gross spending, not net. Including refunds would understate..."
- store.svelte.ts: "net spending total, which is the convention most Korean card companies use..."

At least one comment is wrong. The inconsistency makes it impossible for maintainers to know which behavior is correct.

**Fix:** Correct the `store.svelte.ts` comment and code to match the gross spending convention.

---

## Carry-overs from Previous Cycles

- **F-DOC-01 through F-DOC-05** — Documentation gaps (LOW)

---

## Verdict

**FIX AND SHIP** — C19-DOC02 is a maintenance hazard; conflicting comments for the same design note are worse than no comments.
