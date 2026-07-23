# Aggregate Review — CherryPicker Review/Plan/Fix Cycle 1

**Date:** 2026-07-23
**Cycle:** 1 / 100
**Scope:** Current repository, including the pre-existing uncommitted cycle-42 parser/store fixes
**Reviewers:** code-reviewer, perf-reviewer, architect, security-reviewer, critic, tracer, verifier, debugger, test-engineer, document-specialist, designer

## Executive summary

The 11 review reports contain 95 raw findings. Cross-review deduplication produces **71 unique findings**: 1 Critical, 36 High, 29 Medium, and 5 Low. The central correctness failure is that merchant categorization, the card catalog, the scraper, and reward evaluation do not share one enforceable category and reward contract. That mismatch makes broad rewards, many catalog rules, and condition-heavy benefits unreachable or falsely precise.

The next largest clusters are parser integrity, previous-month provenance, scraper trust boundaries, stale browser/E2E lifecycle, and accessibility. Performance and broad architectural improvements may be explicitly deferred with exit criteria; security and correctness findings may not.

| Severity | Unique findings |
|---|---:|
| Critical | 1 |
| High | 36 |
| Medium | 29 |
| Low | 5 |
| **Total** | **71** |

## Unique findings

### Category and reward contract

| ID | Severity | Confidence | Finding | Raw sources |
|---|---|---|---|---|
| C1-001 | Critical | High | Static merchant maps, raw-category fallback, taxonomy, and reward data use incompatible category shapes. Keyword merging is last-write-wins, conflicting mappings are hidden, and leaf IDs can be emitted as impossible top-level categories. | CR-01, ARCH-01, DBG-06 |
| C1-002 | High | High | A broad parent-category reward is rejected whenever the transaction also has a subcategory, making 1,181 broad rules across 567 cards ineffective for normal categorized transactions. | VER-01 |
| C1-003 | High | High | The catalog contains category IDs and parent/subcategory pairs the runtime cannot emit; publication only warns and therefore publishes unreachable rewards and exclusions. | VER-02, ARCH-06 |
| C1-004 | High | High | At least 208 general-spend rules encode “all merchants” as `uncategorized`, while the evaluator's wildcard is `*`, so categorized purchases lose base rewards. | CRIT-01, TR-01 |
| C1-005 | High | High | The rule model/evaluator cannot represent or apply much of the authored eligibility, stacking, counting, weekday, payment, and tier behavior. Restrictions survive only in notes, and duplicate rules collapse to source-order selection. | CR-03, ARCH-02, VER-05, CRIT-02, TR-02 |
| C1-006 | High | High | Reward units and values lack semantic validation: impossible percentage rates are accepted and some unit-specific values are dropped or interpreted under the wrong contract. | CR-02 |
| C1-007 | High | High | `won_per_liter` is calculated as one fixed amount per transaction despite having no fuel-volume input, producing a falsely precise reward. | CR-02, CRIT-05, VER-06 |
| C1-008 | High | High | Structured `paymentType` conditions are accepted and published but are undocumented and ignored by reward calculation. | DOC-02, VER-04 |
| C1-009 | Medium | High | Per-transaction caps clip rewards but never add a `capsHit` record, leaving calculation output inconsistent with the public result contract. | TE-05 |
| C1-010 | High | High | Scraper prompts/schema define percentages as fractions while the calculator divides rates by 100, causing newly scraped benefits to be 100× too small. | CR-09, VER-03 |
| C1-011 | High | High | Scraper prompts emit stale taxonomy values and condition fields that the canonical schema/runtime cannot honor, allowing invalid rules to enter the publication path. | CR-09, VER-04 |

### Analysis state and temporal provenance

| ID | Severity | Confidence | Finding | Raw sources |
|---|---|---|---|---|
| C1-012 | High | High | Multi-month tier input discards the user's previous-spending override, loses provenance, and passes an aggregate scalar that bypasses per-card exclusions; initial analysis and reoptimization can disagree. | CR-04, ARCH-03 |
| C1-013 | High | High | “Previous month” selects the preceding uploaded month rather than the exact previous calendar month, so gaps in uploaded statements alter benefit eligibility. | DBG-07 |
| C1-014 | Medium | High | `reoptimize()` replaces latest-month metadata with all-month metadata and reports the wrong optimized period/count. | CRIT-06, TR-05, VER-08 |
| C1-015 | High | High | Long but calendar-invalid date strings can become the fake latest month and influence analysis and persisted state. | VER-07 |
| C1-016 | High | High | `loadFromStorage()` trusts an arbitrary persisted schema version; a large negative integer can drive an effectively unbounded migration loop. | Aggregate control-flow verification |

