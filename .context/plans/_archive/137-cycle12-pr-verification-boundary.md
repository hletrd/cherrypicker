# Plan 137 — Cycle 12 Pull-Request Verification Boundary

**Finding:** C12-009 (`RPF12-TE-001`, Medium/High)
**Status:** completed
**Deploy mode:** none

## Evidence

- The sole workflow runs on `main` push or manual dispatch only.
- Verification and E2E therefore begin after merge, not as a pull-request
  status.
- Workflow contract tests do not inspect event triggers.
- Historical `D-05` covered gate contents, which the current `verify` step
  already satisfies.

## Outcome

Pull requests run read-only verification and browser regression before merge.
Pages artifact upload and deployment remain authorized only for trusted
`main` pushes or explicit manual dispatch.

## Implementation

1. Add a red workflow-contract test requiring `pull_request` and rejecting
   `pull_request_target`.
2. Add the read-only PR trigger to the workflow.
3. Gate Pages artifact upload and the deployment job to trusted `main`
   push/manual events. Keep PR code away from Pages/OIDC write permissions.
4. Preserve frozen installation, full-SHA action pins,
   `persist-credentials: false`, toolchain checks, verification, E2E, and
   failure-artifact handling.
5. Parse the resulting YAML in tests to assert both trigger and publication
   conditions. Do not dispatch or deploy while validating.

## Acceptance

- [x] Pull requests automatically run `verify` and `test:e2e`.
- [x] `pull_request_target` is absent.
- [x] PR runs cannot upload Pages artifacts or enter the deploy job.
- [x] Main/manual trusted runs retain current publication behavior.
- [x] Workflow policy tests lock the trust boundary.

## Execution note

The requested `ralph` skill is unavailable. Prompt 3 will use the approved
manual workflow-contract red→configuration→green fallback plus repository
gates. Validation is static/local only. No workflow dispatch or deployment is
permitted.

## Completion evidence

- Red: the new static trigger/publication contract failed once against the
  main/manual-only workflow.
- Green: all nine workflow-consistency tests pass. Pull requests run
  verification and E2E, while Pages upload/deploy remains explicitly limited
  to trusted `main` pushes or manual dispatch.
- Commit:
  `a8a8276da2b0b79484fc1a5e3289fa295b2b690e`
  (`👷 ci: verify pull requests before merge`).
