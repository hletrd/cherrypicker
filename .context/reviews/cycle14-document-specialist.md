# Review-plan-fix Cycle 14 — document specialist

- Date: 2026-07-24
- Reviewed revision: `5260bbd9b6f44ff35cf1bb9a11819354003e5161`
- Branch: `codex/review-plan-fix-no-deploy-20260723`
- Disposition: **changes requested**
- Final count: **1 genuinely new documentation finding — 1 Low**
- Scope: documentation review and this report only; no README, source, test,
  plan, generated-data, configuration, workflow, staging, commit, push,
  deployment, browser, preview-server, or E2E change/run

## Inventory and authority model

I reset the documentation audit at the exact revision above and inventoried all
**2,337 tracked paths**: **1,169** tracked `.context` paths and **1,168**
active product, data, test, documentation, workflow, configuration, and
vendor-integrity paths.

There are **1,197 tracked Markdown files**. Of those, 1,168 are under
`.context`; the 29 other files are:

- the root `README.md`;
- `.claude/AGENTS.md` and `.claude/CLAUDE.md`;
- 24 generated issuer READMEs;
- `vendor/README.md`; and
- `.omc/plans/cycle14-fixes.md`, which is dated, complete implementation
  provenance rather than current user or contributor guidance.

The license was reviewed separately. I also treated the following executable
or source-level surfaces as documentation contracts:

1. root scripts, command help, scraper operating guidance, and errors;
2. public browser, terminal, and standalone-report copy;
3. exported types, JSDoc, and comments that define API behavior;
4. generated README templates, schemas, and publication checks;
5. deployment workflow, Astro hosting configuration, toolchain pins, and
   verification instructions; and
6. current plans/reviews where they claim completion, scope, provenance, or a
   safe Cycle 14 repair.

Claims were followed through the calculator, optimizer, worker, analysis,
persistence, web and visualization sinks, package barrels, root/workspace
manifests, workflow, canonical YAML data, generators, and focused tests. The
full historical ledger and every available same-cycle report were indexed for
duplicate control.

## Finding

### C14-DOC-001 — `capSuppressionsComplete` documents only overflow, but also means ordered telemetry could not be reconciled

- **Severity:** Low
- **Confidence:** High
- **Status:** Confirmed; genuinely new public-API documentation mismatch
- **Misleading comment:** `packages/core/src/calculator/types.ts:75-77`
- **Public export:** `packages/core/src/index.ts:53-68`
- **Contradictory implementation:**
  `packages/core/src/calculator/reward.ts:1528-1600`
- **Exact non-overflow regression:**
  `packages/core/__tests__/cycle13-cap-loss-telemetry.test.ts:854-888`
- **Overflow control:**
  `packages/core/__tests__/cycle13-cap-loss-telemetry.test.ts:1245-1268`

`CalculationOutput` is returned by the public `calculateRewards()` function
and exported from the package barrel. Its current field comment says:

> False when an exact diagnostic would exceed safe-integer arithmetic.

That is one reason for `false`, but it is not the field's current contract.
The calculator also sets the value to `false` when an ordered cap-free
counterfactual reward is lower than the actual contribution
(`reward.ts:1566-1572`). In that case positive transaction rows cannot
represent the negative offset honestly. The array can already contain valid
earlier suppression rows, but it is partial and must not be treated as a
complete suppression total. Other reconciliation-invariant failures at
`reward.ts:1587-1599` also use the same fail-closed value.

The existing deterministic stateful fixture proves the mismatch without any
unsafe integer:

- `calculateRewards()` returns an ordinary safe total reward of 9,000;
- `capSuppressions` contains one valid positive row;
- `capSuppressionsComplete` is `false`; and
- the optimizer consequently publishes `portfolioCapLosses: undefined`.

The separate maximum-safe-integer fixture proves the documented overflow case,
but it does not make overflow exhaustive.

This does not change calculation correctness: the boolean correctly fails
closed, and the optimizer respects it. The impact is developer interpretation.
An API consumer following IDE hover documentation can misdiagnose an ordered
state/reconciliation limitation as numeric overflow or publish the partial
array without understanding why it is incomplete. That keeps severity Low.

#### Suggested fix

Replace the cause-specific sentence with a stable semantic contract, for
example:

```ts
/**
 * False when capSuppressions is partial because the ordered cap-free
 * diagnostic cannot be represented or reconciled exactly. Callers must not
 * interpret the array as a complete suppression total when this is false.
 */
```

The wording should define the consequence rather than enumerate every internal
reason, which would drift as reconciliation gains new fail-closed cases. The
negative-offset and unsafe-arithmetic tests should remain the two controls for
the comment.

#### Novelty

`git blame` and `git log -S` assign both the field and its comment to telemetry
commit `d7ffac3`. That commit was made after the Cycle 13 document-specialist
baseline. Plan 138's completion evidence correctly says that negative offsets,
hidden state, unsafe arithmetic, and cap-free ties fail closed to unknown, but
the new public field comment narrows the reason to arithmetic.

