# Aggregate Review — CherryPicker Review/Plan/Fix Cycle 18

**Date:** 2026-07-24
**Cycle:** 18 / 100
**Reviewed revision:** `c182c8144a4284bae1f28f009a5b0930d7762d5c`
**Branch:** `codex/review-plan-fix-no-deploy-20260723`
**Deploy mode:** none
**Prompt 1 status:** complete
**Prompt 2 status:** complete
**Prompt 3 status:** pending

## Executive summary

Cycle 18 completed every required and repository-specific review lens: code,
performance, defensive security, critic, verifier, test engineering, causal
tracing, architecture, debugging, documentation, design, dependency, and QA.
Every role inventoried its relevant tracked surface, traced cross-file
interactions, reconciled candidates against current and archived `.context`
history, and performed a closing missed-file sweep.

After exact-source validation and strict historical deduplication, one
genuinely new finding survives:

| Severity | Unique new findings |
| --- | ---: |
| Low | 1 |
| **Total** | **1** |

The review also confirmed two repair obligations that do not inflate the new
finding count:

1. legacy catalog projections currently regress the completed `C3-008` /
   Plan 80 publication-identity contract; and
2. `.mts` / `.cts` dependency discovery is a dormant preventive completion
   gap under Plan 147.

All three items are High-confidence and will be scheduled. Nothing is
deferred or silently dropped. Prompt 1 changed no product source, test,
generated artifact, dependency, manifest, plan, workflow, deployment state,
or external system. Its repository writes are the thirteen role reports, this
dated aggregate, and the current `_aggregate.md` projection.

## Unique new finding

### C18-001 — `YearMonth` is not a closed public calendar domain

- Severity: Low
- Confidence: High
- Status: confirmed
- Primary source: `packages/core/src/analysis/context.ts:3,51-91`
- Context consumer: `packages/core/src/analysis/context.ts:101-164`
- Reward-basis consumer:
  `packages/core/src/analysis/performance.ts:68-114`
- Web coherence and persistence:
  `apps/web/src/lib/analysis-result.ts:893-970,1073-1095` and
  `apps/web/src/lib/persistence.ts:677-708,822-844`
- Original owner: verifier

`isYearMonth()` admits four year digits and a valid two-digit month.
`previousCalendarMonth()` converts the year to a number and interpolates that
number without restoring four-character width. Every predecessor in input
years `0100` through `0999` loses a leading zero, and January `1000` produces
`999-12` instead of `0999-12`. The declared `YearMonth` result can therefore
fail the module's own predicate.

The failure is reachable through the exported shared-core contract. A direct
caller with December `0999` and January `1000` transactions keeps both rows
in the monthly breakdown, but the malformed predecessor key misses the real
December row. Analysis records a missing-month zero basis and can evaluate
cards against the wrong prior spending. Fresh-result coherence derives the
same malformed key and accepts the internally consistent mistake, while
persistence later rejects the malformed basis.

The public type is also too broad:
`` `${number}-${string}` `` accepts values such as `2026-1` and `2026-99`
that `isYearMonth()` rejects. This is additional contract evidence merged
into the same domain root rather than a second finding.

Supported statement parsers enforce years 1900–2100, so ordinary web and CLI
uploads do not reach the low-year branch. The defect remains real for direct
core consumers and for the helper's exported invariant, which bounds the
severity to Low.

The root fix must provide one validated/opaque `YearMonth` constructor,
preserve year text for same-year predecessors, pad rollover years to four
digits, and define the `0000-01` underflow explicitly. Regression coverage
must prove type/runtime agreement, same-year leading-zero behavior,
January-1000 selection of December-0999 spending, normal modern behavior, and
the lower boundary.

Historical novelty is confirmed. Archived Plan 68 owns exact ordinary
previous-calendar-month semantics and modern January rollover; Plan 144 owns
the single-proof date projection. Neither owns a transformation leaving its
own admitted set, low-year width loss, or the resulting fresh-versus-restored
contract divergence.

## Confirmed historical regression to repair

### C3-008 regression — changed legacy bytes retain an uncovered identity

- Severity: Low
- Confidence: High
- Status: confirmed current regression; not a new Cycle 18 root
- Hash boundary: `scripts/catalog-publication.ts:113-132`
- Legacy construction and metadata reuse:
  `scripts/build-json.ts:245-329,375-438`
- Affected artifacts: `packages/rules/data/cards.json`,
  `packages/rules/data/cards-compact.json`, and
  `apps/web/public/data/cards.json`
