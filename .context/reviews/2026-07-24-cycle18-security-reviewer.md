# Cycle 18 Security Review

## Result

No current-HEAD, reproducible, history-novel security or data-integrity finding was identified.

- Review target: `c182c8144a4284bae1f28f009a5b0930d7762d5c`
- Novel finding count: **0**
- Severity/status: not applicable; no issue is being handed off for remediation
- Confidence: **high** for the Cycle 17 delta and **medium-high** for the whole-tree negative result
- Review mode: defensive static inspection only; no exploit payloads, dynamic probes, network requests, test execution, or source/configuration changes

## Scope and inventory

The tracked tree contains 2,394 files: 1,222 tracked `.context` files and 1,172 active files. The active inventory was covered as follows:

| Surface | Tracked files | Security relevance reviewed |
| --- | ---: | --- |
| `.github/` | 1 | workflow permissions, action pinning, artifact/deployment trust |
| `apps/web/` | 172 | upload admission, browser workers, persistence, rendering, external URLs, framing, CSP, catalog fetches |
| `packages/core/` | 47 | analysis trust boundaries, date/value validation, resource behavior |
| `packages/parser/` | 86 | file detection, CSV/OFX/XLSX/PDF handling, archive and worksheet bounds, diagnostics |
| `packages/rules/` | 734 | authored/generated catalog integrity, schema validation, untrusted labels and identifiers |
| `packages/viz/` | 14 | presentation of analysis values and browser-safe rendering |
| `tools/cli/` | 28 | arguments, local/remote parsing consent, terminal output, report generation, filesystem output |
| `tools/scraper/` | 35 | credentials, URL/DNS policy, redirects, model-input isolation, response validation, safe publication |
| `scripts/` | 21 | source generation, dependency/toolchain checks, migrations, E2E process ownership |
| `e2e/` | 16 | browser security regressions and isolation coverage |
| `vendor/` | 3 | vendored dependency provenance and digest checks |
| root/configuration | 15 | lockfile, manifests, test/build configuration, repository policy |

The final sink inventory found one production raw-HTML site, `apps/web/src/components/ui/Icon.svelte`, whose input is the repository-owned icon table. Network/process sites were confined to same-origin catalog reads, the scraper/remote-PDF boundary, and developer tooling. Persistence and write sites were confined to the documented browser store, build scripts, report output, scraper publication, and E2E ownership records.

## Delta review

The complete 35-file delta from the Cycle 16 security baseline `857e12a794e585560a0c447b0a1619def02cbcf3` was inspected.

- `scripts/category-label-publication.ts` now serializes category-label values with `JSON.stringify` and escapes JavaScript line separators before assembling generated TypeScript. This closes the Cycle 17 source-generation injection root without introducing another evaluation sink.
- `scripts/catalog-publication.ts`, `scripts/build-json.ts`, and the regenerated card/catalog outputs add legacy comparison grouping and preserve schema-controlled identifiers/value kinds. No new executable interpretation, external input, or path derivation was introduced.
- `packages/core/src/analysis/context.ts` reuses validated transaction months. The change is computational and does not weaken date validation or create a new trust boundary.
- `scripts/check-dependencies.ts`, `apps/web/package.json`, and `bun.lock` enforce test dependency ownership without adding an unpinned source or runtime capability.
- The remaining delta consists of regression tests, plans, and review records.

## Whole-tree defensive sweep

- **Injection and unsafe interpretation:** checked raw HTML, code generation, regex/markup normalization, shell/process construction, terminal output, report templates, and model prompts. Browser values remain escaped; generated category source is serialized; CLI/scraper subprocess arguments are fixed programmatic arrays; report and terminal paths retain escaping/sanitization.
- **Secrets and privacy:** no live private-key or common token marker was found in tracked non-history content. Matches were synthetic scraper test fixtures. Runtime model credentials remain environment-only and are not written by the scraper. Plaintext analysis persistence in `sessionStorage` remains a documented historical/deferred privacy limitation, not a Cycle 18 novelty.
- **Authentication/authorization:** the static web application has no account, server session, database, or multi-user authorization boundary. The material authorization decision is remote PDF processing: it remains disabled by default and requires explicit mode/consent with content-hash binding.
- **File and network handling:** reviewed parser file opens, CLI report publication, scraper writes, local/remote PDF flow, and scraper URL/DNS/redirect handling. Existing no-follow/exclusive/atomic write controls, trusted-directory checks, public-address enforcement, connected-address verification, redirect revalidation, response limits, and schema validation remain in place.
- **Resource exhaustion:** browser admission limits, worker termination, bounded diagnostics, XLSX archive preflight, worksheet metadata/cell limits, scraper response/deadline limits, and persistence caps remain present. Previously recorded whole-file CLI parsing and PDF input/prompt bounds are historical limitations rather than new roots.
- **Browser isolation:** framing guard, CSP posture, same-origin catalog loading, safe external-link validation, worker protocol validation, and the repository-owned icon HTML sink were reviewed. The static-hosting CSP/inline-script tradeoff is already documented.
- **CI and dependency trust:** deployment uses least-privilege job permissions, immutable action revisions, disabled checkout credential persistence, a frozen lockfile, verification gates, and a separate Pages deployment job. Registry/workspace/vendored sources remain policy-checked.
- **Data integrity:** card/category generated outputs, runtime catalog validation, persistence coherence checks, forbidden prototype keys, source hashes, and scraper quarantine/publication validation were reviewed. No path from untrusted authored text to executable source remains in the Cycle 17 repair.

## History and novelty check

All 1,222 tracked current and archived `.context` files were included in the history corpus; its aggregate SHA-256 digest during review was `f9396ce22ec4a644a27aed91418e528e703797f28f8f0c912265539ef449e268`. Candidate-root searches were cross-checked against the full corpus, including `.context/plans/00-deferred-items.md` and `.context/reviews/2026-07-24-rpf-cycle17-security-reviewer.md`. The tracked HEAD archive digest was `fdf53773ced3130f8d49602aabee60b4de7700b1443ba9afda7d81fd3505977c`.

Known roots encountered during the missed-issue sweep—plaintext session persistence, static-host CSP constraints, regex-based HTML normalization, bounded-but-whole-file parsing, PDF prompt/input limits, E2E cleanup ownership, prior XLSX archive/worksheet exhaustion, report/output races, scraper SSRF, and category-label source serialization—were already owned, fixed, accepted, or deferred in history. None was relabeled as novel.

The six protected untracked Cycle 42 artifacts were excluded by exact path and were neither opened nor modified.

## Missed-issue sweep conclusion

The closing pass rechecked the complete Cycle 17 delta plus every identified execution, rendering, storage, file, network, process, credential, browser-isolation, CI, and generated-data boundary. No additional current-HEAD root survived reproducibility and full-history novelty checks. There is therefore no severity-ranked finding, failure scenario, or root-fix recommendation to transfer from this role.
