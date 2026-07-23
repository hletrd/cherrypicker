# Review-plan-fix Cycle 11 — document specialist

- Date: 2026-07-24
- Reviewed revision: `5a8e636c0c66136ed3fff0396de226f77758a1bd`
- Branch: `codex/review-plan-fix-no-deploy-20260723`
- Disposition: **changes requested**
- Final count: **1 Medium finding**
- Scope: review and this report only; no source, test, generated artifact,
  staging, commit, push, deployment, browser, E2E, or external-system change

## Inventory and review method

I inventoried all **2,274 tracked paths** before reviewing claims: **1,113**
historical/current `.context` paths and **1,161** active product, data, test,
documentation, workflow, configuration, and vendor-integrity paths. The
current hand-written documentation surface comprises 28 Markdown files (the
root README, both `.claude` guides, the vendor policy, and 24 issuer READMEs)
plus the license. I also treated user-visible web copy, CLI/scraper help,
schema descriptions, source comments that define behavior, package scripts,
generated-document templates, and publication tests as documentation
contracts.

The review traced those claims through every workspace manifest and export
map, `bun.lock`, the workflow and build/compiler configuration, the canonical
card/category/issuer schemas, scraper trust and help contracts, catalog and
README generators, all generated catalog projections, web catalog loaders
and renderers, CLI/report commands, and their relevant tests. High-volume card
and generated data were checked through the owning schema/generator and
complete-corpus queries, with representative authored and published records
opened directly.

For duplicate control, I indexed the full `.context` ledger, then read the
current RPF documentation reports and aggregates, the Cycle 10 specialist
reports and Plans 122–124, the protected Cycle 42 material, and every
same-cycle report available before this report was written. The Cycle 10
model-authored official-link defect is fixed at this revision and is not
repeated below. The current finding concerns already-reviewed canonical
`manual`/`web` records and the meaning of their displayed label, not model
authority. The prior Cycle 2 multi-artifact publication-procedure finding was
also not relabeled from the remaining `build-json.ts` “single organized JSON”
comment. The rejected prefixed-XLSX inflation hypothesis was not revived.

## RPF11-DOC-001 — generic reviewed source links are labeled as issuer-official pages

- **Severity:** Medium
- **Confidence:** High
- **Status:** Confirmed; genuinely new user-facing copy/data-contract mismatch
- **User-facing claim:** `apps/web/src/components/cards/CardDetail.svelte:147,268-280`
- **Actual href contract:** `apps/web/src/lib/external-url.ts:1-10`;
  `packages/rules/src/security.ts:30-55`
- **Canonical provenance contract:** `packages/rules/src/schema.ts:262-285`;
  `packages/rules/__tests__/security.test.ts:105-145`;
  `scripts/__tests__/catalog-publication.test.ts:57-88`
- **Publication and browser reach:** `scripts/catalog-publication.ts:144-170,190-223`;
  `apps/web/src/lib/cards.ts:362-379`;
  `apps/web/public/data/card-details/kb.json:1`;
  `apps/web/public/data/card-details/lotte.json:1`;
  `apps/web/public/data/card-details/samsung.json:1`
- **Authoritative issuer identity:** `packages/rules/data/issuers.yaml:7-45`
- **Contradictory canonical records:**
  `packages/rules/data/cards/kb/need-edu.yaml:2-12`;
  `packages/rules/data/cards/lotte/loca-for-auto.yaml:2-12`;
  `packages/rules/data/cards/samsung/and-point.yaml:2-12`;
  `packages/rules/data/cards/ibk/ceo.yaml:2-12`

`CardDetail` calls the value `officialCardUrl` and renders every accepted
value with the label **“공식 카드 페이지”**. The actual last-mile guard proves
only that the value is an unchanged, credential-free absolute HTTP(S) URL. It
does not prove an issuer relationship or even require the host recorded for
that issuer in `issuers.yaml`.

The canonical schema similarly overloads `card.url` with two different
meanings. It blocks a non-empty URL while `source` remains `llm-scrape`, but
after the record is marked `manual` or `web` it accepts any syntactically safe
host. The contract tests make that distinction explicit: an
`https://attacker.example/phish` value is rejected for `llm-scrape` and
accepted unchanged for both reviewed provenance values. Publication then
retains the whole card in an issuer detail shard, and the browser loader
delivers it to the unconditional “official” label.

The checked-in reviewed corpus proves this is not a hypothetical extension
point:

```text
kb-need-edu          manual  https://www.financialpost.co.kr/news/articleView.html?...
lotte-loca-for-auto  manual  https://m.card-gorilla.com/card/detail/621
samsung-and-point    manual  https://www.banksalad.com/product/cards/CARD002508
ibk-ceo              manual  https://m.card-gorilla.com/card/detail/2339
```