### Parser and CLI integrity

| ID | Severity | Confidence | Finding | Raw sources |
|---|---|---|---|---|
| C1-017 | High | High | SheetJS converts ISO-looking HTML dates to `Date` objects, after which both HTML parsers stringify them into invalid transaction dates. | CR-05 |
| C1-018 | High | High | HTML/XLSX forward-fill applies to ordinary note/spacer rows, including amount/date/merchant fields, and can fabricate transactions. | CR-06 |
| C1-019 | High | High | PDF fallback strips parentheses and Korean negative prefixes before amount parsing, turning refunds into positive purchases in both parser implementations. | DBG-01, CRIT-03, TR-03 |
| C1-020 | High | High | Structured PDF fallback corrects column indices after caching old cell values, so corrected rows are dropped or parsed with stale data. | CR-07, DBG-02, CRIT-04, TR-04 |
| C1-021 | High | High | Server-side encoding detection treats ordinary CP949 Korean CSV bytes as UTF-8 rather than trying strict UTF-8 then CP949 decoding. | DBG-03 |
| C1-022 | Medium | High | XLSX with a plausible but incomplete header can silently return zero transactions and zero targeted errors. | DBG-04 |
| C1-023 | Medium | High | Numeric JSON/XLSX values can exceed the safe-integer boundary, and the public reward calculator accepts non-finite amounts. | DBG-08, TE-07 |
| C1-024 | Medium | High | The CLI requests remote-upload consent before attempting local PDF parsing, even when no remote fallback is needed. | VER-09 |
| C1-025 | High | High | Browser and server maintain separate parser products, duplicating bugs, fixes, fixtures, and behavioral contracts. | ARCH-04 |

### Web data flow and visible correctness

| ID | Severity | Confidence | Finding | Raw sources |
|---|---|---|---|---|
| C1-026 | High | High | Shared card-data fetch cancellation/timeout is swallowed into an empty catalog, and one caller can cancel another, producing a successful zero-card optimization. | DBG-05 |
| C1-027 | Medium | High | Card detail multiplies already-percent catalog values by 100 and renders fixed-value benefits as `0%`. | CR-08 |
| C1-028 | High | High | Partial parser errors are discarded after successful rows are returned, so users cannot see which rows/files were omitted. | D-03 |
| C1-029 | Medium | High | Out-of-range previous spending remains submittable and is silently clamped rather than producing an actionable validation error. | D-08 |
| C1-030 | Medium | High | The 50 MB file warning is written into state but cannot be rendered by the current component branch. | D-09 |
| C1-031 | Medium | High | Card detail exposes internal performance-tier IDs instead of user-facing tier labels. | D-11 |
| C1-032 | Medium | High | Card loading and fetch-error states are not announced and expose no retry action. | D-14 |
| C1-033 | Medium | High | The empty dashboard tells users both that analysis is complete and that there are no results. | D-20 |
| C1-034 | Medium | High | Supported-format documentation and error copy omit formats that the parser actually accepts. | DOC-06, D-21 |

### Security and scraper robustness

| ID | Severity | Confidence | Finding | Raw sources |
|---|---|---|---|---|
| C1-035 | High | High | Remote content controls LLM-produced `card.id`/issuer values that are joined into an output path, enabling path traversal and overwrite outside the scraper root. | SR-01, TR-06 |
| C1-036 | Medium | High | An unvalidated catalog URL reaches a clickable `href`, leaving a dormant stored-`javascript:` path. | SR-02 |
| C1-037 | Medium | High | Clickjacking controls are emitted as unenforced meta tags on a static host rather than effective response controls or a functional client fallback. | SR-03 |
| C1-038 | Medium | High | Scraper URL overrides allow SSRF/private-network targets and redirects, responses are buffered without a byte cap, and the encoding re-fetch omits status/finally cleanup and regression tests. | SR-04, TE-08 |
| C1-039 | High | High | Sonnet 5 extraction calls omit an explicit thinking mode while retaining a 4,096-token output budget; adaptive thinking shares that budget and can truncate structured card extraction. | Aggregate API-contract verification |