- Historical owner:
  `.context/plans/_archive/80-cycle3-publication-runtime-dependencies.md`

Cycle 17 changed the legacy full and compact projections, including
comparison metadata, ordering, and compact cardinality, while all three
legacy artifacts retained version `1.0.0` and source hash
`ad1edfe624495c7380b86255de27a29091eacc09e325d82a9533034ad2279b58`.
The hash covers only the split browser summary, optimizer, detail, and
category payloads, then `build-json.ts` copies it into legacy metadata.

A downstream legacy consumer that uses the advertised hash as a cache or
generation key cannot distinguish the old global ranking from the new
comparison-group representation. Active first-party browser readers remain
correctly pinned to split artifacts, so impact is bounded.

Completed Plan 80 explicitly promises a unique identity for every published
catalog byte set and an identity change for a source-stable projection
change. The appropriate disposition is to reopen that owner, not manufacture
a new root. The repair must include identity-free keyed legacy projections in
the publication identity (or assign independent identities), make the
breaking legacy schema version explicit, and add legacy-only mutation
regressions.

## Preventive completion to implement

### Plan 147 completion — admit module-TypeScript dependency sources

- Severity: preventive policy gap; no affected current file
- Confidence: High
- Status: confirmed dormant mismatch; not a new current root
- Extension contract: `scripts/check-dependencies.ts:11-21`
- Discovery and classification:
  `scripts/check-dependencies.ts:470-500,632-684`
- Existing fixtures:
  `scripts/__tests__/check-dependencies.test.ts:21-88,144-226`

The config grammar recognizes `.mts` and `.cts`, but the shared extension
inventory omits both. Recursive production/test discovery and top-level
config discovery filter on that inventory before import parsing, so a future
module-TypeScript source would be silently skipped.

The tracked tree contains no `.mts` or `.cts` file; every current import still
reaches the gate. Plan 147 already owns test/config admission and dependency
classification, so this is preventive completion under that owner rather
than a current product finding. The repair must derive config admission from
one extension contract and add exact production, test, and config fixtures
for both extensions, including undeclared rejection and correct direct
ownership acceptance.

## Cross-role agreement

| Item | Independent confirming roles |
| --- | --- |
| C18-001 calendar-domain closure | verifier, architect, debugger, tracer, test engineer, document specialist, designer, QA |
| C3-008 legacy identity regression | code, verifier, critic, architect, debugger, tracer, test engineer, document specialist, QA |
| Plan 147 module-TypeScript completion | code, verifier, critic, architect, debugger, tracer, test engineer, dependency expert, QA |

The code reviewer initially labeled the last two observations novel. The
critic, architect, debugger, tracer, dependency expert, and QA passes
independently confirmed their mechanisms while locating their exact
historical owners. This aggregate therefore retains the technical evidence
and schedules both repairs without inflating `NEW_FINDINGS`.

## Rejected and historically owned alternatives

- Active browser summary/detail/category/optimizer readers still pin one
  complete source hash and fail closed on mixed generations. The legacy
  regression is not broadened into an active browser cache defect.
- Current workspace dependency ownership is coherent for every tracked file;
  no `.mts` or `.cts` import currently escapes enforcement.
- Parser duplication, optimizer complexity, matcher/taxonomy scans, shallow
  constraint copies, persistence sensitivity, CSP migration, PDF fallback,
  card-detail cancellation, and broad generator extraction retain explicit
  completed or deferred owners.
- The Cycle 17 date projection still preserves one strict proof per input,
  invalid-row quarantine, transaction identity/order, modern rollover,
  periods, monthly totals, and safe-integer failures.
- Category-label generation now crosses one structured serialization
  boundary, and homogeneous reward-group comparison remains correct inside
  each exact kind-and-unit group.
- No additional security, performance, concurrency, package-direction,
  browser-state, accessibility, documentation, or testing root survived
  current reachability and full-history reconciliation.

## Role provenance

