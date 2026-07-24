# Review-plan-fix Cycle 18 — verifier

## Review identity

- Date: 2026-07-24
- Revision: `c182c8144a4284bae1f28f009a5b0930d7762d5c`
- Role: independent source, artifact, reachability, and history verification
- Disposition: **three findings retained** — the two code-review findings are
  confirmed, and one verifier-new date-domain finding is retained
- Severity/confidence: three Low / High
- Scope: read-only verification plus this report; no source, plan, generated
  artifact, git state, browser, E2E, build, or test change

## Inventory and method

The existing complete inventory covers 2,394 tracked paths: 1,172
non-`.context` paths and 1,222 tracked plans/reviews. Verification traced each
candidate from producer to consumer, checked the relevant generated artifacts
without regenerating them, inspected focused test coverage, and searched all
tracked current and archived `.context` history candidate-by-candidate.

The six protected untracked Cycle 42 artifacts were identified only from the
existing status inventory. They were not opened, searched, hashed, or
modified.

## C18-CR-001 — confirmed: legacy catalog projections reuse an identity that does not cover their bytes

- Severity: **Low**
- Confidence: **High**
- Status: **Confirmed** by source tracing and focused read-only artifact
  comparison; no manual runtime validation is required
- Identity input:
  `scripts/catalog-publication.ts:113-132,280-347,350-405`
- Legacy metadata reuse:
  `scripts/build-json.ts:299-329,375-438`
- Changed legacy-only projections:
  `scripts/build-json.ts:245-281,385-429`
- Affected tracked artifacts: `packages/rules/data/cards.json`,
  `packages/rules/data/cards-compact.json`, and
  `apps/web/public/data/cards.json`

`computePublicationSourceHash()` covers the normalized browser summary,
optimizer payload, issuer detail shards, and categories. The separate legacy
full catalog's category index and the compact catalog's `topRewards` are not
hash inputs. `build-json.ts` nevertheless copies that browser-runtime hash and
the same hard-coded `1.0.0` version into both legacy outputs.

The Cycle 17 comparison-group repair changed all three legacy artifact byte
sets while leaving their embedded identity unchanged. Focused comparison
against revision `23c7317` confirmed:

| Artifact | Earlier file SHA-256 | Current file SHA-256 | Embedded version/hash |
|---|---|---|---|
| Rules full catalog | `3ef29c528c610dd385744812af4b803e7fff12d4fe4d6206b10d2e6d844f75fa` | `41b219a4b17cee43ae92b10b998b67795ef9df8ba65841af6a2ba288623e05a4` | unchanged |
| Rules compact catalog | `2e2997039550294a3ef57da9ff375c6310a13e0381c302d7c34ac1416be711e4` | `486d8e6d6ed259fd3be9f3e1de9fb79420a971794c31a1f1c4fa8507894c2159` | unchanged |
| Public legacy full catalog | `3ef29c528c610dd385744812af4b803e7fff12d4fe4d6206b10d2e6d844f75fa` | `41b219a4b17cee43ae92b10b998b67795ef9df8ba65841af6a2ba288623e05a4` | unchanged |

The embedded values remain version `1.0.0` and source hash
`ad1edfe624495c7380b86255de27a29091eacc09e325d82a9533034ad2279b58`.
The compact representation also changed its cardinality contract: the earlier
maximum was five entries per card; the current maximum is seven, with five
cards above five.

Concrete failure scenario: a downstream legacy-catalog consumer keys its
cache or migration decision by the advertised metadata. It can treat the old
global ranking and the new comparison-group representation as the same
publication even though fields, ordering, and list cardinality changed.
Active first-party browser analysis uses the separately pinned split
artifacts, so the defect does not create a current mixed browser generation
and remains Low severity.

Root-cause fix: build identity-free legacy full and compact payloads before
metadata injection and include their keyed canonical forms in the publication
identity, or assign each legacy artifact an independent content identity.
Because the compact representation's field/cardinality contract changed,
either bump its schema version or explicitly retire the legacy contract. Add
a regression proving that a legacy-only projection mutation changes the
advertised identity.

Historical reconciliation: completed Cycle 3 publication work owns the active
split runtime payload set and mixed-generation rejection, while Plan 146 owns
homogeneous legacy comparison groups. Neither covered the current interaction
where legacy-only bytes change but metadata copied into those files does not.
`D-03` is the older stale compact-file/build-pipeline concern, not
content-identity reuse.

## C18-CR-002 — confirmed: `.mts` and `.cts` files are recognized by config grammar but never admitted

- Severity: **Low**
- Confidence: **High**
- Status: **Confirmed policy gap** by static path tracing; dormant for the
  current tracked filenames, so a focused fixture remains desirable
- Shared extension inventory: `scripts/check-dependencies.ts:8-21`
- Recursive and config admission:
  `scripts/check-dependencies.ts:464-503,632-651`
- Import parsing and enforcement:
  `scripts/check-dependencies.ts:525-595,653-684`
- Existing fixture coverage:
  `scripts/__tests__/check-dependencies.test.ts:116-226`

