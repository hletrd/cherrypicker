# Plan 78 — Cycle 2 Workflow and Standalone Report Integrity

**Findings:** C2-021, C2-023, C2-025
**Deploy mode:** none
**Status:** completed

## Outcome

Reduce workflow supply-chain authority and make the local HTML report secure,
styled, and consistently branded.

## Tasks

- [x] Pin every workflow action to a reviewed full commit SHA. Give the build
  job only `contents: read`, disable persisted checkout credentials, and grant
  Pages/OIDC writes only to the protected deploy job/environment.
- [x] Add a workflow policy test rejecting mutable `uses:` references and
  workflow-level write permissions.
- [x] Keep report `script-src 'none'` while authorizing only the exact inline
  stylesheet with a deterministic SHA-256 CSP hash.
- [x] Add a browser report regression asserting an active stylesheet and
  representative computed body/grid/table styles.
- [x] Replace all public report `CardPick` occurrences with `CherryPicker` and
  add a generated-report/repository regression for the retired name.

## Acceptance

- [x] Every action reference is a 40-character SHA and build has no Pages/OIDC
  write capability.
- [x] Generated reports activate only their fixed stylesheet and no scripts.
- [x] Title, heading, and footer say `CherryPicker`.
- [x] Workflow tests, viz tests, report browser regression, and full gates pass.

## Coverage

| Finding | Completion evidence |
|---|---|
| C2-021 | SHA/permission policy test |
| C2-023 | CSP hash plus computed-style browser test |
| C2-025 | generated report branding assertions |
