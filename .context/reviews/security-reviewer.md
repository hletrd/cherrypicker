# Cycle 19 security review

Date: 2026-07-24
Baseline: `fcc89801451d1c1a31bb9881d213e117fc4ca923`
Full provenance:
`.context/reviews/2026-07-24-cycle19-security-reviewer.md`

## Result

**0 genuinely new security findings.**

Confidence is High for the Cycle 18 delta and medium-high for the whole-tree
negative result. Review was defensive and read-only apart from reports; no
browser, E2E, deployment, or publication was used.

## Inventory

All 2,409 tracked paths were inventoried: 1,237 `.context` paths and 1,172
active paths. The active inventory includes one workflow, 172 web paths, 47
core, 86 parser, 734 rules/data, 14 viz, 28 CLI, 35 scraper, 21 scripts, 16
E2E, three vendor, and 15 root/configuration paths.

The complete 66-path Cycle 18 delta was inspected. The calendar change adds no
privilege or interpretation boundary
(`packages/core/src/analysis/context.ts:3-114`). Publication hashing consumes
identity-free, validated browser and legacy projections before identity
injection (`scripts/catalog-publication.ts:93-136,353-412`;
`scripts/build-json.ts:301-400`). Module-TypeScript discovery enters the
existing static import classifier and does not execute reviewed code
(`scripts/check-dependencies.ts:11-22,465-510,532-692`).

## Security evidence

- No live tracked credential marker was found; runtime model credentials remain
  environment-only.
- Browser dynamic data remains escaped; the raw-HTML icon sink is
  repository-owned (`apps/web/src/components/ui/Icon.svelte:1-83`).
- Persistence rejects prototype-affecting keys and exhaustively validates
  accepted shapes (`apps/web/src/lib/persistence.ts:68-125,522-547,720-922`).
- Scraper URL/DNS/redirect, response-bound, validation, and safe-write controls
  remain present (`tools/scraper/src/network-policy.ts:1-271`;
  `tools/scraper/src/fetcher.ts:87-317`;
  `tools/scraper/src/writer.ts:114-405`).
- CI retains empty top-level permissions, immutable actions, frozen install,
  verification, and a separately authorized Pages job
  (`.github/workflows/deploy.yml:1-68`).
- `bun audit --json` returned an empty advisory object;
  `dependencies:check` and vendor/peer/import policy passed.

## Non-security handoff

The deliberate `0000-01` predecessor `RangeError` can escape truncated
coherence and `deserializeAnalysis()` before the store catches it
(`packages/core/src/analysis/context.ts:96-114`;
`apps/web/src/lib/analysis-result.ts:922-981`;
`apps/web/src/lib/persistence.ts:822-915`;
`apps/web/src/lib/store.svelte.ts:117-148`). This is confirmed Low reliability
impact, High confidence, and is owned by the debugger/verifier. It is not a
security finding because same-origin storage write authority already permits
direct denial/data deletion, and the store recovers.

No likely security finding or new manual-only security risk survived the final
sweep. Existing plaintext-session, static-CSP, third-party-link, and
remote-model-consent risks remain historical dispositions.

Focused verification passed 77 tests/185 expectations, core/web typechecks,
dependency and data drift gates, commit signatures, and remote parity. No
deployment was performed.
