# Cycle 7 — critic review

Focus: find what other agents missed. Skeptical lens on deferred items, repo rules, and plan discipline.

## Findings

### CR7-01 — `playwright.config.ts` reuseExistingServer masks stale-build failures [MEDIUM / Medium]

- File: `playwright.config.ts:19`.
- Evidence: `reuseExistingServer: !process.env.CI`. In local dev, this causes the first `bun run test:e2e` to run against the LAST `astro preview` process still running — i.e., yesterday's build. The test:e2e script runs `turbo run build --filter=@cherrypicker/core --filter=@cherrypicker/rules` before Playwright, but NOT the web app build. So if `@cherrypicker/core` rules changed, the preview server still serves an old compiled bundle.
- Concrete scenario: cycle 6 adds testids to FileDropzone. Tests that grep those testids pass against the OLD preview server (which doesn't have them) — misleading "pass" signal.
- Fix: either `reuseExistingServer: false` or add `turbo run build --filter=@cherrypicker/web` to the test:e2e script so the preview is always fresh.

### CR7-02 — `bun run test:e2e` build step skips the web app [HIGH / High]

- File: `package.json:17`.
- Evidence: `"test:e2e": "turbo run build --filter=@cherrypicker/core --filter=@cherrypicker/rules && playwright test"`. Only two packages are built. The `astro preview` server used by Playwright needs `apps/web/dist/` to exist and be up-to-date. If a developer changes `FileDropzone.svelte` or any Astro page and runs `bun run test:e2e` without having previously built the web app, Playwright will serve stale content.
- Fix: change to `"test:e2e": "turbo run build && playwright test"` (full build) or explicitly `"... --filter=@cherrypicker/web ..."` too.

### CR7-03 — `webServer.command` ignores CWD inheritance [LOW / Low]

- File: `playwright.config.ts:17`.
- Evidence: `command: \`cd apps/web && bunx astro preview ...\``. If Playwright is invoked from a non-repo-root cwd, the relative `cd apps/web` fails silently. Playwright usually is invoked from repo root, so this is acceptable.
- Fix: defer.

### CR7-04 — `.context/reviews/` gets 40+ cycle-N-comprehensive.md files with near-zero new signal [LOW / Low]

- File: `.context/reviews/2026-04-19-cycle*.md`.
- Evidence: cycles 8 through 98 each produced a "comprehensive" review; many have identical "no new findings" text. Git log shows this is a mechanical step. While auditable, it inflates the reviews directory and makes meaningful reviews harder to find.
- Fix: archive convergence cycles (those with zero new findings) under `.context/reviews/archive/`.

### CR7-05 — Cycle 6 plan defers C6UI-04, C6UI-05, C6UI-23 based on "LOW severity" but documents them as WCAG failures [MEDIUM / Medium]

- File: `.context/plans/cycle6-orch-plan.md:74-80`.
- Evidence: plan says "WCAG AA failures that are not scheduled are specifically the contrast items P1-14 handles plus C6UI-04, C6UI-05 (non-text contrast), and C6UI-23 (target size) — these are deferred per severity/scope triage: C6UI-04 and C6UI-05 are LOW; C6UI-23 already meets SC 2.5.8 at exactly 24×24". Technically C6UI-23 meets SC 2.5.8 so it's OK. C6UI-04/05 are non-text contrast (SC 1.4.11); the rationale says "LOW" but SC 1.4.11 is WCAG AA. Deferring AA non-text contrast as "LOW" is a severity-downgrade that runs counter to the orchestrator's explicit "do NOT downgrade severity to justify deferral" rule.
- Fix: re-open C6UI-04 and C6UI-05 this cycle and either patch (swap border/icon colors) or explicitly document the WCAG technique proving compliance.

### CR7-06 — No automated WCAG regression gate [MEDIUM / Medium]

- File: repo-wide.
- Evidence: no axe-core integration in Playwright. The contrast fixes from cycle 6 could regress via a Tailwind theme change without any red signal.
- Fix: add `@axe-core/playwright`; add one test that runs `injectAxe()` on the home page and asserts zero `critical`/`serious` violations. Defer to a follow-up if not in cycle scope.

### CR7-07 — `CLAUDE.md` requires fine-grained commits, but cycles often bundle multiple fixes [LOW / High]

- File: `~/.claude/CLAUDE.md` "Git Commit Rules".
- Evidence: rule says "Commit in a fine-grained way: create one commit per single feature, fix, or enhancement. Do not bundle unrelated changes into a single commit." Cycle 6 landed 5 commits but one (`feat(web): ✨ dashboard a11y + responsive fixes (TransactionReview, SavingsComparison)`) bundles multiple unrelated a11y items. Not a correctness issue but a process compliance one.
- Fix: this cycle ship each e2e fix as a separate commit.

### CR7-08 — Documentation mentions ports 4173 and 4174 inconsistently [LOW / Medium]

- File: `.context/reviews/cycle6-*.md` and `e2e/*.spec.js` historical copies.
- Evidence: Cycle 6 fixed the port mismatch. Should scan remaining docs for any 4174 references.
- Fix: grep and patch any remaining stale port refs.

### CR7-09 — No enforcement that `bun run test:e2e` gate is green before tagging a cycle [HIGH / High]

- File: orchestrator / cycle prompts.
- Evidence: cycle 6 deferred D6-01/D6-02 and accepted 36/74 pass. The orchestrator prompt for cycle 7 explicitly calls this out and requires stabilisation. Good. But going forward, without a repo hook that blocks commit/push on test:e2e red, cycles can silently regress e2e count.
- Fix: add a `.husky/pre-push` hook that runs `bun run test:e2e`. Defer if too slow to be practical; at minimum add a CI pipeline file that runs the gate.

### CR7-10 — Deferred items list across cycles lacks a dedup + exit-criteria index [LOW / Medium]

- File: `.context/plans/00-deferred-items.md`.
- Evidence: exists, but hasn't been touched in several cycles. Real risk of a deferred item being re-surfaced as a "new finding" when it's actually still deferred.
- Fix: refresh `00-deferred-items.md` this cycle with: (a) D6-01 resolution, (b) D6-02 resolution, (c) any items newly deferred in cycle 7.

### CR7-11 — `e2e/ui-ux-screenshots.spec.js` writes into `test-results/ui-screenshots/` but no assertion uses the screenshots [LOW / Low]

- File: `e2e/ui-ux-screenshots.spec.js`.
- Evidence: the spec captures screenshots for manual review but has no `expect(...).toMatchSnapshot()`. So each "test" is effectively a smoke test that just calls `page.screenshot`. They count toward the 74-test total but provide no regression signal.
- Fix: convert to `toMatchSnapshot` with a tolerance, OR move to a non-test utility script. Defer if the manual-review workflow is actively used.

### CR7-12 — `fullyParallel: false` vs per-file `mode: 'parallel'` creates confusion [MEDIUM / High]

- File: `playwright.config.ts:9` and `ui-ux-review.spec.js:11`.
- Evidence: config says global `fullyParallel: false`, but the spec opts into per-describe parallel. The per-describe setting overrides the global — so the 60+ describes in ui-ux-review run concurrently, which is exactly the D6-01 root cause. This design decision (per-file override) should be documented or removed.
- Fix: change the `mode: 'parallel'` to `'serial'` OR set `fullyParallel: true` + `workers: 1`. The former is cleanest.

### CR7-13 — Cycle counter in orchestrator prompt says "cycle 7 of 100" — is the loop expected to run 100 cycles? [LOW / Low]

- File: orchestrator prompt.
- Evidence: suggests a 100-cycle review budget. With convergence cycles already reaching "no new findings" at cycle 98, the marginal value of cycles 99/100 is low. Recommend cap once two consecutive cycles produce zero actionable findings.

## Summary

- Two HIGH items actionable this cycle: CR7-02 (broaden the test:e2e build scope) and CR7-12 (switch ui-ux-review to serial mode — already on the test-engineer list).
- CR7-05 (re-open C6UI-04/05 deferrals) should be examined; if the colors are truly AA-compliant just need a docs-only entry.
