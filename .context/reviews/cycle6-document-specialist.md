# Cycle 6 — document-specialist

## Doc / code mismatches

1. **(MEDIUM, High) README.md vs actual test commands.**
   Spot-check: the `package.json:test:e2e` script chains `turbo run build --filter=@cherrypicker/core --filter=@cherrypicker/rules && playwright test`. Any doc that recommends `bun test:e2e` without noting the turbo prerequisite is accurate — this is fine. Not a finding.

2. **(MEDIUM, High) `playwright.config.ts` comment vs `e2e/ui-ux-review.spec.js`.**
   Config says `port = 4173`; spec hardcodes 4174. The spec's comment at line 12 "CSP now includes 'unsafe-inline' for script-src" remains accurate, but the base URL is stale.
   No authoritative doc reference for the port — this is purely code/code mismatch (C6UI-01).

3. **(LOW, Medium) `apps/web/src/layouts/Layout.astro:29-41` CSP comment.**
   The comment explains why `'unsafe-inline'` is retained for script-src. It mentions "layout.js (theme toggle)" which is accurate — `public/scripts/layout.js` is loaded inline via `<script is:inline src=...>`. Fine.

4. **(LOW, Medium) `reward.ts:63-80` prose justification for broad-rule subcategory exclusion.**
   The comment is authoritative and explicit. The test fixture (`e2e/core-regressions.spec.js:115-138`) contradicts the doc. The fix is the test, not the doc — confirming C6UI-40.

5. **(LOW, Medium) `CLAUDE.md` project-level — no mention of `data-testid` policy.**
   Could add a "testids required on all interactive elements" rule, but the repo's current state has zero testids; it would be aspirational. Document specialist recommends adding such a rule after the cycle-6 testid migration lands.

6. **(LOW, Medium) `apps/web/public/scripts/layout.js:43-46` inline comment promises the menu is "still accessible (just visually hidden via CSS)" when JS fails, but `Layout.astro:123-125` uses `class="hidden"` not CSS opacity; when JS fails, the Tailwind `hidden { display: none }` makes the menu unreachable. Comment drift.**
   Fix: clarify the comment OR actually move the "always-accessible" fallback to a `progressive-enhancement` CSS class that is opacity 0 + absolute-positioned and becomes visible only when JS fails. (Low priority; flagged.)

## No authoritative-source checks needed (no new SDK / framework introduced).
