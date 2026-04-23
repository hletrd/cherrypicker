# Cycle 98 — debugger pass

**Date:** 2026-04-23

## Scope

Latent bug surface, failure modes, regressions.

## Findings

None net-new.

## Latent-bug-class sweep

- **Sort comparators on mixed-length strings** — only sort sites remaining: `analyzer.ts:264` (YYYY-MM), 315 (localeCompare), 343 (YYYY-MM), 376/384 (post-C97-01 filtered ISO); `store.svelte.ts:537` (localeCompare), 559 (YYYY-MM). All safe per my earlier sort-stability analysis.
- **Non-null assertions on Map/array access** — all checked sites are gated by prior length/empty checks. No latent crashes.
- **Async `Promise.all` + per-element error propagation** — `Promise.all(files.map(...))` at `analyzer.ts:287-289`. If one file fails to parse, the whole analysis rejects — this is the intentional all-or-nothing semantics. Error flows to `analyze()` catch at line 478.
- **`sessionStorage` under private browsing** — multiple `try/catch` wrappers with typeof checks. No crashes in WebKit private mode.
- **Circular references in `JSON.stringify`** — the persisted shape is a pure POJO (no circular refs). Safe.
- **Infinity/NaN sentinels** — `SavingsComparison.svelte:110` intentionally uses `Infinity` as a discriminating sentinel (C50-02). Explicitly documented. Safe.
- **Date timezone drift** — all dates are strings (`YYYY-MM-DD`), never `Date` objects. No TZ drift risk.
- **Browser environment assumptions** — `typeof sessionStorage !== 'undefined'` guards throughout. Astro SSR-safe.

## Regression check for C97-01

- **Can the filter ever remove a valid ISO date?** Only if `length < 10` — but `YYYY-MM-DD` is exactly 10 chars. ISO with time (`YYYY-MM-DDThh:mm:ssZ` = length 20) also passes. Any "valid date" of length >= 10 is retained.
- **Can the filter preserve an invalid string of length >= 10?** Yes, theoretically — e.g., `"abcdefghij"` (length 10) would pass the filter. But downstream `formatYearMonthKo` returns '-' for such strings, so the pollution is contained. If such strings appear in `fullStatementPeriod.start`, the UI shows '-' rather than garbage (same graceful degradation as pre-fix). Not a regression.

## Summary

0 net-new debugger findings. C97-01 fix is regression-safe.