In contrast, the repository's issuer registry names `card.kbcard.com`,
`lottecard.co.kr`, `samsungcard.com`, and `ibk.co.kr` as the corresponding
issuer websites. A conservative read-only corpus query limited to explicit
aggregator, news, and wiki hosts found **26** `manual` or `web` card URLs that
the current detail UI publishes under the issuer-official label. This count
deliberately excludes partner/co-brand hosts whose relationship could be
ambiguous without external research.

The exact conservative inventory is **25 `manual` records and one `web`
record**:

| Destination host | Count | Canonical issuer/card IDs |
|---|---:|---|
| `www.banksalad.com` | 15 | `ibk/ibk-chamjoheun-chingu`, `ibk/ibk-chamjoheun-chingu-check`, `ibk/ibk-daiso-chamjoheun`, `ibk/ibk-easy-cashback-check`, `ibk/ibk-i-gihoo-donghaeng-credit` (`web`), `ibk/ibk-oil-and-life`, `lotte/lotte-loca-for-health`, `nh/nh-byeoldajul`, `nh/nh-olbareun-hanaro`, `nh/nh-zgm-living`, `samsung/samsung-and-point`, `sc/sc-samsung-life`, `woori/woori-d4`, `woori/woori-damoa-discount-plus`, `woori/woori-new-woori-v` |
| `m.card-gorilla.com` | 5 | `ibk/ibk-ceo`, `jb/jb-1st-link-on`, `kdb/kdb-choice-hybrid`, `lotte/lotte-loca-for-auto`, `lotte/lotte-weekly-check` |
| `namu.wiki` | 2 | `bnk/bnk-cheongchun-check`, `bnk/bnk-daily1-check` |
| `www.etoday.co.kr` | 1 | `ibk/ibk-i-heroes-check` |
| `www.financialpost.co.kr` | 1 | `kb/kb-need-edu` |
| `www.hidomin.com` | 1 | `dgb/dgb-im-skypass-silver` |
| `www.industrynews.co.kr` | 1 | `kbank/kbank-alpha-youth-check` |

Concrete consequence: opening the checked-in KB NEED Edu card offers
“공식 카드 페이지,” but the href is a Financial Post news article. The Lotte,
Samsung, and IBK examples similarly lead to catalog aggregators. A user who
relies on the label to verify current terms or begin an application is sent
to a source that the repository itself does not identify as the issuer site.
Scheme safety and human review do not make that description true.

This is distinct from RPF10-SEC-001. Cycle 10 showed that an untrusted model
could choose the destination before review; Plan 122 correctly removed that
authority by deleting model-authored URLs and rejecting non-empty URLs while
`source` remains `llm-scrape`. Here every example begins after that fixed
boundary: all 26 are canonical `manual`/`web` records, and current contract
tests deliberately accept an arbitrary host for those provenance values.
The mismatch therefore remains because `source: manual|web` records how data
was curated, not whether `card.url` is issuer-official. Fixing it requires
field/label semantics or issuer-host binding, not another model-quarantine
repair.

**Root fix:**

1. Split provenance from destination semantics. Use an issuer-verified
   `officialUrl` only for issuer-controlled/approved destinations and retain
   non-issuer material in a separately labeled `sourceUrl` (or omit it from
   the product UI).
2. Migrate the current third-party records and render neutral copy such as
   “상품 정보 출처” for source links. Show the destination host so users can
   distinguish issuer and non-issuer pages before navigating.
3. Derive the issuer-official host policy from the canonical issuer registry
   (with explicit reviewed aliases where necessary), validate it during
   publication, and add a complete-corpus test. Do not treat scraper
   `--allow-host` permission as proof that a host is official.
4. Add component/contract tests proving a source URL can never receive the
   “공식 카드 페이지” label and an official URL cannot be published without
   issuer-bound provenance.

## Verification and final missed-document sweep

The following non-browser checks passed at the reviewed revision:

```text
bun run docs:check
Verified README catalog: 683 cards (551 optimizer-executable) across 24 issuers.

bun scripts/build-json.ts --check
683 card YAML files parsed; generated catalog artifacts current.

bun run toolchain:check
Bun 1.3.12
```

Rendered root, analyze, optimize, report, and scraper help agreed with their
parsers and defaults. A read-only local-link sweep of the 28 current Markdown
documents found zero missing local targets. Repository-authoritative
manifests/configuration also reconciled the documented Astro 7, Svelte 5,
Tailwind CSS 4, TypeScript 5.9, Bun 1.3.12, `claude-sonnet-5`, static GitHub
Pages, supported statement formats, scraper issuer list, and verification
commands. Generated issuer counts, optimizer eligibility, mileage exclusion
copy, annual-fee disclosure, remote-LLM consent, and scraper quarantine
language matched current code and tests.

The final sweep rechecked all issuer hand-written sections, schema examples,
generated markers/counts/links, package and workflow claims, environment
variables, command examples, user-facing upload/dashboard/card-detail/report
copy, publication ownership, and archived findings. No second genuinely new
documentation mismatch met the evidence threshold.

No browser/E2E run, external lookup, product source/test/plan/generated edit,
staging, commit, push, or deployment was performed.
