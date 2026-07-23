# Cycle 4 — Security Reviewer, Tracer, and Debugger

**Review target:** `555c56a633f988254854f4110ddf3e3a612c4eb9` on `codex/review-plan-fix-no-deploy-20260723`
**Mode:** review only; no source, plan, browser, E2E, deployment, commit, or push mutation.

## Inventory and method

I inventoried all 2,112 tracked paths before reviewing behavior. The current
runtime surface includes 1,085 paths under `apps`, `packages`, `tools`,
`scripts`, `.github`, and `e2e`, including 683 card-rule YAML files and 129
test/spec paths. I content-scanned the complete current source/config/test
surface, structurally inspected the bulk rule and historical trees, and read
the security- and correctness-sensitive implementations and their consumers in
full.

The causal traces covered:

- browser admission → worker parsing → categorization → optimization →
  persistence/dashboard/report;
- CLI argument parsing → local-first statement parsing → explicit remote-LLM
  consent → optimization/report output;
- scraper arguments → issuer/host policy → DNS pinning → fetch limits → LLM
  tool output → canonical validation → symlink-resistant writer → terminal;
- authored rules → generated publication identity → browser/CLI catalog
  validation; and
- GitHub Actions permissions, immutable action references, dependency/vendor
  policy, and deployed static-page boundaries.

The application is a static GitHub Pages client and has no account, session,
server API, or privileged data mutation surface, so authentication and
authorization controls are not applicable at this revision. I found no
embedded credentials; the Anthropic key remains environment-only. I also
cross-checked the Cycle 1–3 aggregates and completed plans before reporting.
Two findings below are narrower cases left behind by completed Cycle 3 fixes;
already-closed behavior was not relabeled as new.

Validation was browser-free and read-only:

- 135 focused calculator, optimizer, CLI option/command, and real terminal-sink
  tests passed with zero failures.
- Direct probes reproduced every finding below.
- The scraper validator accepted card names containing OSC-52, CSI, CR, and
  BEL bytes.
- `cherrypicker scrape --help` exited through the error path, and duplicate
  singleton options selected the last value.
- Minimal public-core fixtures reproduced the occurrence, empty-best-card, and
  non-KRW result inconsistencies.

## Findings

### C4-SEC-001 — LLM-controlled scraper text reaches the inherited terminal without sanitization

- **Severity:** Medium
- **Confidence:** High
- **Status:** confirmed
- **Location:** `packages/rules/src/schema.ts:222-236`;
  `tools/scraper/src/extractor.ts:97-125`;
  `tools/scraper/src/validators.ts:23-43,166-170`;
  `tools/scraper/src/cli.ts:99-104,118-132`;
  `tools/cli/src/commands/scrape.ts:102-104`
- **Failure:** A compromised or prompt-injecting allowed card page can cause
  the model to return a schema-valid `card.name` or `card.nameKo` containing an
  OSC-52 clipboard sequence, OSC-8 hyperlink, CSI display sequence, or
  carriage return. The canonical schema accepts arbitrary strings for these
  fields, the scraper prints them directly at `cli.ts:121`, and the root CLI
  gives the child inherited stdio. The parent CLI's sanitizer therefore never
  sees the bytes. User-controlled output paths and model-derived validation
  failures also have unsanitized direct-scraper sinks.
- **Reproduction:** `validateExtractedRules()` returned `valid: true` for a
  canonical rule whose names contained
  `\u001b]52;c;YXR0YWNr\u0007`, `\r`, and `\u001b[31m`. By contrast, the
  statement commands and visualization package already remove these exact
  classes.
- **Competing hypothesis eliminated:** Issuer equality, URL/host controls,
  rule-domain validation, and safe card IDs constrain network and filesystem
  behavior, but none constrain display strings. Running through
  `cherrypicker scrape` does not help because `stdio: 'inherit'` bypasses the
  root process's sanitized error boundary.
- **Root fix:** Put every dynamic scraper console/error value through the same
  shared terminal renderer used by CLI/viz before it reaches inherited stdio,
  including card names, URLs, output paths, allowed hosts, saved paths, and
  top-level errors. Prefer additionally rejecting C0/C1, escape, and bidi
  controls from authored/model-produced catalog display fields. Add a
  subprocess regression that injects OSC-8/52, CSI, CR/LF, C1, and bidi values
  through a successful extracted rule and through a validation failure.

### C4-CLI-001 — `scrape` remains outside the strict/help option contract and silently applies the last singleton value

- **Severity:** Medium
- **Confidence:** High
- **Status:** confirmed
- **Location:** `tools/cli/src/index.ts:8-33,53-68`;
  `tools/cli/src/command-options.ts:4-6,245-300`;
  `tools/cli/src/commands/scrape.ts:19-72,86-109`;
  underlying help at `tools/scraper/src/cli.ts:24-43,74-79`;
  completed acceptance at
  `.context/plans/81-cycle3-cli-report-integrity.md:36-41,52-53`
