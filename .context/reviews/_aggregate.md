# Aggregate Review - CherryPicker Review/Plan/Fix Cycle 4

**Date:** 2026-07-23
**Cycle:** 4 / 100
**Baseline:** `555c56a633f988254854f4110ddf3e3a612c4eb9`
**Branch:** `codex/review-plan-fix-no-deploy-20260723`
**Reviewers:** code-reviewer, critic, architect, perf-reviewer,
security-reviewer, tracer, debugger, verifier, test-engineer,
document-specialist, designer, implementation auditor, final diff auditor
**Deploy mode:** none

## Executive summary

The five initial review bundles cover all 11 requested roles and contain 24
raw findings. Cross-role deduplication initially produced 22 unique findings.
The first read-only implementation audit found two additional contract
defects, and the final diff audit found three more. Cycle 4 therefore contains
**27 unique findings**: 1 High, 21 Medium, and 5 Low. The two
analysis-replacement defects were each reproduced by two independent reviewer
bundles; those four raw reports map to two unique findings.

The highest-severity defect is a dashboard breakpoint collision that clips
spending and category values and creates up to 117 px of root horizontal
overflow at tablet widths. The remaining findings cover exact-money
boundaries, optimizer and calculator consistency, schema-valid fractional
mileage execution and decimal precision, persisted optimization integrity,
parser parity and browser worker ownership, atomic analysis replacement,
strict CLI and terminal boundaries, deterministic browser coverage, mobile
focus ownership, and catalog/report usability.

The implementation audits reconciled each new defect with its schema, runtime,
consumer, and browser-test paths before final gates. The six pre-existing
untracked Cycle 42 artifacts stayed outside this review and were neither edited
nor included.

| Severity | Unique findings |
|---|---:|
| High | 1 |
| Medium | 21 |
| Low | 5 |
| **Total** | **27** |

## Unique findings

### Domain and optimizer correctness

| ID | Severity | Confidence | Finding | Raw sources |
|---|---|---|---|---|
| C4-001 | Medium | High | Individually safe transaction amounts can overflow monthly and performance aggregates, while direct reward and persisted aggregate boundaries accept unsafe integers. | C4-VTD-001 |
| C4-002 | Medium | High | Reward schema, calculator, and generated projections disagree when a positive fixed reward coexists with a zero rate, publishing the LOCA 365 rule as zero percent despite its fixed reward. | C4-CCA-004 |
| C4-003 | Medium | High | A valid reward that floors to zero consumes `maxUses` and can suppress a later positive reward. | C4-DBG-001 |
| C4-004 | Medium | High | All-zero optimization leaves `bestSingleCard` with empty identity fields even though real cards were evaluated and assigned. | C4-DBG-002 |
| C4-005 | Medium | High | The optimizer assigns and totals positive non-KRW transactions that the calculator explicitly skips, producing contradictory spending totals. | C4-DBG-003 |
| C4-023 | Medium | High | The reward schema accepts fractional mileage rates, but the calculator rejects them before its mileage branch and returns zero for a schema-valid rule. | C4-IA-001 |
| C4-024 | Medium | High | Persisted optimization validation accepts malformed containers and partial nested entries, allowing crashable or internally inconsistent state to restore. | C4-IA-002 |
| C4-025 | Medium | High | Binary floating-point multiplication can floor a schema-valid decimal mileage rate below its exact value, such as 0.29 times 100 blocks yielding 28 instead of 29 miles. | C4-FA-001 |

### Parser and performance boundaries

| ID | Severity | Confidence | Finding | Raw sources |
|---|---|---|---|---|
| C4-006 | Medium | High | Multi-file analysis spreads an entire parsed transaction array into `push`, which can exceed the engine argument limit for a valid statement above roughly 125,000 rows. | C4-PERF-001 |
| C4-007 | Medium | High | JSON, OFX, and HTML worker paths materialize and structured-clone full strings on the window side instead of transferring the admitted file buffer. | C4-PERF-002 |
| C4-008 | Low | High | The nominal 30-line delimiter sample splits, trims, and filters the entire CSV in both browser and package implementations. | C4-PERF-003 |
| C4-009 | Medium | High | Browser JSON-prefix sniffing misclassifies valid brace- or bracket-prefixed CSV and diverges from the server path. | C4-CCA-003 |
| C4-010 | Low | High | The browser OFX parser retains a transaction after reporting its invalid date, while the server parser rejects that row. | C4-CCA-005 |