`CONFIG_SOURCE_PATTERN` recognizes standard module TypeScript config names
ending in `.mts` and `.cts`. `SOURCE_EXTENSIONS` omits both. Recursive source
and test discovery and top-level config discovery first require membership in
that set, so those recognized names never reach the import parser. The
parser's default `ts.ScriptKind.TS` path would otherwise handle them.

Concrete failure scenario: a workspace adopts a module-TypeScript config or
test helper that imports a package missing from the workspace manifest. The
blocking dependency policy silently omits that file and reports no ownership
error, while the equivalent `.ts` file is checked. No tracked `.mts` or `.cts`
file currently exists, which bounds immediate impact.

Root-cause fix: add `.mts` and `.cts` to the single supported extension
contract, derive the config grammar from that contract where practical, and
add config and nested-test fixtures for both extensions. The fixtures should
prove both undeclared-package rejection and development-dependency
acceptance.

Historical reconciliation: Plan 147 and its tests own production versus
test/config dependency classification after file admission. Tracked history
contains no owner for module-TypeScript files being excluded before
classification.

## C18-VR-001 — `previousCalendarMonth()` is not closed over admitted four-digit years

- Severity: **Low**
- Confidence: **High**
- Status: **Confirmed** by source and consumer tracing; synthetic historical
  statement data is sufficient for manual validation but is not needed to
  establish the string-contract failure
- Date and YearMonth validation:
  `packages/core/src/analysis/context.ts:3-12,51-78`
- Defective predecessor construction:
  `packages/core/src/analysis/context.ts:80-91`
- Ordinary context path:
  `packages/core/src/analysis/context.ts:101-164`
- Browser/CLI effect:
  `apps/web/src/lib/analyzer.ts:210-223,407-424`,
  `tools/cli/src/analysis.ts:58-82`, and
  `packages/core/src/analysis/performance.ts:68-114`
- Missing boundary coverage:
  `apps/web/__tests__/analysis-context.test.ts:13-35,38-51`

`isValidIsoDate()` admits canonical four-digit years from `0100` onward.
`yearMonthOfDate()` preserves those four digits. `previousCalendarMonth()`
then parses the year as a number and interpolates it without restoring four
digits.

The supplied January hypothesis is valid but narrower than the defect:

- every predecessor produced for an input year from `0100` through `0999`
  loses its leading zero, regardless of month; and
- January `1000` rolls back to an unpadded three-digit year.

The returned string therefore fails the module's own `isYearMonth()` contract.
For years `0101` through `1000`, an otherwise valid preceding-month
transaction can be present but will not equal the malformed predecessor key.
`buildAnalysisContext()` then omits it from `previousTransactions`, records a
missing-calendar-month basis, and feeds zero previous spending into card tier
resolution. Persistence later rejects the malformed basis month as well.

Concrete failure scenario: an accepted statement whose latest month is
January 1000 also contains valid December 0999 spending. The calculated
predecessor lacks the required leading zero, so December is ignored and cards
are evaluated as though the exact prior month were absent. The same failure
occurs without a year boundary for dates in years 0100–0999. Such dates are
outside realistic modern card statements, which bounds severity, but they are
inside the public validator's stated domain.

Root-cause fix: preserve `yearText` for non-January predecessors and
zero-pad the decremented year to four digits for January. Define explicit
behavior for the non-representable predecessor of year `0000` rather than
using an unchecked type assertion. Add helper and full-context regressions for
leading-zero years, January 1000/December 0999, normal modern rollover, and
the lower boundary.

Historical reconciliation: Cycle 1 introduced strict `YearMonth` helpers and
calendar rollover, and Cycle 17 optimized the surrounding date projection.
Older parser findings own missing month/day padding in parsed dates. No
tracked report, plan, deferral, or rejection owns numeric year conversion
breaking the shared predecessor helper's output contract.

## Rejected adjacent candidates and final sweep

- The duplicated strict ISO validator in reward calculation has the same
  lower-year interpretation as analysis admission; it does not create a
  second mismatch for the retained `0100`–`1000` range.
- Year `0000` predecessor underflow is an adjacent domain-policy edge and is
  included in the C18-VR-001 root fix rather than split into another finding.
- Active browser catalog readers continue to pin the split summary,
  optimizer, category, and issuer-detail source hash correctly. C18-CR-001 is
  limited to legacy metadata and was not broadened into a false active-browser
  cache finding.
- Current dependency ownership is coherent for every tracked filename.
  C18-CR-002 remains a dormant admission gap, not a claim that the current
  tree contains an undeclared module-TypeScript import.
- The closing sweep rechecked publication/version consumers, generated
  cardinalities, extension grammar and ScriptKind routing, date-domain
  closure, previous-spending selection, persistence validation, browser/CLI
  disclosures, and the nearby completed Cycle 17 changes. No fourth novel
  root survived source and history reconciliation.

No browser, E2E, build, generator, network, or test suite was run. Focused
evidence was limited to read-only source/history inspection and current versus
tracked-prior artifact metadata, content hashes, and cardinalities. Final
retained count: **3**.
