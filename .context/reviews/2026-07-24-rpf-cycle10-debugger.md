# Review-plan-fix Cycle 10 — debugger

- Date: 2026-07-24
- Baseline: `56c0f1fcd5b670b20cd972556199f37e3f382d8d`
- Branch: `codex/review-plan-fix-no-deploy-20260723`
- Lens: latent bugs, malformed inputs/events, state-machine settlement,
  cancellation, error paths, and cross-boundary contract regressions
- Outcome: **1 genuinely new confirmed finding**

## Inventory and coverage

The debugger pass indexed all 2,252 tracked paths: 1,156 active non-context
paths and 1,096 historical plan/review paths used for closure and duplicate
control. Active coverage included every web, core, parser, rules, viz, CLI,
scraper, script, E2E, root/config/workflow, authored-rule, generated-artifact,
fixture, and test family. The six protected untracked Cycle 42 artifacts were
hashed before the review and left untouched.

I traced malformed, empty, partial, exact-boundary, overflow, stale,
cancelled, clone/serialization, persistence, output, and retry paths through
parser → categorizer → analysis context → calculator → optimizer → web/CLI
consumers. Worker ownership and settlement, upload admission, navigation
state, catalog publication/reading, scraper networking/quarantine/writes, and
report output were checked explicitly. Current Cycle 10 reports and all
candidate-specific historical `.context` hits were compared before the
finding below was classified.

## C10-DBG-001 — canonical dotted card IDs crash list selection and cannot be deep-linked

- **Severity:** Medium
- **Confidence:** High
- **Status:** Confirmed at the reviewed baseline
- **Canonical contract:** `packages/rules/src/security.ts:18-28`;
  `packages/rules/__tests__/security.test.ts:12-21`
- **Conflicting navigation contract:**
  `apps/web/src/lib/card-navigation-state.ts:1-2,21-29,41-47,57-64`
- **Reachable click path:** `apps/web/src/components/cards/CardGrid.svelte:462-469`;
  `apps/web/src/components/cards/CardPage.svelte:60-68,188-192`
- **Reachable deep-link path:**
  `apps/web/src/components/cards/CardPage.svelte:88-116`
- **Representative production records:**
  `packages/rules/data/cards/hana/wonder-2.0.yaml:1-5`;
  `packages/rules/data/cards/ibk/ibk-point-3.8.yaml:1-5`;
  `packages/rules/data/cards/lotte/loca-likit-1.2.yaml:1-5`
- **Regression gap:** `apps/web/__tests__/card-navigation-state.test.ts:9-22,25-68`

The canonical card-ID grammar permits dot-separated segments:
`^[a-z0-9]+(?:[.-][a-z0-9]+)*$`. The card-navigation helper independently
defines the narrower `^[a-z0-9][a-z0-9-]*$`, which rejects every ID containing
a dot.

This breaks both routes into card details:

1. The grid passes the published `card.id` to `CardPage.selectCard()`.
   `selectCard()` calls `pushCardSelectionHistory()` before updating
   `selectedCardId`. The URL builder throws synchronously for a dotted ID, so
   history is not updated and the detail view is never selected.
2. A direct `?card=<dotted-id>` link is parsed as malformed. Resolution returns
   `null` without looking up the real catalog card, and the mount synchronizer
   shows the list instead of the requested detail.

A production-helper probe at the reviewed baseline confirmed the disagreement:

```text
{"id":"hana-wonder-2.0","canonical":true,"navigation":false,"parsed":null}
TypeError: Invalid card selection ID: hana-wonder-2.0
```

Scanning the tracked published summary through the navigation grammar found
eight rejected cards out of 683:

```text
hana-wonder-2.0
hana-wonder-2.0-free
hana-wonder-2.0-happy
hana-wonder-2.0-life
hana-wonder-2.0-living
hana-wonder-2.0-young
ibk-ibk-point-3.8
lotte-loca-likit-1.2
```

The existing focused suites are false-green across this boundary: the rules
security suite explicitly proves dotted IDs are canonical, while the
navigation suite uses only hyphenated valid IDs. Both suites passed (25 tests
total), but no test sends a canonical dotted ID through navigation.

**Concrete scenario:** a user filters the card catalog and clicks “하나카드
원더카드 2.0 베이스.” The click handler throws before changing page state, so
the card appears inert. Copying or opening
`?card=hana-wonder-2.0` also silently resolves to the list, making the affected
published cards inaccessible through both supported detail-navigation paths.

**Root-cause fix:** remove the private navigation regex and consume the
browser-safe canonical card-ID contract (including its maximum length), or
export one shared pure predicate for every consumer. Add a corpus assertion
that every published summary ID is accepted and round-trips through
parse/build/resolve. Add explicit dotted-ID click and direct-link regressions,
while retaining traversal, duplicate-parameter, leading/trailing-separator,
and overlength rejection cases.

## Duplicate control and final missed-issue sweep

- Archived Plan 71 explicitly records the eight dotted product IDs as valid,
  but only for scraper filesystem/schema hardening; it does not record this
  navigation failure. Archived Plan 111 promises validated encoded card IDs
  and card-detail deep links, but its implemented test table omits dotted IDs.
- No historical review/plan or current Cycle 10 report contains the conflicting
  navigation regex, the thrown selection path, or the dotted deep-link
  rejection. Concurrent Cycle 10 category, optimizer, persistence, worker,
  performance, catalog-presentation, and external-URL findings were excluded.
- The final sweep rechecked other card-ID consumers, URL/query composition,
  catalog summary/detail lookups, issuer shard selection, worker terminal
  events, persistence replacement, parser rejection boundaries, optimizer
  ordering/caps, CLI output, and scraper failure cleanup. No second candidate
  survived reachability, reproduction, materiality, and duplicate checks.
- No browser/E2E run, source/test/plan edit, staging, commit, push, or
  deployment was performed.

Final count: **1 Medium confirmed finding (High confidence)**.