A full `.context` search found no prior owner for this field/comment mismatch.
Cycle 10's low-confidence generic note that some public functions lack JSDoc
does not own a later field that has specific but incomplete documentation.
Cycle 13's `CapInfo`/analysis-wide no-loss finding concerned event-local reach
copy and is also a different root. No historical ID is being relabeled.

## README and user-document audit

No separate README or user-facing documentation defect survived.

- The README's CSV/TSV, XLS/XLSX, PDF, JSON, OFX/QFX, and HTML/HTM format list
  matches the parser dispatchers and publication test.
- Its current generated catalog values—683 authored cards, 551
  optimizer-executable cards, and 24 issuers—match the YAML corpus, published
  artifacts, issuer indexes, and `docs:check`.
- Astro 7, Svelte 5, Tailwind CSS 4, TypeScript 5.9, Bun 1.3.12, static
  GitHub Pages hosting, and the repository paths match manifests and
  configuration.
- The gross-monthly-reward disclosure consistently says every included card is
  assumed available, annual fees are not deducted, and the result is not net
  savings or card ownership cost.
- The remote-PDF flow is accurately described as local-first, default-off,
  consent-gated, and requiring `--yes` when non-interactive. The scraper key,
  model, issuer, host expansion, overwrite, quarantine, source-review,
  `data:build`, and `data:check` sequence matches both command help and code.
- Both agent guides' paths, versions, generator ownership, and validated YAML
  examples are current. The vendor README agrees with the committed SheetJS
  archive and integrity/dependency gate.
- The issuer README family is generator-owned and byte-current. It consistently
  distinguishes optimizer-executable and catalog-only cards.

## Cap-loss terminology audit

The Cycle 13 presentation repair is truthful and consistent across its sinks:

- the authoritative result-level section is “한도로 줄어든 최종 혜택” and says
  it is the remaining monthly benefit reduction after applying other reward
  rules and cards;
- each row separates gross cap suppression, replacement reward, and final net
  reduction;
- the assignment-scoped section is “혜택 한도 도달 내역” and explicitly calls
  itself a transaction-level applied result, separate from final analysis
  loss; and
- no production sink makes the old unqualified `혜택 손실 없음` claim.

Browser copy lives at
`apps/web/src/components/ui/CapDisclosures.svelte:27-76` and
`apps/web/src/lib/cap-disclosures.ts:54-85`. Terminal and standalone-report
copy share the same distinction through
`packages/viz/src/cap-disclosure.ts:16-49`,
`packages/viz/src/terminal/comparison.ts:80-107`, and
`packages/viz/src/report/generator.ts:419-450`.

`OptimizationResult.portfolioCapLosses` also documents the critical API
distinction correctly: `undefined` means unknown, while a present empty array
means known zero (`packages/core/src/models/result.ts:106-114`). Presentation
remaining silent for both unknown and known-zero is the explicit completed
Plan 138 policy; it does not recreate the former false no-loss statement.

The older terse `CapInfo.actualReward`/`appliedReward` comments still omit the
words “transaction-local,” but this exact ambiguity belonged to Cycle 13's
merged cap-disclosure root. Current user copy and the new
`CapSuppressionCause` comment now preserve the reach-event boundary, so it was
not reopened under a new ID.

## Does RPF14-PERF-001 require user-facing documentation?

No. The confirmed Cycle 14 performance root changes neither public input nor
output, knownness, displayed terminology, persistence schema, deployment
procedure, nor a documented latency guarantee. A README feature note,
changelog promise, or benchmark claim would add user-facing surface without
helping users operate the product.

The safe fix does require one **internal** documentation contract:

- a private/default-off replay policy must say that only the optimizer may
  assert a previously reconciled prefix;
- it must describe `capSuppressionStartIndex` as an emission boundary, not as
  that proof;
- it must state that stateless old rows alone may bypass counterfactual work,
  while all `maxUses` and fixed-per-day histories retain full replay; and
- ordinary public and direct prepared calls must default to the existing full
  path.

This comment belongs beside the private discriminated option or branded proof.
The capability must remain absent from the public barrel. The current
architect, critic, debugger, performance, tracer, and verifier reports all
converge on that same safe boundary; none recommends an unchecked public fast
path.

## Plan, review, deployment, and workflow truthfulness

- Plans 138, 139, and 140 are marked complete and name commits `d7ffac3`,
  `4fa1385`, and `b25b462`; all three commits are ancestors of the reviewed
  HEAD. Their outcome and completion evidence match current code and tests.
- Plan 138 distinguishes known, known-zero, and unknown telemetry and documents
  stateful/negative-offset fail-closed behavior. Plan 139 preserves direct
  validation while using an invocation-local prepared value. Plan 140 removes
  the incompatible optional peer and adds present-peer validation.
