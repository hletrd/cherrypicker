# Cycle 10 Critic Report

- Date: 2026-07-24
- Reviewed commit: `56c0f1fcd5b670b20cd972556199f37e3f382d8d`
- Branch: `codex/review-plan-fix-no-deploy-20260723`
- Lens: end-user truth, competing product interpretations, failure communication,
  and cross-layer contract challenges
- Outcome: **2 genuinely new findings — 1 Medium, 1 Low**

## Inventory, challenge method, and duplicate control

I reset to the current HEAD and indexed all 2,252 tracked paths before tracing
the repository as a product rather than treating individual packages in
isolation. The inventory covered 167 web paths, 39 core paths, 86 parser paths,
733 rules paths, 14 visualization paths, 28 CLI paths, 35 scraper paths, 19
scripts, 16 E2E paths, 19 root/configuration/other paths, and all 1,096 tracked
`.context` provenance paths. The 685 YAML records and generated browser
catalogs were treated as one executable data family and checked through their
schema, publication, reader, and UI consumers.

The pass followed these competing perspectives end to end:

- a user uploading one or several statements, reviewing parsing exclusions,
  receiving recommendations, editing categories, restoring a session, and
  reoptimizing;
- a user comparing catalog cards and relying on the detail table to understand
  where a stated benefit actually applies;
- a browser operation owner dealing with aborts, stale results, worker faults,
  mixed artifact generations, and malformed runtime messages;
- a CLI user consuming analyze/optimize/report disclosures;
- a data author or scraper operator moving a rule through validation,
  publication, recommendation eligibility, and public presentation; and
- a maintainer relying on tests, generated-artifact identity, documentation,
  workflow gates, and prior review closure claims.

For duplicate control I indexed all current and archived `.context` material,
fully read the Cycle 9 aggregate and Plans 114–119, and compared candidates
with every Cycle 10 report available at finalization, including the later
zero-finding architect report. I did not
repeat the current code-reviewer findings (short category aliases,
counterfactual ordering, and persistence provenance), the performance
reviewer's duplicate coherence scans, or the security reviewer's model-authored
official URL. The rejected leading-NUL/prefixed-XLSX hypothesis and historical
incremental-optimizer, category-taxonomy duplication, and generic missing-test
topics were also excluded.

## Findings

### C10-CT-001 — Card details discard supported reward identity and eligibility conditions

- **Severity:** Medium
- **Confidence:** High
- **Classification:** Confirmed
- **Locations:**
  - Canonical rule fields: `packages/rules/src/types.ts:48-60`
  - Full detail publication and deduplicated summary projection:
    `scripts/catalog-publication.ts:211-253`
  - Detail-row projection:
    `apps/web/src/components/cards/CardDetail.svelte:105-137`
  - Detail table rendering:
    `apps/web/src/components/cards/CardDetail.svelte:320-355`
  - Category-count sorting and labels:
    `apps/web/src/components/cards/CardGrid.svelte:102-110,320-328,502-509`
  - Concrete authored rule:
    `packages/rules/data/cards/lotte/likit-eat.yaml:28-99`

The canonical reward model carries a stable rule ID, a human label, structured
conditions, and one or more tier values. Publication retains those fields in
detail shards. `CardDetail`, however, reduces each supported rule to only
`{ category, tier }` before rendering. It never carries or displays the label
or any condition such as `specificMerchants`, transaction bounds, weekday,
channel, payment type, or occurrence limit. The table therefore presents a
broad category and numeric rate without the facts that delimit that rate.

This is observable in current production data, not just a synthetic shape.
`lotte-likit-eat` has three separately identified 60% rules:

1. restaurants (`음식점`);
2. three named delivery apps; and
3. four named cafe brands.

An executable probe loaded the tracked detail shard and categories through the
production readers and projected the tier with the same display helpers. The
three distinct source rules all produced the identical visible tuple:

```text
["외식", "60%", "무제한", "전월 40만원 이상"]
["외식", "60%", "무제한", "전월 40만원 이상"]
["외식", "60%", "무제한", "전월 40만원 이상"]
```

The lost fields were respectively `음식점 60% 결제일 할인`,
`배달앱 60% 결제일 할인`, and `카페 60% 결제일 할인`, with different
merchant allowlists. A current-artifact scan found 656 supported conditional
rules across 373 active cards, including 298 supported merchant-scoped rules.
It also found 44 active cards whose supported rule count is larger than their
distinct supported category count. The summary deliberately deduplicates those
rules to category keys, but `CardGrid` then calls that category count
“혜택” and sorts it as “혜택 많은순,” further presenting category coverage as
a count of distinct benefits.

