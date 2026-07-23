# Cycle 4 Final Diff Audit

**Date:** 2026-07-23
**Baseline:** Cycle 4 implementation after the first green gate run
**Scope:** fractional mileage execution, mobile card filters, runtime-error E2E
**Method:** read-only independent diff and contract audit

## Findings

### C4-FA-001 - Binary fractional mileage can under-credit

- **Severity:** Medium
- **Confidence:** High
- **Aggregate ID:** C4-025
- **Evidence:** The reward schema admits finite positive decimal mileage rates,
  but the calculator multiplies the binary floating-point rate by the count of
  1,500-won blocks and floors the result. A rate of 0.29 over 100 blocks
  becomes 28.999999999999996 and pays 28 miles instead of 29.
- **Required closure:** Calculate whole miles from the authored decimal value
  without binary underflow and add a non-binary-fraction
  schema-to-calculator regression.

### C4-FA-002 - Mobile issuer collapse leaves focus hidden

- **Severity:** Medium
- **Confidence:** High
- **Aggregate ID:** C4-026
- **Evidence:** Selecting an issuer closes the mobile options container while
  focus remains on the selected child button. The selected control becomes
  hidden and the visible issuer toggle does not receive focus.
- **Required closure:** Return focus to the visible mobile issuer toggle after
  selection and assert both collapse state and visible focus in the blocking
  browser test.

### C4-FA-003 - Runtime-error tests stop observing too early

- **Severity:** Medium
- **Confidence:** High
- **Aggregate ID:** C4-027
- **Evidence:** The home and dashboard runtime-error tests assert their
  captured error arrays immediately after readiness. A queued animation-frame
  or next-turn error can therefore occur after the assertion.
- **Required closure:** Add a controlled post-settle browser turn before both
  assertions without reintroducing fixed waits or island geometry checks.

## Result

All three findings are new and above the Cycle 4 reporting threshold. They
extend Plans 84 and 88, raise the aggregate from 24 to 27 unique findings, and
require a second complete final gate run. None is deferred.

## Implementation closure

- C4-FA-001 was fixed with decimal-exact rational multiplication before the
  whole-mile floor. The 0.29 regression pays 28 miles below 100 complete
  blocks and exactly 29 miles at 150,000 won.
- C4-FA-002 was fixed by committing the mobile collapse, then returning focus
  to the still-visible issuer toggle. The blocking browser test requires that
  toggle to be visible and focused.
- C4-FA-003 was fixed with a named double-animation-frame console sentinel.
  Both runtime-error listeners remain active until the sentinel is observed.
- The second complete lint, type, build, workspace test, Bun, Vitest, and
  93-test browser gate passed. Browser postflight was clean, and no finding was
  deferred or deployed.
