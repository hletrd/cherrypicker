# Cycle 5 document-specialist review

Date: 2026-07-23
Baseline: `e3aa4241bbdc9c9b1dc3abff0df78e0cc9f8d715`

## Scope

I read the current root README, both live `.claude` guides, the vendored
archive README, all 24 issuer READMEs, package scripts/manifests, CLI-generated
help for every command, the card/schema examples, and the documentation
generator/checker. I compared claims against the canonical YAML, generated
catalog artifacts, current source, and command output. Historical `.context`
documents were used only to avoid repeating already-fixed Cycle 4
documentation defects.

The root feature/format list, current dependency stack, remote-LLM consent
description, CLI examples, keyword-conflict semantics, static-host security
caveat, issuer/card counts, generated indexes, and validated YAML examples all
match current behavior.

## Finding

### C5-DOC-001 — `docs:check` certifies issuer READMEs whose hand-written metadata and catalog claims are stale

- **Severity:** Low
- **Confidence:** High
- **Status:** Confirmed
- **Location:** generator/check boundary at
  `scripts/readme-catalog.ts:385-425,428-455`;
  preservation test at
  `scripts/__tests__/readme-catalog.test.ts:79-106,133-169`;
  stale metadata at line 3 of
  `packages/rules/data/cards/{bc,bnk,dgb,hana,hyundai,ibk,jb,kakao,kb,kbank,kwangju,lotte,nh,samsung,shinhan,suhyup,toss,woori}/README.md`;
  concrete stale prose at
  `packages/rules/data/cards/dgb/README.md:13-22`;
  canonical card data at
  `packages/rules/data/cards/dgb/im-i.yaml:1-169`

All 18 listed issuer documents say `마지막 업데이트: 2026-03-24` at line 3,
while the YAML-derived generated section in the same file reports a later
date:

| Issuer README | Generated line | Canonical latest date |
|---|---:|---:|
| `bc` | 56 | 2026-03-26 |
| `bnk` | 23 | 2026-03-25 |
| `dgb` | 22 | 2026-03-25 |
| `hana` | 65 | 2026-03-26 |
| `hyundai` | 43 | 2026-03-26 |
| `ibk` | 57 | 2026-03-26 |
| `jb` | 23 | 2026-03-25 |
| `kakao` | 22 | 2026-03-25 |
| `kb` | 39 | 2026-03-26 |
| `kbank` | 26 | 2026-03-25 |
| `kwangju` | 23 | 2026-03-25 |
| `lotte` | 56 | 2026-03-26 |
| `nh` | 55 | 2026-03-26 |
| `samsung` | 51 | 2026-03-26 |
| `shinhan` | 58 | 2026-03-26 |
| `suhyup` | 22 | 2026-03-25 |
| `toss` | 24 | 2026-03-25 |
| `woori` | 62 | 2026-03-26 |

The mismatch is not limited to dates. The DGB guide says at line 17 that
credit products such as the iM i card exist but detailed benefit data is
unavailable. The canonical `im-i.yaml` already contains its annual fee,
performance tiers, five supported reward groups, merchant scopes, caps, and
global constraint, and the generated index links it from the same README.

Why the gate stays green:

- `planReadmeUpdates` replaces only the generated marker range.
- The test at `readme-catalog.test.ts:88-106` explicitly guarantees that
  hand-written headers, introductions, and footers remain untouched.
- The all-YAML comparison at lines 133-169 checks generated issuer indexes,
  not statements outside those markers.
- Therefore `bun run docs:check` passes despite direct contradictions in a
  checked document.

Failure scenario:

A contributor or user reads the header/summary before the generated index and
believes the catalog was last updated on March 24 or that a card lacks
machine-readable benefits. The canonical data and UI contain newer/more
complete information, so the documentation presents two incompatible sources
of truth while the advertised documentation check reports success.

Suggested fix:

- Move the issuer-level `lastUpdated` line inside the generated region (or
  remove the hand-written duplicate) and derive it from the maximum canonical
  `card.lastUpdated`.
- Remove the DGB “data unavailable” statement now. Review the other
  hand-written representative tables/feature prose whenever issuer YAML
  changes, or replace data-like prose with generated fields that can be
  checked.
- Extend `docs:check` with an invariant that rejects any recognized
  hand-written update header that differs from the generated maximum.
- If narrative summaries remain intentionally manual, document that they are
  not covered by `docs:check` and add an owner/review step to the card-data
  update procedure.

## Validation and final sweep

`bun run docs:check` and all eight README-catalog tests pass on the current
tree, which confirms the checker blind spot rather than invalid generated
indexes. A read-only YAML/README comparison reproduced all 18 date
contradictions and found no issuer-count mismatch. The final sweep also
compared every CLI help screen and live architecture/dependency claim; no
additional current documentation mismatch met the reporting threshold.