- **Failure:** `cherrypicker scrape --help` fails with “unknown option”
  instead of returning side-effect-free help, even though root help advertises
  `--help` and the spawned scraper has help that the wrapper never reaches.
  More importantly, repeated singleton options are silently last-wins:
  `--issuer kb --issuer samsung` selects Samsung, and repeated `--url` or
  `--output` similarly changes the eventual network/API/write target. A typo
  in an expensive or overwriting command can therefore run successfully
  against a different target than the operator first specified.
- **Reproduction:** The root command printed
  `오류: 알 수 없는 옵션입니다: --help`. A direct parser probe with duplicate
  issuer and URL values returned `issuer: "samsung"` and only the second URL;
  duplicate `--force` was also accepted. Existing scrape tests cover required
  issuer and forwarding, but omit help and duplicate rejection.
- **Competing hypothesis eliminated:** The shared parser correctly handles
  help, aliases, unknown options, missing values, and duplicates, but its
  command union is explicitly only `analyze | optimize | report`. The child
  parser cannot repair the issue because the wrapper has already rejected
  help or collapsed duplicates before spawning it.
- **Root fix:** Give `scrape` a declarative strict option specification and
  generated help at the root boundary. Mark only `--allow-host` repeatable;
  reject repeated issuer, URL, output, force, help aliases, unknown tokens, and
  missing values before any spawn/network/write. Reuse the same specification
  when constructing child arguments and add root subprocess exit/stdout and
  no-spawn assertions.

### C4-DBG-001 — A valid zero-yield reward consumes `maxUses` and suppresses a later positive reward

- **Severity:** Medium
- **Confidence:** High
- **Status:** confirmed
- **Location:** `packages/core/src/calculator/reward.ts:135-149,375-385,388-424,545-611`;
  existing no-op policy test at
  `packages/core/__tests__/calculator.test.ts:913-930`;
  completed Cycle 3 intent at
  `.context/plans/79-cycle3-domain-parser-correctness.md:10-11,32-33`
- **Failure:** With a one-percent rule limited to one monthly use, a valid
  one-Won transaction calculates to zero after flooring but sets
  `occurrenceApplied = true`. It consumes the only occurrence, so a later
  1,000-Won transaction earns zero instead of 10 Won. The fixed-mileage branch
  likewise marks a sub-1,500-Won zero-mile result as applied, and a positive
  fractional fuel fact can floor to zero while consuming an occurrence.
- **Reproduction:** A minimal `maxUses: 1` fixture with amounts `[1, 1000]`
  returned total reward `0` and no issue; reversing/removing the first row
  allows the second row's 10-Won reward. This is not the unsupported-fact case
  fixed in Cycle 3: the tier, date, conditions, unit, and facts are all valid.
  The existing `won_per_day` regression explicitly establishes that a zero
  no-op must not consume a later monthly occurrence.
- **Competing hypothesis eliminated:** Moving accounting after tier/unit/fact
  validation fixed unsupported candidates, and cap-clipped positive rewards
  intentionally count. Here the uncapped reward itself is zero, before any cap
  clipping, but the rate and mileage/fuel branches set the boolean
  unconditionally.
- **Root fix:** Define occurrence consumption from a positive executable
  `uncappedReward`, not merely from entering a supported calculation branch.
  Preserve the rule that an originally positive reward still counts after
  per-transaction/monthly/global cap clipping. Add rate-rounding, sub-1,500
  mileage, fractional fuel, and positive-but-cap-clipped matrices with a later
  eligible transaction.

### C4-DBG-002 — All-zero optimization violates the non-empty `bestSingleCard` result contract

- **Severity:** Medium
- **Confidence:** High
- **Status:** confirmed
- **Location:** `packages/core/src/optimizer/greedy.ts:343-355`;
  `packages/core/src/models/result.ts:41-49`;
  `packages/core/__tests__/optimizer.test.ts:327-335`;
  consumers at `packages/viz/src/terminal/comparison.ts:39-47`,
  `packages/viz/src/report/generator.ts:242-263`, and
  `apps/web/src/components/dashboard/SavingsComparison.svelte:190-205`
- **Failure:** `bestSingleCard` starts with empty IDs/names and is updated only
  for a strictly greater-than-zero reward. If one or more real cards are
  evaluated but all earn zero, assignments and card results identify a card
  while `bestSingleCard` remains `{ cardId: "", cardName: "", totalReward: 0 }`.
  The dashboard treats the object as present and renders a blank card-name
  panel, while terminal and saved HTML reports print a blank “single best
  card.” The public result also violates its implied identity invariant.