**Failure scenario:** a user opens LOCA LIKIT Eat to decide whether an ordinary
dining purchase qualifies. The page shows repeated broad “외식 60%” rows and
does not identify delivery apps, cafes, or merchant scope. The user can
reasonably read the table as 60% across dining, or cannot distinguish the rows
at all, even though the optimizer enforces the narrower conditions.

The competing interpretation is that the page is only a category overview.
That does not explain the repeated indistinguishable rows, the exact rate/cap/
performance columns, or why the unsupported section at
`CardDetail.svelte:378-393` does preserve `reward.label` while the supported
table drops it. There is no nearby disclosure that supported conditions are
omitted.

**Fix:** carry the complete reward (or at least its ID, label, and conditions)
through `FlatRow`. Render `reward.label` as the primary benefit name, category
as secondary context, and structured conditions in human-readable form.
Conditions that cannot be rendered safely should produce an explicit
“additional eligibility conditions apply” disclosure rather than a broad
category claim. Rename the compact summary badge/sort to “혜택 분야” if it is
intended to count unique categories, or publish and use a separate supported
rule count. Add a production-shaped component regression for
`lotte-likit-eat` that proves the three rows remain distinguishable and expose
their merchant scopes.

### C10-CT-002 — A cloneable malformed optimizer response bypasses settlement and leaves the worker live

- **Severity:** Low
- **Confidence:** High
- **Classification:** Confirmed state-machine failure; production triggering
  requires protocol skew or browser/runtime fault injection
- **Locations:**
  - Type-only response contract:
    `apps/web/src/lib/optimizer/worker-protocol.ts:7-14`
  - Unprotected message handler and cleanup:
    `apps/web/src/lib/optimizer/worker-runner.ts:66-110`
  - Defensive parser-worker contrast:
    `apps/web/src/lib/parser/worker-runner.ts:85-130`
  - Test helper and current terminal-event coverage:
    `apps/web/__tests__/optimizer-worker.test.ts:16-85,155-191`

Cycle 9 correctly added a `messageerror` listener for structured-clone
deserialization failures. A cloneable value with the wrong protocol shape does
not emit `messageerror`; it arrives as an ordinary `message`. The optimizer
handler immediately reads `event.data.ok` outside a `try` block and performs no
runtime decoding. For `null`, that listener throws on the main thread before
`fail()` or `settle()` runs. The exception does not become a worker `error`
event, so the promise remains pending, all listeners remain registered, and
the owned worker is not terminated.

A bounded fake-worker probe against the production runner produced:

```json
{
  "thrown": "TypeError: null is not an object (evaluating 'event.data.ok')",
  "outcome": "still-pending",
  "terminations": 0,
  "listeners": ["message", "error", "messageerror"]
}
```

This is distinct from the closed Cycle 9 `messageerror` finding: the browser
successfully delivers this message, so the newly added listener is never
called. The parser runner already wraps response access and deserialization in
`try/catch`, while the optimizer runner does not. The optimizer fake's
`respond()` method accepts only the TypeScript union, preventing the existing
tests from exercising runtime-invalid but cloneable payloads.

**Failure scenario:** an optimizer worker/main-bundle protocol regression,
partial version skew, or injected runtime fault posts `null` or another
cloneable invalid response. Analysis remains in its loading state until the
caller explicitly aborts or navigates away, and the worker remains alive.
Normal current worker output is well shaped, which keeps the severity Low, but
the owned-worker settlement contract is demonstrably not fail-closed.

**Fix:** type the incoming event as `MessageEvent<unknown>`, decode the
discriminated union at runtime, validate the success-result shape, and wrap the
entire message handler so every invalid payload calls the common sanitized
`fail()` path. Extend the fake worker with an `unknown` response emitter and
test `null`, `undefined`, missing `ok`, invalid result, and invalid error
message payloads for exactly one rejection, listener removal, and one
termination.

## Verification and final missed-case sweep

Focused non-browser suites remained green:

```text
bun test apps/web/__tests__/card-detail-support.test.ts \
  apps/web/__tests__/cards-loader.test.ts \
  apps/web/__tests__/optimizer-worker.test.ts \
  apps/web/__tests__/parser-worker.test.ts \
  scripts/__tests__/catalog-publication.test.ts

55 pass, 0 fail
```

I then repeated searches and source traces for claim/data mismatches, reward
scope and count semantics, annual-fee wording, parser exclusion disclosure,
month/provenance derivation, persistence restoration, worker terminal events,
abort ownership, catalog identity, CLI/web divergence, rule publication,
escaping, external links, and documentation/build truth. The annual-fee grid
copy has one narrow domestic/international ambiguity, but it did not meet the
materiality bar for a third finding after considering that the domestic card
variant is actually fee-free. No other non-duplicate candidate survived the
current-product, evidence, and historical-ledger checks.

No source, test, plan, generated artifact, protected Cycle 42 file, browser/E2E
state, staging area, commit, push, or deployment was changed.
