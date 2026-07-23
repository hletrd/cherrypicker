# Cycle 5 — Verifier

**Review target:** `e3aa4241bbdc9c9b1dc3abff0df78e0cc9f8d715`
**Lens:** independently execute proposed failures, challenge competing explanations, and verify current gates and prior closures

## Inventory and baseline

The verification used the complete 2,133-path inventory and current code rather than trusting historical review prose. Declarative/generated coverage used the repository's canonical gates over all 683 cards and 24 issuers. Baseline results:

| Gate | Result |
|---|---|
| `bun run toolchain:check` | expected local-environment failure: host Bun 1.3.12, repository pin 1.2.6 |
| `bun run migrations:check` | pass |
| `bun run dependencies:check` | pass |
| `bun run data:check` | pass; 683 cards / 24 issuers and generated/readme drift clean |
| `npm run lint` | pass across all workspaces; Astro 0 errors/warnings/hints |
| `npm run typecheck` | pass across all workspaces; Astro 0 errors/warnings/hints |
| `bun run test` | pass |
| focused parser/rules/core/scraper/CLI suite | 194 pass, 0 fail, 3,175 assertions across 9 files |
| `bun run web:build:check` | pass, including all bundle/catalog budgets |
| `bun run test:e2e` | 93 pass, 0 fail in 37.0 seconds |
| E2E ownership postflight | clean; no owned runs and port 4173 available |

Because the host Bun differs from the pin, passing results are supporting evidence and not a claim that the exact pinned CI toolchain was reproduced.

## Independent verification matrix

| Primary finding | Verdict | Executed or inspected evidence |
|---|---|---|
| `C5-PERF-001` | confirmed | Counted 27 immutable entries in the 10,054-byte component and compiled it. Both direct compiler output and the production chunk place the lookup object inside the generated `Icon` function. Repeated call sites include the 50-file upload list and reward-row loop. |
| `C5-ARCH-001` | confirmed | A supported Simple Plan clone with `rate: 10` and `annualCap: 1000` passed canonical schema and semantic validation. Two 10,000-won transactions returned 2,000 reward, no cap hits, and no unsupported rules. Full-data search found the only current positive annual cap is manually unsupported, explaining why `data:check` remains green. |
| `C5-DBG-001` | confirmed | Both server and browser OFX parsers transformed `20241340120000[0:GMT]` into the apparently valid `2025-02-09`, returned the transaction, and emitted no error. Source tracing shows the invalid components enter normalizing `Date.UTC()`. |
| `C5-DBG-002` | confirmed | Both parsers accepted a transaction with amount/name but no `DTPOSTED` as `{date: "", amount: 1000}` with no error. A date/name row with no `TRNAMT` yielded neither transaction nor error. Downstream calendar context excludes blank dates or fails when no valid date remains. |

## Why the green suite misses these paths

- Server and browser OFX tests exercise valid timezone timestamps and a bare invalid `20241340`, but not out-of-range components in the timestamp-plus-timezone branch or independently missing required fields (`packages/parser/__tests__/ofx.test.ts:129-190,223-235`; `apps/web/__tests__/parser-ofx.test.ts:190-223`; conformance test `packages/parser/__tests__/conformance/parser-conformance.test.ts:73-92`).
- Rules/calculator/scraper tests preserve the `annualCap` field shape but do not assert that a positive value is either executed or rejected for a supported rule.
- Existing UI/E2E coverage validates observable flows, not whether component-local immutable tables are instantiated per child mount.

No independent runtime finding remained after deduplicating these verified issues against the primary lens reports. The final missed-issues sweep re-ran focused searches over required-field guards, normalizing date constructors, canonical fields unused by execution, worker transfer/cancellation, and static data inside component instance scopes.
