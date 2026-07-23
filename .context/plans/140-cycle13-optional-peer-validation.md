# Plan 140: Cycle 13 Optional Peer Validation

**Finding:** C13-003 (`RPF13-DEP-001`, Low/High)
**Status:** planned
**Deploy mode:** none

## Evidence

- The frozen lock graph resolves `astro@7.1.3`.
- That lock row declares exact optional peer
  `@astrojs/markdown-remark: 7.2.1`, while the present resolved package is
  `@astrojs/markdown-remark@7.2.0`.
- `bun pm why @astrojs/markdown-remark` reports the same installed version and
  exact unmet requirement.
- A complete scan of 632 lock rows and 77 serialized peer contracts found this
  as the sole mismatch.
- The current Astro configuration does not activate the legacy unified
  Markdown path, so there is no present user-facing failure. A frozen install
  nevertheless preserves an unsupported graph.
- `scripts/check-dependencies.ts` and its fixtures do not inspect required or
  optional peer contracts.

## Outcome

The frozen graph either omits Astro's unused optional peer or resolves it at a
compatible version without expanding the direct dependency surface. The
blocking dependency gate evaluates package and workspace peer contracts with
package-path-aware resolution: required peers must be present and compatible;
optional peers may be absent, but are rejected when present and incompatible.

## Implementation

1. Add a red current-lock assertion that reports exactly
   `astro@7.1.3 -> @astrojs/markdown-remark 7.2.1, actual 7.2.0`.
2. Add synthetic fixtures for a present incompatible exact optional peer, a
   compatible exact optional peer, an absent optional peer, a missing required
   peer, an incompatible required peer, exact/caret/OR/prerelease ranges, and
   workspace peer contracts.
3. Add resolver controls proving:
   - nearest nested compatible plus incompatible root passes;
   - nearest nested incompatible plus compatible root fails;
   - unrelated nested presence does not make an optional peer present;
   - parent-sibling nested resolution and root fallback work; and
   - scoped owner and peer names remain atomic.
4. Parse `bun.lock` with `Bun.JSONC.parse` and enumerate `packages` row peer
   metadata plus `workspaces.*.peerDependencies`.
5. Resolve a peer from the owning package path through nested ancestors to the
   nearest sibling and then the root package key. Do not assume every peer is
   an owner-child or root-hoisted package.
6. Read registry identities without naïve `@` splitting and validate versions
   with `Bun.semver.satisfies`. Resolve workspace versions from workspace
   metadata. File, alias, unsupported, malformed-row, malformed-range, and
   malformed-version cases must return a deterministic fail-closed diagnostic
   instead of throwing or silently passing.
7. Integrate peer mismatches into the existing blocking
   `checkDependencies()` result. Optional absence passes; required absence and
   every present incompatible peer fail.
8. Re-resolve the stale optional package tuple so the unused peer is absent or
   present at compatible `7.2.1`, without adding it to the web manifest or
   enabling the dormant unified Markdown path. Do not perform unrelated
   upgrades.
9. Confirm the current-lock regression, `bun pm why`, frozen installation, the
   dependency gate, web typecheck, and production build are green.

## Acceptance

- [ ] The current frozen graph has no peer mismatch.
- [ ] Astro's optional peer is absent or resolves compatibly at `7.2.1`.
- [ ] The unused optional peer is not added as a direct web dependency.
- [ ] Present incompatible optional peers fail with an actionable diagnostic.
- [ ] Absent optional peers pass.
- [ ] Missing or incompatible required peers fail.
- [ ] Nearest nested, parent-sibling, root fallback, workspace, and scoped peer
      resolution is correct.
- [ ] Malformed and unsupported lock identities fail deterministically.
- [ ] The lockfile changes only as required for the optional-peer repair.
- [ ] Existing import, remote-reference, vendor-integrity, and dependency
      checks remain green.

## Verification

Run focused dependency fixtures, `bun run dependencies:check`,
`bun pm why @astrojs/markdown-remark`, a frozen install check, web typecheck,
and build. Then run `bun run lint`, `bun run typecheck`, `bun run build`,
`bun run test`, `bun run test:bun`, `bunx vitest run`, and `bun run verify`.
Finish with `bun run test:e2e`,
`bun scripts/run-e2e.ts status --assert-clean`, TCP 4173, and exact owned
process-tree cleanup checks.

## Execution note

The requested `ralph` capability is unavailable. Prompt 3 will use the approved
manual disciplined fallback: add failing lock-policy fixtures, implement the
smallest compatible parser and graph repair, run focused green verification,
and then run every required repository gate. No deployment is permitted.