| Role | Report | New aggregate roots |
| --- | --- | ---: |
| Code reviewer | `2026-07-24-cycle18-code-reviewer.md` | 0 |
| Performance reviewer | `2026-07-24-cycle18-perf-reviewer.md` | 0 |
| Security reviewer | `2026-07-24-cycle18-security-reviewer.md` | 0 |
| Critic | `2026-07-24-cycle18-critic.md` | 0 |
| Verifier | `2026-07-24-cycle18-verifier.md` | 1 |
| Test engineer | `2026-07-24-cycle18-test-engineer.md` | 0 |
| Tracer | `2026-07-24-cycle18-tracer.md` | 0 |
| Architect | `2026-07-24-cycle18-architect.md` | 0 |
| Debugger | `2026-07-24-cycle18-debugger.md` | 0 |
| Document specialist | `2026-07-24-cycle18-document-specialist.md` | 0 |
| Designer | `2026-07-24-cycle18-designer.md` | 0 |
| Dependency expert | `2026-07-24-cycle18-dependency-expert.md` | 0 |
| QA tester | `2026-07-24-cycle18-qa-tester.md` | 0 |

## Browser evidence and exact cleanup

The designer used one isolated attempt against the existing `apps/web/dist`
artifact:

```text
session: cherrypicker-c18-designer-20260724
profile: /tmp/cherrypicker-c18-designer-profile.9okbnq
preview: 127.0.0.1:4188
preview PID/PGID: 6165/6165
browser daemon/root: 9814/9815 in PGID 9814
```

The built artifact's `/cherrypicker/` base was not mounted by the direct Vite
preview. The reviewer transparently corrected asset URLs in the same
page/session, then exercised the exact built assets with accessibility
snapshots, DOM/computed styles, keyboard focus, light/dark themes, mobile
layout/menu, RTL stress, loading/empty/error states, request and console
inspection, and bounded interaction signals. No new UI root survived
historical reconciliation; the low-year disclosure/persistence consequence
was merged into C18-001.

Cleanup closed only the named browser session and attributable process
groups. PIDs `6165`, `9814`, and `9815` and PGIDs `6165` and `9814` are
absent; port 4188 is free; no agent-browser session remains; and the E2E
registry is clean. The exact profile, inode `80379502`, was moved recoverably
to
`/Users/hletrd/.Trash/cherrypicker-c18-designer-profile.9okbnq-20260724`;
its original path is absent. Unrelated Google Chrome PID/PGID `1368/1368`
remains intact.

## Agent failures

None. All thirteen required roles returned their provenance file. No retry
remained unresolved.

## Protected artifact integrity

The six protected, untracked Cycle 42 artifacts remained unstaged and
untouched. Their hashes still match the preflight baseline:

```text
596dc91904a642bbfe5a5f5c338025023a1e5d0c2c92d9842353233c4fc0ac7a  .context/plans/67-high-priority-cycle42.md
272a70771bc14dbe131a8aef65907402c5f07f12fc0c798d535a5ef4a67ee4d1  .context/reviews/cycle42-aggregate.md
1dbdd1bdf8e2d672075e73e34b5b2043b33f74a36b938085b8efeafd03f03266  .context/reviews/cycle42-code-reviewer.md
6c6aa0d14a9129109341ac285de900bff8af8c38425a03f09e012206266c3df0  .context/reviews/cycle42-debugger.md
c7909307ce1387d617e9d7f51180a6eb8d7b12e1bfffe30bf5fe5dafdbd9a6a5  .context/reviews/cycle42-security-reviewer.md
c3fbf7a4ec5628902bce36af73f9d7c6b223c82e6d1360bac44e80d7612a3e9f  .context/reviews/cycle42-test-engineer.md
```

Prompt 1 final count: **1 genuinely new finding**.

## Prompt 2 planning result

Prompt 2 read every role report, the aggregate, repository instructions, the
active/deferred plan inventory, and the exact historical owners before
planning. Nothing was deferred or silently dropped.

Exactly three plan documents were created or materially reopened:

- New Plan 148 schedules the novel C18-001 `YearMonth` domain repair.
- Archived Plan 80 moved back to the active plan directory and reopened its
  C3-008 identity acceptance for legacy full and compact projections.
- Plan 147 remains active and is reopened for preventive `.mts` / `.cts`
  source admission and exact dependency-policy fixtures.

Verified-complete Cycle 17 Plans 144–146 moved to `_archive/` with dated
archive markers. Plan 147 was not archived because Cycle 18 identified
remaining preventive acceptance scope.

The requested `ralph` capability is unavailable. Every active plan records
the approved disciplined manual plan-to-test fallback, the full required
gate matrix, exact E2E hygiene, deploy mode `none`, and unchecked acceptance
criteria for Prompt 3.

Prompt 2 final count: **3 created or materially reopened plans**.

## Prompt 3 implementation result

Pending. No deployment will be performed.