### Performance and architecture

| ID | Severity | Confidence | Finding | Raw sources |
|---|---|---|---|---|
| C1-040 | High | High | Default optimization performs synchronous `cards × transactions²` recomputation in the UI path; a 1,000-transaction benchmark takes about 3.9 seconds. | PERF-01, ARCH-05 |
| C1-041 | High | High | Every uncached merchant miss linearly scans roughly 12,740 static keywords before taxonomy fallback. | PERF-02 |
| C1-042 | Medium | High | Multi-file parsing starts unbounded parallel CPU/memory work on the main thread. | PERF-03 |
| C1-043 | Medium | High | Analysis/catalog views eagerly download and transform the full catalog, and the catalog renders all 683 cards at once. | PERF-04, D-12 |
| C1-044 | Medium | High | The upload landing route eagerly includes every browser parser, producing an unnecessarily large initial bundle. | D-13 |

### Accessibility and interaction design

| ID | Severity | Confidence | Finding | Raw sources |
|---|---|---|---|---|
| C1-045 | High | High | Primary/success foreground tokens fail contrast in dark mode. | D-01 |
| C1-046 | High | High | Raw issuer brand colors are used as text in both themes without a contrast-safe treatment. | D-02 |
| C1-047 | High | High | The upload surface nests interactive controls and has an incomplete keyboard activation model. | D-04 |
| C1-048 | High | High | Recommendation rows use `role="button"` on table rows, overwriting native table semantics. | D-05 |
| C1-049 | High | High | At a 375 px viewport, core charts collapse to zero-width or approximately 11 px tracks. | D-06 |
| C1-050 | Medium | High | A drag/drop gesture is handled at both document and drop-zone levels and immediately reports a false duplicate. | D-07 |
| C1-051 | Medium | High | The mobile recommendation table is scrollable but compressed enough to be unreadable. | D-10 |
| C1-052 | Medium | High | Filter selection is visually encoded without `aria-pressed`/group state. | D-15 |
| C1-053 | Medium | High | The mobile menu exposes neither disclosure state nor the current-page state. | D-16 |
| C1-054 | Medium | High | Hero supporting text does not consistently meet contrast requirements. | D-17 |
| C1-055 | Medium | High | Printing results can retain dark-theme utility colors and produce an unreadable printout. | D-18 |
| C1-056 | Medium | Medium | Report tables lack a narrow-screen adaptation. | D-19 |
| C1-057 | Low | High | Reduced-motion handling does not disable smooth scrolling. | D-22 |
| C1-058 | Low | High | The declared favicon returns 404. | D-23 |
| C1-059 | Medium | Medium | Dense report/card tables offer no visual or semantic cue that horizontal content is available. | D-25 |
| C1-060 | Low | High | Responsive/accessibility E2E assertions are too shallow to detect the confirmed live failures. | D-24 |

### Test, build, and documentation contract

| ID | Severity | Confidence | Finding | Raw sources |
|---|---|---|---|---|
| C1-061 | High | High | The GitHub verification/deployment workflow never runs the Playwright regression suite. | TE-01 |
| C1-062 | High | High | `core-regressions.spec.js` calls the current categorizer API without its required third `categoryLabels` argument. | TE-02 |
| C1-063 | High | High | Several web “unit tests” exercise copied implementations rather than production helpers, and the copies have already drifted. | TE-03 |
| C1-064 | High | High | Local Playwright configuration accepts a stale existing server and does not reliably own server/browser shutdown. | TE-04 |
| C1-065 | High | High | YAML publication uses a weaker duplicate schema and generated JSON drift is not checked by normal build/CI gates. | TE-06, DOC-03, DOC-04, ARCH-06 |
| C1-066 | Low | High | Screenshot capture is mixed into the normal regression E2E suite. | TE-09 |
| C1-067 | High | High | The root README claims 683 cards while its issuer table accounts for only 561. | DOC-01 |
| C1-068 | Medium | High | The documented CLI example omits the statement path and cannot succeed as written. | DOC-05 |
| C1-069 | Medium | High | Issuer README “card lists” are materially incomplete without disclosing that they are only examples. | DOC-07 |
| C1-070 | Low | High | Public architecture/identity documentation still refers to removed components and the old CardPick name. | DOC-08 |
| C1-071 | Medium | High | CI installs the latest Bun release instead of the repository's declared Bun 1.2.6. | DOC-09 |

