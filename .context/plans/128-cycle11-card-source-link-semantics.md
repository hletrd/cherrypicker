# Plan 128 — Cycle 11 Card Source Link Semantics

**Findings:** C11-004 (Medium/High)
**Status:** planned
**Deploy mode:** none

## Evidence

- At least 26 canonical `manual` or `web` card records point to clear
  aggregator, news, or wiki hosts.
- `card.url` and the final href guard prove reviewed provenance and safe
  HTTP(S) syntax, not issuer ownership.
- `CardDetail` names every accepted value `officialCardUrl` and presents it as
  “공식 카드 페이지.”
- Cycle 10 Plan 122 correctly removed untrusted model URL authority; this
  remaining mismatch begins after that review boundary.

## Outcome

The existing generic `card.url` field is presented as a reviewed product
information source, never as proof of an issuer-official destination. Users
see the destination host before leaving CherryPicker.

## Implementation

1. Add a red presentation contract using current third-party records such as
   KB NEED Edu and Lotte LOCA for Auto. The source link must not receive the
   official-page label.
2. Rename component-local variables and neutralize the link copy to
   “상품 정보 출처” (or equivalently precise Korean wording).
3. Derive and display the normalized destination hostname next to the link,
   using the already validated URL rather than parsing raw untrusted input in
   the component.
4. Keep unsafe/malformed URLs hidden and preserve `noopener noreferrer`,
   external-target, keyboard, and decorative-SVG semantics.
5. Update unit/source-contract and E2E security selectors so safe reviewed
   links remain visible under neutral copy while unsafe URLs remain absent.
6. Update schema/test wording that currently calls the generic reviewed field
   an “official card URL.” Do not weaken the Cycle 10 prohibition on
   `llm-scrape` URLs.
7. Add a current-corpus assertion that the 26 known third-party destinations
   can only receive neutral source presentation. A future issuer-bound
   `officialUrl` field may be added separately if authoritative host
   provenance is modeled.

## Acceptance

- [ ] No existing `card.url` is labeled as an official card page.
- [ ] The 26 conservative third-party records render neutral source copy and
      expose their destination hostname.
- [ ] Safe issuer-host links also use the truthful generic source wording
      until a distinct official-host contract exists.
- [ ] Unsafe or malformed URLs remain absent from the rendered UI.
- [ ] Cycle 10 model-authority and external-link security regressions remain
      green.
- [ ] Link accessibility and browser security attributes remain intact.

## Execution note

The requested `ralph` skill is unavailable. Prompt 3 will use the approved
manual test-first fallback across component contracts, URL helpers, current
catalog examples, and E2E security coverage before repository-wide gates. No
deployment is part of this plan.