- Same-cycle reports consistently retain one product root,
  `RPF14-PERF-001`, with Medium severity and an optimizer-owned proof
  requirement. Differences in host timings do not change the deterministic
  operation-count conclusion.
- The root README correctly describes `bun run verify` as static, unit, data,
  and build verification, then lists Playwright regression as an additional
  CI gate. The deploy workflow runs both in that order.
- Pull requests receive read-only verification and no Pages publication
  authority. Only `main` pushes and manual dispatches upload/deploy. All
  actions are commit-SHA pinned; write permissions are isolated to the deploy
  job.
- Astro is configured for static output at the documented GitHub Pages
  site/base. The README accurately explains that Pages cannot supply the
  desired response headers and does not overclaim that a meta CSP provides
  `frame-ancestors` protection.

## Rejected, historical, and non-finding candidates

| Candidate | Adjudication |
| --- | --- |
| README entry for `RPF14-PERF-001` | **Rejected.** The repair is internal and output-identical; only the new private proof seam needs a precondition/default comment. |
| Current cap-loss wording | **Verified.** Final portfolio loss and transaction-local cap reach are distinct in every browser, terminal, and report sink. |
| Silent unknown telemetry | **Intentional Plan 138 contract.** The UI makes no no-loss claim; `OptimizationResult` documents unknown for API consumers. |
| `CapInfo` transaction scope | **Historical Cycle 13 owner.** The former user-facing overclaim is fixed and was not relabeled. |
| General missing public JSDoc | **Historical generic note, not this finding.** `C14-DOC-001` concerns a new field with specifically misleading causal wording. |
| CSP nonce TODO | **Known deferred infrastructure work.** The comment and README explain the present Pages/meta limitation accurately. |
| Plaintext session storage comment | **Accurate known limitation.** It names the threat model and lack of encryption rather than promising protection. |
| README “AI embedding” text | **Accurate.** It explicitly says the feature is unimplemented and not on the roadmap. |
| `.omc/plans/cycle14-fixes.md` | **Historical provenance.** Its dated, complete implementation narrative is not current operating guidance. |
| Prefixed/leading-NUL XLSX inflation hypothesis | **Rejected absent new evidence.** At this exact HEAD, a real workbook prefixed with NUL begins `[0, 80, 75]` and ZIP preflight classifies it `not-zip`. Direct SheetJS produced a synthetic sheet containing raw ZIP/XML text rather than recovering the original worksheet; the production parser returned zero transactions and `header row not found`. No documentation change should legitimize the unsupported hypothesis. |

## Verification and final missed-file sweep

- Focused documentation/workflow/disclosure suite:
  **47 passed, 0 failed, 934 expectations across six files**.
- `bun run docs:check`: current for 683 cards, 551 optimizer-executable cards,
  and 24 issuers.
- `bun run data:check`: every YAML, generated public artifact, category
  fallback, optimizer catalog, detail shard, and README index matched.
- Root, analyze, and scrape help rendered successfully and matched the README's
  command, privacy, issuer, host, output, overwrite, and quarantine claims.
- `git diff --check 3e2d663..HEAD` and local `git diff --check` passed.
- The exact-HEAD full `bun run verify` had already passed in this review
  rotation, including toolchain, migration, dependency, audit, data/docs,
  lint, typecheck, workspace/root tests, static build, and bundle budgets.
- The tracked working tree remained identical to `HEAD`; before this report its
  sorted working-file SHA-256 manifest digest was
  `abc844d5b431b372be02130c9dee0329e8e0b6410ad7c2c1f7bf5fb5fe6cb899`.
- No browser, server, deployment, or E2E process was launched by this role.

The six protected Cycle 42 artifacts retained their original SHA-256 hashes:

| Artifact | SHA-256 |
| --- | --- |
| `.context/plans/67-high-priority-cycle42.md` | `596dc91904a642bbfe5a5f5c338025023a1e5d0c2c92d9842353233c4fc0ac7a` |
| `.context/reviews/cycle42-aggregate.md` | `272a70771bc14dbe131a8aef65907402c5f07f12fc0c798d535a5ef4a67ee4d1` |
| `.context/reviews/cycle42-code-reviewer.md` | `1dbdd1bdf8e2d672075e73e34b5b2043b33f74a36b938085b8efeafd03f03266` |
| `.context/reviews/cycle42-debugger.md` | `6c6aa0d14a9129109341ac285de900bff8af8c38425a03f09e012206266c3df0` |
| `.context/reviews/cycle42-security-reviewer.md` | `c7909307ce1387d617e9d7f51180a6eb8d7b12e1bfffe30bf5fe5dafdbd9a6a5` |
| `.context/reviews/cycle42-test-engineer.md` | `c3fbf7a4ec5628902bce36af73f9d7c6b223c82e6d1360bac44e80d7612a3e9f` |

The only path written by this role is
`.context/reviews/cycle14-document-specialist.md`.

**Final count: 1 genuinely new documentation finding — 1 Low, High
confidence, Confirmed.**
