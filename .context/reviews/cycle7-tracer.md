# Cycle 7 Tracer Review

**Date:** 2026-05-05
**Scope:** Causal tracing of data flows and state consistency
**Reviewer:** tracer

---

## Summary

Traced three critical data flows: JSON parsing (server vs web), HTML parsing (server vs web), and category label resolution (YAML → JSON → Map → UI). Found behavioral divergence in all three.

---

## Traced Flows

### Flow 1: JSON negative amount handling

**Path:** `upload → detect('json') → parseJSON → RawTransaction → optimize`

**Server path:** `packages/parser/src/json/index.ts:114` — preserves negative `amount` directly.
**Web path:** `apps/web/src/lib/parser/json.ts:101` — takes `Math.abs(amount)`.

**Divergence:** Same input JSON produces different `amount` values. The optimizer skips `amount <= 0` (`packages/core/src/optimizer/greedy.ts:204`), so server-side negatives are filtered correctly. Web-side converts them to positive, so they pass the filter and inflate totals.

**Root cause:** Server fix (`fcd398b`) never propagated to web-side.

### Flow 2: HTML amount handling

**Path:** `upload → detect('html') → parseHTML → RawTransaction → optimize`

**Server path:** `packages/parser/src/html/index.ts:228` — `if (amount <= 0) continue;` skips non-positive.
**Web path:** `apps/web/src/lib/parser/html.ts:223` — `amount: Math.abs(amount)` converts negative to positive.

**Divergence:** Same HTML statement produces different transaction counts and totals.

### Flow 3: Category label resolution

**Path:** `categories.yaml → build-json.ts → categories.json → web fetch → buildCategoryLabelMap → UI`

**Normal path:** categories.json loads successfully, `buildCategoryLabelMap` produces correct labels.
**Failure path:** Fetch fails → `FALLBACK_CATEGORY_LABELS` used. If taxonomy has new categories, raw IDs shown.

**Divergence:** UI quality depends on network success and fallback freshness.

---

## Hypotheses Tested

| Hypothesis | Result |
|------------|--------|
| H1: Server and web JSON parsers are behaviorally identical | **REJECTED** — web takes Math.abs |
| H2: Server and web HTML parsers are behaviorally identical | **REJECTED** — web converts negatives, server skips |
| H3: Category labels always resolve to Korean | **PARTIALLY REJECTED** — fallback can show raw IDs |