### Web replacement and regression integrity

| ID | Severity | Confidence | Finding | Raw sources |
|---|---|---|---|---|
| C4-011 | Medium | High | An already-stale caller can begin a replacement and erase committed in-memory and persisted analysis before its ownership is checked. | C4-VTD-002, C4-CCA-001 |
| C4-012 | Medium | High | A failed persisted-analysis clear is treated as a warning, allowing old persisted A to survive failed replacement B and return after reload. | C4-VTD-003, C4-CCA-002 |
| C4-013 | Medium | High | Card search and detail E2E cases can pass without proving their named behavior and depend on fixed two-second waits for readiness and error observation. | C4-VTD-004 |

### CLI, scraper, and documentation boundaries

| ID | Severity | Confidence | Finding | Raw sources |
|---|---|---|---|---|
| C4-014 | Medium | High | LLM-controlled scraper text reaches inherited terminal sinks without the repository's control-sequence and bidi sanitizer. | C4-SEC-001 |
| C4-015 | Medium | High | The `scrape` command remains outside the strict generated-help option contract and silently accepts last-wins duplicate singleton options. | C4-CLI-001 |
| C4-016 | Low | High | `validateFilePath` documents null-byte rejection but removes the byte only for validation and lets callers continue with the original path. | C4-VTD-006 |
| C4-017 | Low | High | Live user and maintainer documentation names removed parser/chart dependencies and obsolete keyword conflict behavior. | C4-VTD-005 |

### UI and interaction correctness

| ID | Severity | Confidence | Finding | Raw sources |
|---|---|---|---|---|
| C4-018 | High | High | Dashboard children switch to desktop-density layouts inside half-width tablet containers, clipping key values and widening the 768 px document to 885 px. | D4-01 |
| C4-019 | Medium | High | Focusing a category disclosure opens it, so the user's first Enter or pointer activation closes it instead of opening it. | D4-02 |
| C4-020 | Medium | High | Credit and prepaid type badges fall below 4.5:1 small-text contrast in dark mode, with the same failing blue pair reused for transaction confidence. | D4-03 |
| C4-021 | Medium | High | Mobile pagination is available only after 24 issuer filters and 36 cards, placing it more than 7,100 px down a 320 px catalog page. | D4-04 |
| C4-022 | Low | High | A direct report visit without analysis still exposes and executes the print/PDF action for the empty-state prompt. | D4-05 |
| C4-026 | Medium | High | Selecting a mobile issuer collapses the options panel while focus remains on its newly hidden child button instead of returning to the visible toggle. | C4-FA-002 |
| C4-027 | Medium | High | Runtime-error browser tests assert immediately after readiness, so a next-frame error can occur after the assertion and still false-pass. | C4-FA-003 |

## Raw-finding coverage matrix

Every raw finding maps to one unique aggregate finding.

| Review bundle | Raw IDs to aggregate IDs |
|---|---|
| perf-reviewer | C4-PERF-001 to C4-006; C4-PERF-002 to C4-007; C4-PERF-003 to C4-008 |
| verifier, test-engineer, document-specialist | C4-VTD-001 to C4-001; C4-VTD-002 to C4-011; C4-VTD-003 to C4-012; C4-VTD-004 to C4-013; C4-VTD-005 to C4-017; C4-VTD-006 to C4-016 |
| code-reviewer, critic, architect | C4-CCA-001 to C4-011; C4-CCA-002 to C4-012; C4-CCA-003 to C4-009; C4-CCA-004 to C4-002; C4-CCA-005 to C4-010 |
| security-reviewer, tracer, debugger | C4-SEC-001 to C4-014; C4-CLI-001 to C4-015; C4-DBG-001 to C4-003; C4-DBG-002 to C4-004; C4-DBG-003 to C4-005 |
| designer | D4-01 to C4-018; D4-02 to C4-019; D4-03 to C4-020; D4-04 to C4-021; D4-05 to C4-022 |
| implementation auditor | C4-IA-001 to C4-023; C4-IA-002 to C4-024 |
| final diff auditor | C4-FA-001 to C4-025; C4-FA-002 to C4-026; C4-FA-003 to C4-027 |

## Cross-review agreement

- C4-011 was independently reproduced by the verifier/test/document bundle and
  the code/critic/architect bundle. Both traced the destructive work before the
  first caller-ownership check.
- C4-012 was independently reproduced by those same bundles. Both confirmed
  that a failed storage clear permits stale persisted bytes to outlive a failed
  replacement.
