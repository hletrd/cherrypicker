# Document Specialist — cherrypicker (Cycle 5)

**Reviewer:** document-specialist (sonnet)
**Scope:** Documentation completeness, API contracts, env vars
**Date:** 2026-05-05

---

## Summary

4 findings from cycle 4 remain open. No new documentation was added in cycle 5 despite significant new features (JSON, OFX, HTML parsers, web-side parity fixes). The gap between code velocity and documentation velocity is widening.

---

## Previously Reported — Status

### F-DOC-01 [CRITICAL] No API contract between parser and optimizer

**Status:** OPEN
**Evidence:** `RawTransaction` (parser output) and `Transaction` (optimizer input) are still separate types with no documented mapping. The `installments` field exists in `RawTransaction` but not in `Transaction` with no explanation of where it is consumed.

---

### F-DOC-02 [HIGH] Card rule YAML schema undocumented

**Status:** OPEN
**Evidence:** No `RULES_SCHEMA.md` exists. New rule types (e.g., `condition.type` values) must be inferred from existing YAML files.

---

### F-DOC-03 [HIGH] No architecture documentation

**Status:** OPEN
**Evidence:** No `ARCHITECTURE.md` or `CONTRIBUTING.md`. Package boundaries are understood only by reading source code.

---

### F-DOC-04 [MEDIUM] LLM fallback behavior undocumented

**Status:** OPEN
**Evidence:** No docs explain when LLM fallback triggers, what model is used, cost implications, or rate limits. The model name was recently updated to `claude-sonnet-4-6` but this is only visible in source.

---

### F-DOC-05 [MEDIUM] Environment variables undocumented

**Status:** OPEN
**Evidence:** `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL` mentioned in code but not in README or `.env.example`.

---

## New Findings (Cycle 5)

### [P2-MEDIUM] New parser formats (JSON, OFX, HTML) completely undocumented

**Files:** `packages/parser/src/json/`, `packages/parser/src/ofx/`, `packages/parser/src/html/`
**Confidence:** High

JSON, OFX, and HTML parsers were added in recent commits. No README updates, no format documentation, no expected schema examples.

**Fix:** Add `packages/parser/README.md` section documenting each supported format with sample input/output.

---

### [P2-MEDIUM] No changelog or release notes

**Files:** Entire repo
**Confidence:** Medium

No `CHANGELOG.md` or release notes exist. Users cannot know what formats are supported, what bugs were fixed, or what features were added.

**Fix:** Add `CHANGELOG.md` following Keep a Changelog format.

---

### [P3-LOW] Deferred-fix tracking is fragmented

**Files:** `.context/plans/`
**Confidence:** Medium

20+ plan files with no single deferred-fix registry. Exit criteria for deferred items are scattered across per-cycle files.

**Fix:** Create `.context/reviews/DEFERRED.md` with columns: ID, Finding, First Cycle, Severity, Reason, Exit Criterion, Status.

---

## Verdict

**FIX AND SHIP** — Add `ARCHITECTURE.md` and `RULES_SCHEMA.md`. Document new parser formats. These are writing tasks that do not affect runtime behavior.
