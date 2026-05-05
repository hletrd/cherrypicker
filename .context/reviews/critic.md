# Critic — cherrypicker (Cycle 20)

**Reviewer:** critic (opus)
**Scope:** Full repository — design, maintainability, deferred-fix tracking
**Date:** 2026-05-05

---

## Summary

Cycle 19 fixed consistency issues but structural debt continues to accumulate. The server/web parser duplication now spans 6 formats with manual parity comments. The deferred-fix system has 20+ plan files with no master registry. The most concerning pattern: every cycle finds the same architectural issues but they are deferred indefinitely.

---

## New Findings

### [C20-CRIT01-MEDIUM] Every cycle re-identifies the same architectural issues without action

**Files:** `.context/plans/`, `.context/reviews/`
**Confidence:** High

The following issues have been reported in 5+ consecutive cycles and deferred each time:
- Server/web parser duplication (cycles 2-20)
- CATEGORY_NAMES_KO hardcoding (cycles 3-20)
- No parity tests between server/web parsers (cycles 6-20)
- No architecture documentation (cycles 4-20)

The deferral rationale is always "requires significant refactoring" or "out of scope for this cycle." But the cost of deferral compounds: each new parser format (JSON, OFX, HTML) must be implemented twice, doubling the bug surface.

**Fix:** Either schedule a dedicated refactoring sprint, or close the issues as "won't fix" with explicit rationale. Indefinite deferral is worse than explicit rejection.

---

### [C20-CRIT02-LOW] Plan files accumulate without archival

**Files:** `.context/plans/`
**Confidence:** High

There are 40+ plan files in `.context/plans/`. Many are from cycles 1-10 and contain fixes that were completed long ago. The directory serves as both active plan storage and historical archive, making it hard to find current work.

**Fix:** Move completed cycle plans to `.context/plans/_archive/`. Keep only active (current cycle) and deferred items in the root.

---

## Previously Reported — Status

| ID | Description | Severity | Status |
|----|-------------|----------|--------|
| A-ARCH-01 | Server/web parser duplication | CRITICAL | **OPEN** — 6 formats now |
| CATEGORY_NAMES_KO | Hardcoded labels | HIGH | **OPEN** — still in greedy.ts |
| F-CRI-03 | Deferred-fix tracking fragmented | MEDIUM | **OPEN** |

---

## Verdict

**REDESIGN REQUIRED** for parser architecture. **FIX AND SHIP** for plan archival.
