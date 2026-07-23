# Review-plan-fix Cycle 6 — architect

**Review baseline:** `449f10a2faffaae2a2c47036070b0e61a5b6eec2` on
`codex/review-plan-fix-no-deploy-20260723`

## Inventory and coverage

I classified all 2,151 tracked paths: 1,028 context/plan/review files, 147 web
files, 865 package files (`core`, `parser`, `rules`, and `viz`), 59 CLI/scraper
files, 18 scripts, 15 E2E files, and 19 root/config/vendor/instruction files.
This includes 309 implementation files, 145 test paths, 683 rule YAML files,
and 30 generated JSON/CSV artifacts. Every review-relevant tracked file was
included in the inventory and source/search pass; no review-relevant file was
skipped.

The architecture pass checked dependency direction and public exports across
web/core/parser/rules/viz/CLI/scraper, browser-versus-Bun boundaries, worker
protocol ownership, canonical taxonomy/card artifacts and source hashes,
schema/semantic validation, persistence versioning, checked numeric output,
static-site deployment/toolchain contracts, generated documentation, tests,
and current architectural guidance. Existing deferred redesigns were not
re-labeled as new findings.

## RPF6-ARCH-001 — the architecture guide still declares Astro 6 after the Astro 7 upgrade

- **Severity:** Low
- **Confidence:** High
- **Status:** Confirmed
- **Location:** `.claude/CLAUDE.md:7,22`
- **Contradicting authorities:** `apps/web/package.json:14-23`;
  `README.md:98`; `bun.lock`

The repository's primary agent/maintainer architecture guide says the web app
uses Astro 6 in both its stack and boundary descriptions. The live manifest
requires `astro ^7.1.3` with `@astrojs/svelte ^9.0.1`, and the user README
correctly says Astro 7. The Cycle 5 aggregate says upgrade-related
documentation drift was corrected, but the tracked guide at this baseline
still contains the old major version.

Why it matters: this file is operational guidance, not archival prose. A
maintainer or coding agent can select Astro 6 APIs, compatibility assumptions,
or migration advice while changing a production Astro 7 application. The
disagreement also makes the claimed Cycle 5 closure non-reproducible.

**Concrete scenario:** a future navigation or integration change is designed
against Astro 6 lifecycle/API behavior because the repository instructions
identify that as the active architecture, while CI builds it under Astro 7 and
the Svelte integration major intended for Astro 7.

**Suggested fix:** update both occurrences to Astro 7 and add a lightweight
documentation-consistency assertion that derives/checks the documented major
against `apps/web/package.json`, alongside the existing toolchain/workflow
consistency tests.

## Other architectural results

No additional new architectural finding survived the duplicate/deferred
sweep. In particular, optimizer/matcher scalability, transaction
virtualization, persistence-size behavior, and hard-coded fallback taxonomy
are already recorded debt; current worker ownership, artifact hash binding,
checked result boundaries, scraper provenance, CLI compiled-catalog loading,
and static deployment direction are internally coherent at this baseline.

## Verification

- Focused parser/upload/worker unit tests: **67 passed, 0 failed**.
- No browser/E2E run was performed, per review constraints.
- No source, plan, protected Cycle 42 file, or pre-existing review provenance
  file was modified.

## Final missed-issue sweep

The final sweep compared instructions, manifests, lockfile/workflow pins,
package exports, generated-artifact readers, and current Cycle 5 closure
claims. It found no other new, non-duplicate architecture issue.