- C4-013 and D4-01 through D4-05 were checked against existing browser
  coverage. The current suite lacks deterministic assertions for the named
  failures and tablet geometry.
- C4-023 and C4-024 were found by an independent read-only audit after the
  initial implementation. Both were promoted into Plan 84 before final gates
  instead of being deferred.
- C4-025 through C4-027 were found by a fresh read-only audit after the first
  green gate run. They were promoted into Plans 84 and 88 and required another
  complete gate run instead of being waived.

## Plan coverage

Every Cycle 4 finding is scheduled. There are no Cycle 4 deferrals.

| Plan | Scheduled findings |
|---|---|
| 84 - Core domain consistency | C4-001 through C4-005, C4-023 through C4-025 |
| 85 - Parser and worker performance | C4-006 through C4-010 |
| 86 - Analysis replacement atomicity | C4-011, C4-012 |
| 87 - CLI, scraper, and documentation boundaries | C4-014 through C4-017 |
| 88 - UI and browser regressions | C4-013, C4-018 through C4-022, C4-026, C4-027 |

Plans 79 through 83 were fully completed and verified in Cycle 3 and were
archived before Cycle 4 implementation planning. Historical deferrals remain
owned by their existing records; no Cycle 4 finding was added to them.

## Implementation closure and final gates

All 27 unique findings were implemented in Plans 84 through 88. The final diff
audit added decimal-exact mileage multiplication, visible focus restoration
after mobile issuer collapse, and a controlled post-settle runtime-error
observation window. No Cycle 4 finding was deferred.

The reward normalization transform was also adjusted to preserve the existing
`rate` key position. Regenerating through `bun run data:build` reduced roughly
20,000 lines of property-order-only catalog churn to the intended LOCA 365
semantic change and deterministic catalog identity updates.

| Gate | Final result |
|---|---|
| `bun run lint` | 7 packages passed; web checked 97 files with 0 errors, warnings, or hints |
| `bun run typecheck` | 7 packages passed; web checked 97 files with 0 errors, warnings, or hints |
| `bun run build` | 7/7 packages and 5 Astro pages passed without warnings |
| `bun run test` | 12/12 workspace tasks passed: 2,402 package tests and 55 root-script tests |
| `bun run test:bun` | 1,684/1,684 passed |
| `bunx vitest run` | 91/91 files and 2,394/2,394 tests passed |
| `bun run test:e2e` | 93/93 passed in the exact repository-owned runner |

Data generation/checks verified 683 cards across 24 issuers. Dependency,
migration, and documentation checks also passed.

Seven distinct gate root causes were repaired during implementation:

1. Astro 6.0.8 emitted its known unused integration re-export warning; the
   workspace now resolves Astro 6.1.4.
2. A scraper process test used Bun-specific spawning under Vitest; the test now
   uses a portable process boundary.
3. Five browser cases used an impossible island-geometry hydration condition;
   they now wait for component-specific readiness.
4. The tablet assertion selected a responsive copy hidden at that breakpoint;
   it now selects the visible category value inside the real panel.
5. The mobile issuer assertion retained a locator whose accessible role
   disappeared after collapse; it now uses a DOM-stable selected control.
6. The E2E runner forwarded inherited `NO_COLOR` into Playwright's
   `FORCE_COLOR` process tree; Playwright-owned commands now omit it.
7. A replacement-runtime fixture retained an empty `bestSingleCard` identity
   after strict persistence validation; it now uses a valid card identity.

## Review and cleanup evidence

- All 11 requested review roles and both implementation audits completed. No
  reviewer failed or timed out.
- Performance, core, parser, CLI, rules, data, dependency, lint, type, and
  build probes reported by the role bundles passed on the review baseline.
- The designer inspected the production build at 320, 767, 768, 900, 1024,
  1100, and 1440 px, light and dark themes, keyboard and pointer interaction,
  restored and empty states, and print behavior.
- The designer's isolated agent-browser session, Chrome helper tree, crashpad
  processes, and Astro preview were closed. An independent audit confirmed no
  owned E2E run, no listener on TCP 4173, and no repository-owned browser or
  preview process.
- The final 93-test browser postflight again confirmed no owned run, listener,
  browser, or preview process. The six protected Cycle 42 artifacts retained
  their baseline hashes and remained outside staging.
- Interactive Chrome, Codex, Travelback, xylolabs, and other-workspace process
  trees were not signalled.
- No deployment was performed.