## Raw-finding coverage matrix

Every raw report ID is represented above; no item was silently dropped.

| Review | Raw IDs → aggregate IDs |
|---|---|
| code-reviewer | CR-01→C1-001; CR-02→C1-006,C1-007; CR-03→C1-005; CR-04→C1-012; CR-05→C1-017; CR-06→C1-018; CR-07→C1-020; CR-08→C1-027; CR-09→C1-010,C1-011 |
| perf-reviewer | PERF-01→C1-040; PERF-02→C1-041; PERF-03→C1-042; PERF-04→C1-043 |
| architect | ARCH-01→C1-001; ARCH-02→C1-005; ARCH-03→C1-012; ARCH-04→C1-025; ARCH-05→C1-040; ARCH-06→C1-003,C1-065 |
| security-reviewer | SR-01→C1-035; SR-02→C1-036; SR-03→C1-037; SR-04→C1-038 |
| critic | CRIT-01→C1-004; CRIT-02→C1-005; CRIT-03→C1-019; CRIT-04→C1-020; CRIT-05→C1-007; CRIT-06→C1-014 |
| tracer | TR-01→C1-004; TR-02→C1-005; TR-03→C1-019; TR-04→C1-020; TR-05→C1-014; TR-06→C1-035 |
| verifier | VER-01→C1-002; VER-02→C1-003; VER-03→C1-010; VER-04→C1-008,C1-011; VER-05→C1-005; VER-06→C1-007; VER-07→C1-015; VER-08→C1-014; VER-09→C1-024 |
| debugger | DBG-01→C1-019; DBG-02→C1-020; DBG-03→C1-021; DBG-04→C1-022; DBG-05→C1-026; DBG-06→C1-001; DBG-07→C1-013; DBG-08→C1-023 |
| test-engineer | TE-01→C1-061; TE-02→C1-062; TE-03→C1-063; TE-04→C1-064; TE-05→C1-009; TE-06→C1-065; TE-07→C1-023; TE-08→C1-038; TE-09→C1-066 |
| document-specialist | DOC-01→C1-067; DOC-02→C1-008; DOC-03→C1-065; DOC-04→C1-065; DOC-05→C1-068; DOC-06→C1-034; DOC-07→C1-069; DOC-08→C1-070; DOC-09→C1-071 |
| designer | D-01→C1-045; D-02→C1-046; D-03→C1-028; D-04→C1-047; D-05→C1-048; D-06→C1-049; D-07→C1-050; D-08→C1-029; D-09→C1-030; D-10→C1-051; D-11→C1-031; D-12→C1-043; D-13→C1-044; D-14→C1-032; D-15→C1-052; D-16→C1-053; D-17→C1-054; D-18→C1-055; D-19→C1-056; D-20→C1-033; D-21→C1-034; D-22→C1-057; D-23→C1-058; D-24→C1-060; D-25→C1-059 |

## Planning constraints

- Do not deploy.
- Security and correctness findings must be fixed or explicitly reported as unresolved errors; they are not candidates for normal deferral.
- Performance, broad architecture, and test-architecture work may be deferred only with an exact location, original severity/confidence, reason, and measurable exit criterion.
- Preserve the pre-existing dirty amount-parser/store work and its tests.
- Before and after every browser/E2E run, terminate only repository-owned Playwright/Chrome/Chromium and preview-server processes, verify port 4173 is clear, and leave interactive Chrome and the unrelated Travelback session untouched.
- A failed gate or cycle must be recorded, not used to stop the outer review/plan/fix run.
- Because the deployment workflow triggers only on pushes to `main`, any push for this cycle must use a clearly named non-deploy review branch.

## Agent and browser notes

- The designer's first report-writing attempt stalled after live inspection and was interrupted once. The required single retry completed successfully, so there is no unresolved agent failure.
- Browser routing briefly exposed an unrelated Travelback session. No interaction continued in that session.
- Review-owned preview/browser processes were terminated after inspection and TCP port 4173 was verified clear. The unrelated Travelback browser and the user's interactive Chrome processes were left untouched.