- **Reproduction:** One real `shinhan-mr-life` card plus a 50,000-Won
  entertainment transaction produced a valid Mr. Life assignment and the
  empty `bestSingleCard` object. The existing all-zero test asserts only that
  assignments exist and total reward is zero, so the contradictory identity
  passes.
- **Competing hypothesis eliminated:** This is not an empty catalog or missing
  assignment. The card is loaded, scored, assigned, and present in
  `cardResults`; the strict comparison alone prevents the baseline record from
  being initialized.
- **Root fix:** Initialize the baseline from the first evaluated card (or
  update when no baseline exists) and retain deterministic first-card
  tie-breaking for equal rewards. Reject an actually empty `cardRules` input
  with a clear boundary error rather than returning an identity-less result.
  Extend the all-zero and tied-zero tests through core, terminal, HTML report,
  and dashboard consumers.

### C4-DBG-003 — Optimizer and calculator disagree on non-KRW eligibility, producing internally contradictory totals

- **Severity:** Medium
- **Confidence:** High
- **Status:** confirmed
- **Location:** `packages/core/src/models/transaction.ts:3-9`;
  `packages/core/src/calculator/reward.ts:481-499`;
  `packages/core/src/optimizer/greedy.ts:55-100,121-196,199-238,271-340`
- **Failure:** The public calculator explicitly skips a positive non-KRW row,
  but the optimizer filters only on positive amount. Scoring therefore gives
  every card zero, assigns the row to the first card, and includes its nominal
  amount in category assignments and `OptimizationResult.totalSpending`.
  `buildCardResults()` then calls the calculator, which skips the same row and
  reports that assigned card's spending as zero. Consumers can consequently
  receive `totalSpending = 100000`, an assignment spending of `100000`, and a
  card result spending of `0` for the same transaction.
- **Reproduction:** A direct public-core optimization of one 100,000-USD row
  with the Simple Plan card produced exactly those values, plus a zero-reward
  assignment. Browser adapters currently stamp normalized transactions as
  KRW, which limits product reach, but `Transaction.currency` is a required
  public field and the calculator deliberately documents non-KRW handling.
- **Competing hypothesis eliminated:** The calculator's skip behavior is
  working as written. The inconsistency is introduced before it by the
  optimizer's separate amount-only eligibility predicate and later by summing
  `txAssignments` rather than the calculator-approved rows.
- **Root fix:** Give calculator and optimizer one canonical transaction
  eligibility rule. Either skip non-KRW rows before scoring/assignment/totals
  (with an inspectable skipped-row disclosure) or reject them at the optimizer
  boundary; do not assign a row the calculator cannot count. Assert equality
  among assignment spending, optimization total spending, and summed
  `cardResults` for KRW, absent/default currency if supported, and non-KRW
  inputs.

## Final sweep and coverage

- No additional current OWASP-class issue met the reporting threshold in web
  rendering, report generation, remote-PDF consent, catalog URLs, worker
  messages, session persistence validation, scraper SSRF defenses, or
  filesystem writers. External URLs are HTTP(S)-only and credential-free;
  report/catalog text is escaped; scraper redirects repeat DNS/public-address
  validation and verify the connected peer; report and rule writers reject
  unsafe final symlinks.
- Workflow permissions are least-privilege per job, checkout credentials are
  not persisted, and every action is commit-pinned. No hard-coded secret,
  dynamic evaluation, user-controlled `{@html}`, or server-side auth bypass
  surface was found.
- I traced the web operation-epoch, worker termination, shared catalog request,
  replacement persistence, edit/reoptimization, and delayed-navigation paths.
  Their current ownership checks close the Cycle 2–3 stale-commit failures; I
  found no new race above threshold.
- `sanitizeTerminalText()` retains U+2028/U+2029 despite its “one visible line”
  wording. The bytes are reachable from parser diagnostics, but an actual tmux
  terminal capture kept them on one physical row. Because line splitting is
  renderer/log-viewer dependent, I did not count this as a confirmed terminal
  injection; add those separators to the sanitizer if output is consumed by a
  Unicode-aware log renderer.
- Known/deferred CSP `unsafe-inline`, sessionStorage plaintext, server-parser
  whole-file limits, incremental optimizer complexity, and matcher compilation
  work were not duplicated. The six pre-existing Cycle 42 artifacts and all
  concurrent review files were left untouched.

Coverage is complete for the requested security/tracer/debugger lens: every
tracked path was inventoried, all current code/config/test files were
content-scanned, all trust boundaries and cross-file consumers were traced,
bulk rule/history trees were structurally inspected, prior closures were
checked, the five findings were independently reproduced, and the final missed
issue sweep found no further current defect above the evidence threshold.
