# Cycle 25 — Critic (2026-05-06)

## Assessment

Cycle 25 reveals three categories of residual issues:

1. **Incomplete fixes from prior cycles** — C24 claimed to fix the whitespace-around-equals regex issue in BOTH server and web, but the web-side unquoted pattern at line 43 was missed. This is a process failure: the "BOTH" in the C24 plan was not verified.

2. **Behavioral parity gaps** — The server HTML parser has never had the forward-fill reset on summary rows that the web parser has had since C20. This suggests server-side HTML parsing was added (C98) without fully porting all web-side behavioral fixes.

3. **Stale data propagation** — `reoptimize()` is a relatively new feature (C44 era) and its result construction is missing basic metadata updates. This is a common pattern: new features get the "happy path" right but miss peripheral field updates.

## Severity Calibration

- C25-COR01 (server forward-fill reset): Should be MEDIUM, not LOW. Data corruption (wrong merchant names, dates, or amounts in parsed transactions) is worse than a missed regex strip.
- C25-COR02 (reoptimize stale counts): MEDIUM. Stale metadata confuses users and downstream code.
- C25-SEC01 (unquoted regex): LOW. Defense-in-depth gap, no direct exploit path.
- C25-PERF01 (greedy double calc): LOW. Architectural limitation, not a bug.

## Recommended priority order:
1. C25-COR01 (server forward-fill reset)
2. C25-COR02 (reoptimize metadata)
3. C25-SEC01 (web unquoted regex)
4. C25-TEST01 + C25-TEST02 (test coverage)
5. C25-PERF01 (deferred)
