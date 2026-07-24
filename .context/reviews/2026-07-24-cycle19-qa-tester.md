# Review-plan-fix Cycle 19 — QA tester

## Review identity

- Date: 2026-07-24
- Revision: `fcc89801451d1c1a31bb9881d213e117fc4ca923`
- Role: end-to-end contract tracing, failure reachability, acceptance
  criteria, current-history novelty, and release-readiness review
- Disposition: `C19-CR-001` independently confirmed; **zero additional QA
  roots**

## Inventory and method

The tracked inventory contains 2,409 paths. QA reconciled all implementation,
configuration, test, generated-data, policy, and documentation surfaces, with
specific full-path traces for:

- parsed transactions into analysis context, previous-spending basis,
  validation, persistence, store recovery, disclosures, and UI;
- authored card YAML into browser and legacy publication projections,
  identity/version metadata, readers, and drift checks;
- dependency source admission through production/test/config ownership; and
- E2E ownership records, preview/browser isolation, accessibility states,
  responsive behavior, and gate inclusion.

Cycle 18's three repairs were replayed against their acceptance criteria and
historical ownership. Publication bytes and identity/version were coherent;
`.ts`, `.mts`, and `.cts` dependency classifications were covered; normal and
low-year predecessor behavior remained correct.

## C19-CR-001 confirmation

- Severity: Low
- Confidence: High
- Status: confirmed, direct/exported caller impact; ordinary upload domain is
  bounded away from the failing year
- Core helper: `packages/core/src/analysis/context.ts:96-113`
- Truncated validator:
  `apps/web/src/lib/analysis-result.ts:922-981,1031-1038`
- Persistence:
  `apps/web/src/lib/persistence.ts:677-742,822-915`
- Store recovery: `apps/web/src/lib/store.svelte.ts:117-148`

The accepted runtime grammar includes `0000-01`; the public predecessor helper
correctly rejects its unrepresentable predecessor. Older validator callers
assume the helper is total. A coherent-looking truncated payload therefore
throws instead of returning false/corrupted. The store catches the exception
and clears persisted data, preventing a page crash, but direct exported
callers see the exception and the store reports the wrong recovery class.
Supported parser dates remain 1900–2100, keeping severity Low.

QA acceptance:

1. The direct predecessor helper still throws for `0000-01`.
2. The affected truncated result-coherence path treats an unrepresentable
   required predecessor as incoherent rather than throwing; a full-transaction
   control remains false before predecessor derivation because year `0000`
   transaction dates are invalid.
3. Persistence converts any coherence exception from malformed stored state
   into `{ data: null, warningKind: "corrupted", shouldRemove: true }`.
4. Valid `0000-02`, January rollover, modern months, user-total basis, and
   missing/statement-month behavior remain unchanged.
5. Focused and whole-repository gates pass.

This independently supports the code-review root and is not counted twice.

## Final sweep

The closing QA sweep checked boundary arithmetic, stale/tampered persistence,
exception ownership, generated-data drift, publication circularity and
ordering, test runner parity, dependency discovery, upload/loading/error
recovery, keyboard/focus/RTL/mobile behavior, browser ownership cleanup, and
historical duplicate owners. No second genuinely new, current, reproducible
root survived.

The six protected Cycle 42 paths were excluded from inspection and writes.
No deploy/release/publish command was run.
