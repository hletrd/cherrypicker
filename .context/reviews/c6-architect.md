# Cycle 6 — Architect

**Date:** 2026-04-24
**Reviewer:** architect
**Scope:** Full repository architecture

---

## C6-A01: Layout.astro is the missing piece in the BASE_URL migration scope

- **Severity:** MEDIUM
- **Confidence:** High
- **File+line:** `apps/web/src/layouts/Layout.astro:11` (and 17 downstream usages)
- **Description:** Confirms C6-CR01. The Layout is the most impactful file for this issue — it wraps every page and contains the navigation that users interact with constantly. Cycles 3-5 fixed the page files but missed the layout, which has more raw BASE_URL references than all three page files combined. This is a recurrence of the scope-narrowness pattern noted by the critic in C5-CT01. The architectural risk is that the layout is the single shared template; any BASE_URL issue here affects every page simultaneously.

---

## Final Sweep

Architecture is stable. The monorepo structure (packages/core, packages/parser, packages/rules, packages/viz, apps/web, tools/) is well-organized with clear separation of concerns. The D-01 deferred item (duplicate parser implementations web vs packages) remains the largest architectural debt but is appropriately deferred pending a design doc.
