# Review-plan-fix Cycle 8 — tracer

- Date: 2026-07-24
- Baseline: `3fd993d471a8676170031f20715f6a53c99e8a9f`
- Branch: `codex/review-plan-fix-no-deploy-20260723`
- Lens: causal tracing, competing hypotheses, provenance preservation, and
  cross-file state transitions

## Inventory and trace coverage

I inventoried all 2,199 tracked paths before tracing active flows. Review
families included web source/tests and static assets; core, parser, rules, and
viz source/tests; CLI and scraper source/tests/config; scripts, workflows,
manifests, lock/vendor policy, E2E suites, documentation, 683 authored YAML
rules, and generated/publication artifacts. Six untracked protected Cycle 42
files were left untouched.

The trace pass followed upload/CLI input through format selection, each parser
adapter, row diagnostics, worker transfer, ordered multi-file merge,
categorization, calendar/performance provenance, optimization, persistence,
category edits, terminal/report rendering, catalog authoring/publication,
scraper extraction, and filesystem output. It separately followed malformed,
partial, stale, cancelled, truncated, conflicting-field, exact-boundary,
unsupported-rule, and artifact-mismatch branches. Historical Cycle 7 findings
were removed from consideration after their current closure was checked.

## RPF8-TRACE-001 — same-role amount fields are selected by source order

- **Severity:** Medium
- **Confidence:** High
- **Status:** Confirmed
- **Planner construction:** `packages/parser/src/shared/amount-fields.ts:176-197`
- **Selection defect:** `packages/parser/src/shared/amount-fields.ts:221-225,
  227-283`
- **Confirmed JSON ingress:** `packages/parser/src/shared/json.ts:157-180,
  197-230`
- **Other affected callers:** `packages/parser/src/csv/generic.ts:141-181,
  270-323`; `packages/parser/src/html/index.ts:134-140,193-205`;
  `packages/parser/src/xlsx/index.ts:192-205,274-286`

`compileAmountFieldPlan()` preserves header or object-key order. The conflict
logic rejects an incoming/outgoing pair and an incoming/neutral pair, but it
does not compare multiple populated fields that have the same role.
`preferredOrFirst()` therefore selects the first same-role candidate. Shared
JSON and generic CSV/HTML/XLSX callers do not provide a preferred field.

Both `승인금액` and `청구금액` classify as neutral. If both are populated but
differ, the first property/header silently becomes the transaction amount.
Changing only key order changes a valid parsed transaction with no diagnostic:

```text
{ 승인금액: 10000, 청구금액: 9500 } -> amount 10000, errors []
{ 청구금액: 9500, 승인금액: 10000 } -> amount  9500, errors []
```

That direct `parseJSONTransactions()` probe was run at this baseline. The same
planner is shared by tabular parsers, so column order has the parallel effect.
The chosen value proceeds through categorization, monthly spending,
performance tiers, rewards, persistence, and reports as though authoritative.

### Competing hypotheses checked

1. **A semantic preference chooses the billed amount.** False for shared JSON
   and generic tabular callers: `preferredName` is omitted, so every candidate
   has `preferred: false`.
2. **The directional conflict guard rejects two populated amounts.** False:
   its predicates cover outgoing+incoming and incoming+neutral, not
   neutral+neutral or outgoing+outgoing.
3. **Downstream amount validation catches the disagreement.** False: both
   values are positive safe amounts, and only the selected value is parsed.
4. **Cycle 7 order-independence tests cover this case.** False: the focused
   suite covers Credit/Debit ordering and conflicting directions, not two
   populated same-role fields with unequal values.

**Concrete failure:** a statement export containing authorized and billed
amount columns can change total spending and rewards merely because a producer
reorders columns or JSON keys. Foreign-currency conversion, discounts, or
settlement adjustments make unequal values plausible. No warning tells the
user that one amount was discarded.

**Fix:** make same-role resolution explicit. Define canonical semantic
precedence for known fields where the product contract can justify it (for
example, billed/settled versus authorized), and otherwise compare normalized
populated values. Accept equal duplicates; reject unequal candidates with
`ambiguous_amount_direction` or a dedicated `conflicting_amount_fields`
diagnostic. Apply the same rule to preferred configured adapters instead of
silently ignoring a conflicting peer. Add JSON and CSV/XLSX/HTML parity tests
for both orders, equal duplicates, unequal duplicates, and explicit bank
preferences.

## Verification

- Two direct JSON probes confirmed order-dependent outputs of 10,000 and
  9,500 won with zero errors.
- A direct planner probe confirmed both headers are neutral and the first
  candidate is selected.
- The existing Cycle 7 parser/core boundary suites passed **31/31**, confirming
  this is a missing case rather than an already-failing regression.
- No browser/E2E run or non-report repository mutation was performed.

## Final missed-issue sweep

The final trace revisited operation epochs, abort composition, parser payload
ownership, input-order merge, transaction IDs, bank/format identity,
previous-month and fact provenance, unsupported-rule aggregation, catalog
publication identity, persistence migrations, report context, filesystem
identity, and all Cycle 7 change paths. No second distinct trace defect met the
evidence threshold.

Final count: **1 Medium finding** (`RPF8-TRACE-001`).
