# Cycle 7 Critic Review

**Date:** 2026-05-05
**Scope:** Multi-perspective critique of Cycle 6 fixes and deferred items
**Reviewer:** critic

---

## Summary

Cycle 6 fixes were well-executed individually but missed systemic follow-through. The web-side JSON parser parity regression (C7-CR-01) is the most glaring example: a server-side fix that never propagated to its web-side twin. This is exactly what happens when structural duplication is addressed with behavior-level patches instead of unified code.

The `FALLBACK_CATEGORY_LABELS` Map (A7-ARCH-02) is a new instance of the same anti-pattern that `CATEGORY_NAMES_KO` represented. Extracting `buildCategoryLabelMap` eliminated duplication in CLI commands, but the web app recreated it under a different name. This suggests the problem is cultural (copy-paste habits) not merely technical.

---

## Key Critiques

### 1. Parity fixes are playing whack-a-mole

Every cycle finds new parity drift. The cost of fixing drift exceeds the cost of unifying parsers. After 6+ cycles, the evidence is overwhelming: maintain two parsers, get drift. The architectural investment to extract a shared core is now cheaper than continued parity maintenance.

### 2. Fallback data is a liability

`FALLBACK_CATEGORY_LABELS` exists because the web app needs category labels even when `categories.json` fails to load. But the fallback itself is a liability — it can be stale, incomplete, and shows raw IDs when stale. A better approach: generate the fallback at build time from the canonical YAML. Zero runtime maintenance, zero drift.

### 3. Deferred items accumulate without exit criteria

The cycle 6 aggregate listed 9 still-open findings from previous cycles. Some (brute-force benchmark, PDF three code paths) have been deferred for 3+ cycles without concrete exit criteria. Deferred-fix tracking is itself fragmented across multiple plan files.

### 4. `esc()` is a ticking time bomb

The HTML report `esc()` function has been flagged in Cycle 4, Cycle 5, and now Cycle 6/7. It's incomplete and the fix (use `he` library or comprehensive encoder) is trivial. The fact that this has survived 3+ review cycles suggests either (a) it's genuinely low priority, or (b) it keeps getting lost in the shuffle. If (a), document the risk acceptance. If (b), fix it now.

---

## Recommendations

1. **Structural unification:** Budget one cycle for extracting shared parser core. Stop patching parity.
2. **Build-time generation:** Replace all runtime fallbacks with build-time generated constants.
3. **esc() decision:** Either fix in next cycle or document explicit risk acceptance with owner.
4. **Deferred cleanup:** Consolidate deferred items into a single file with exit criteria and review dates.
