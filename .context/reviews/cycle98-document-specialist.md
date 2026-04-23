# Cycle 98 — document-specialist pass

**Date:** 2026-04-23

## Scope

Doc/code mismatches against authoritative sources.

## Findings

None net-new.

## Verification

- `README.md` — description, tech stack, and commands match repo state.
- `CLAUDE.md` — tech stack list (Astro 6 + Svelte 5, Bun, Tailwind 4, LayerChart, D3, Zod, Claude API) matches `package.json` and code imports.
- JSDoc comments in `analyzer.ts`, `store.svelte.ts`, `formatters.ts`, `greedy.ts`, `reward.ts` — accurate and up to date. Post-C97-01 JSDoc at `analyzer.ts:369-375` precisely describes the filter rationale and cross-references the issue ID.
- LICENSE vs README — Apache 2.0 in LICENSE, README still says MIT. This is a pre-existing deferred item (D-02). No change.
- CATEGORY_NAMES_KO `TODO(C64-03)` comment at `greedy.ts:7` remains — deferred, documented.

## Docs that match code behavior

- `CLAUDE.md` plans mention Korean merchant matching with `MerchantMatcher`. Code: `packages/core/src/categorizer/matcher.ts` uses merged Korean + English + location + niche keyword dictionaries. Match.
- Card rules stored as YAML → `packages/rules/data/cards/{issuer}/{card-name}.yaml`. Confirmed.

## Summary

0 net-new doc-drift findings. D-02 (LICENSE vs README) remains deferred.
