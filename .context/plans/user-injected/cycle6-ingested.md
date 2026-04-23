# User-injected TODOs — pending next cycle

Injected during cycle 5 (2026-04-23), to be picked up at the START of cycle 6's PROMPT 2 (ingested alongside the reviews) and implemented by PROMPT 3.

## TODO-U1 — Deep, critical UI/UX review (Playwright CLI + agent-browser)

**User request (verbatim)**:
> Perform a comprehensive UI/UX review. Use playwright cli and/or agent browser skills to verify user interfaces. Please be deep and critical. Write the results into ./.context/reviews.

**Scope / required coverage** — Must all be exercised, not just inspected statically:
- Full information architecture walk (entry page, navigation, every route reachable from the root of apps/web/).
- Upload / file-parsing user flow end-to-end (the main user task in this app): multiple statement upload, category review, transaction review, optimizer results, report generation.
- Keyboard-only navigation & focus order across every interactive element. Tab/Shift-Tab, Enter/Space activation, Escape dismisses, arrow-key where appropriate.
- Screen-reader semantics: ARIA roles/labels/descriptions, landmark structure, live-region usage on toast/error/loading updates, form-label association.
- WCAG 2.2 AA accessibility: color contrast (text + non-text), focus visibility, reduced-motion respect, click-target size, error identification + suggestion.
- Responsive behavior at canonical breakpoints: 320 (small mobile), 375 (iPhone), 768 (tablet), 1024 (laptop), 1440 (desktop), 1920 (large desktop). Pay attention to overflow, truncation, re-flow, orientation changes.
- States: loading, empty, error, partial-success, success. Every async surface must have all five or a justified subset.
- Dark / light mode parity (if supported): contrast, icon tinting, image inversion.
- i18n / RTL readiness (the app is Korean-primary): verify strings are not hardcoded in inline JSX where externalization would help, check text truncation in narrow columns, check mirrored layouts if RTL is ever a possibility.
- Form validation UX: inline vs submit-time, error messages, success affirmation, data-loss prevention (refresh while uploading, back-button mid-flow).
- Perceived performance: initial LCP, input latency on large uploads, chart render CLS/INP, debounced vs live filters.

**Evidence required** — Findings must be backed by text-extractable evidence since the review model is not guaranteed to be multimodal:
- Use `agent-browser-query` (accessibility snapshot, DOM, computed styles, ARIA) and `agent-browser-visual` (structural + accessibility diff) rather than raw screenshots.
- If Playwright is used (it is already configured in playwright.config.ts and the repo has working e2e tests), prefer actual `npx playwright test` runs that can navigate, click, upload, etc. over static analysis.
- Every finding must include: selector (preferably `data-testid` if present, else a reliable CSS path), measured value (hex color, px size, ratio, etc.), and a concrete failure scenario or standard citation (WCAG clause, HIG, etc.).

**Output**:
- Write one primary review file: `./.context/reviews/cycle6-ui-ux-deep.md`
  - Structure: Executive summary → per-route findings → per-flow findings → global findings (accessibility, responsive, states) → prioritized fix list with severity + confidence.
- Also write one supporting file per specialist angle if it would overflow the primary file (e.g. `cycle6-ui-ux-accessibility.md`, `cycle6-ui-ux-responsive.md`). Avoid spamming near-empty files.
- Update `.context/reviews/_aggregate.md` with cross-agent deduplication.

**Severity rules**:
- Do NOT downgrade severity to avoid work. WCAG AA failures, keyboard traps, data-loss risks, and parsing-flow blockers stay at original severity even if deferred.
- Deferral is permitted only with file:line citation, preserved severity/confidence, concrete reason, and exit criterion. Any deferral of security/correctness/data-loss findings must quote a repo rule that permits it.

**Implementation (PROMPT 3)**:
- Every actionable finding must either be fixed this cycle or explicitly deferred with the full record above.
- Follow repo commit protocol exactly: GPG-sign (`-S`), conventional + gitmoji, no Co-Authored-By, `git pull --rebase` before `git push`, no `--no-verify`.
- Gate run is still mandatory: `bun run verify`, `bun run build`, and for UI changes specifically re-run `bun run test:e2e` to catch regressions.

**Acceptance for this TODO**:
- Primary review file exists and contains numbered findings with selector + evidence + severity.
- At least one Playwright run OR agent-browser session was actually executed (commands visible in the cycle transcript).
- Every finding is either resolved (code + test + commit reference in the review file) OR recorded as a deferred item with exit criterion.
- Cycle 6 END OF CYCLE REPORT counts this TODO's findings in `NEW_FINDINGS` and its plan file(s) in `NEW_PLANS`.
