# Dependency / Tooling Review

**Overall verdict: REQUEST CHANGES**

The repo is not reproducible from manifests alone, several dependencies are pinned to different majors/sources across workspaces, and the static web app still depends on remote CDNs at runtime. The result is a brittle release path with multiple ways for installs and deployments to silently drift.

## High severity

- **TypeScript declared vs locked version is out of sync**  
  `package.json:21-27`, `apps/web/package.json:26-29`, `packages/*/package.json:15-18`, `tools/*/package.json:17-21`, `bun.lock:1216`  
  Every workspace declares `typescript: ^6.0.0`, but the lockfile still resolves `typescript@5.9.3`. That means a clean install is not honoring the declared dependency set, and toolchain behavior can differ from what the manifests say. This is a release-blocking reproducibility problem.  
  **Fix:** align the manifests to an actually supported TS release, regenerate the lockfile, and fail CI on lockfile drift.

- **Zod is split across majors and validation semantics differ between build-time and runtime paths**  
  `package.json:21-27`, `packages/rules/package.json:11-18`, `packages/rules/src/schema.ts:1-95`, `scripts/build-json.ts:19-75`, `bun.lock:1342`, `bun.lock:1350`  
  The root workspace uses `zod@4.3.6`, `@cherrypicker/rules` pins `zod@^3.24.0`, and the lockfile shows a nested `zod@3.25.76` just for that package. Worse, `scripts/build-json.ts` defines a relaxed schema with defaults/stripping that is not the same as the stricter runtime schema in `packages/rules/src/schema.ts`. A card YAML file can therefore pass one path and fail another.  
  **Fix:** use one Zod major across the repo and make the generator and runtime loaders share the same schema module.

- **XLSX parsing is split across different package versions and sources**  
  `packages/parser/package.json:11-20`, `apps/web/package.json:16-24`, `bun.lock:1322`, `packages/parser/src/xlsx/index.ts:1-250`, `apps/web/src/lib/parser/xlsx.ts:1-415`  
  The CLI/parser package pulls `xlsx` from a SheetJS CDN tarball (`0.20.3`), while the web app uses npm `xlsx@^0.18.5`. That is both a supply-chain and behavior drift risk: the same statement can parse differently in the browser and in the CLI, and installs now depend on an external tarball host.  
  **Fix:** pick one vetted SheetJS source/version for both surfaces, and avoid mixing CDN tarballs with registry packages unless you mirror and pin them deliberately.

- **The static web app depends on remote CDNs at runtime**  
  `apps/web/src/lib/categorizer-ai.ts:68-87`, `apps/web/src/lib/parser/pdf.ts:224-230`, `apps/web/src/layouts/Layout.astro:38`  
  The browser app dynamically imports Transformers.js from jsDelivr, and the PDF parser loads the pdf.js worker from cdnjs. The CSP explicitly whitelists these hosts. This means the GitHub Pages deployment is not self-contained: offline use, CSP tightening, CDN outages, or upstream asset changes can break core features.  
  **Fix:** self-host or bundle these assets if the project wants a reproducible static deployment.

## Medium severity

- **`lint` is advertised but no workspace actually implements it**  
  `package.json:9-19`, `apps/web/package.json:6-10`, `packages/core/package.json:7-10`, `packages/parser/package.json:7-10`, `packages/rules/package.json:7-10`, `packages/viz/package.json:7-10`, `tools/cli/package.json:9-12`, `tools/scraper/package.json:6-9`  
  The root `lint` script calls `turbo run lint`, but none of the workspace manifests define a `lint` command. I verified with Turbo dry-run that every package resolves to `Command = <NONEXISTENT>`. That makes the repo’s quality gate unusable and gives a false impression that linting exists.  
  **Fix:** either add actual lint scripts to each package or remove the root lint entry until it is real.

- **Generated artifacts are committed in multiple places, and CI never regenerates them**  
  `.gitignore:1-10`, `scripts/build-json.ts:323-389`, `packages/rules/data/cards.json:1-6`, `packages/rules/data/cards-compact.json:1-6`, `apps/web/public/data/cards.json:1-6`, `apps/web/public/data/categories.json:1-6`, `packages/core/dist/index.js:1-12`, `tools/cli/dist/index.js:1-40`, `apps/web/.astro/types.d.ts:1-2`  
  The repo keeps build outputs, `.astro` generated types, and generated JSON snapshots under version control. `scripts/build-json.ts` also embeds `generatedAt`, so re-running it produces noisy diffs even when the underlying cards do not change. The GitHub Actions workflow does not run this generator; it assumes the committed JSON copies are current. That makes stale-data regressions easy to ship and hard to notice.  
  **Fix:** either stop committing generated outputs or make generation a required, deterministic CI step.

- **The web layout silently hides missing/stale card data**  
  `apps/web/src/layouts/Layout.astro:14-24`, `apps/web/src/pages/index.astro:7-16`  
  Both pages swallow file-read failures and fall back to hardcoded counts. If the generated JSON goes missing or stale, the site still builds and simply shows wrong totals. That masks the very drift the release pipeline should catch.  
  **Fix:** fail the build loudly when the data file is missing or incompatible.

- **The browser and CLI XLSX parsers are already diverging**  
  `packages/parser/src/xlsx/adapters/index.ts:12-170`, `apps/web/src/lib/parser/xlsx.ts:18-173`, `packages/parser/src/xlsx/index.ts:230-249`, `apps/web/src/lib/parser/xlsx.ts:230-237`  
  The repo now maintains two large, nearly duplicated XLSX parsers. They already disagree on bank column mappings and amount handling, so bug fixes will keep landing in one place and not the other. This is a maintainability and release-consistency risk, especially because the browser and CLI also use different SheetJS versions.  
  **Fix:** consolidate the shared parsing logic into one source of truth and keep environment-specific wrappers thin.

- **Bun-only and external-API assumptions are not surfaced early**  
  `package.json:11-19`, `tools/cli/src/commands/scrape.ts:51-65`, `tools/scraper/src/cli.ts:1-8`, `packages/parser/src/pdf/llm-fallback.ts:33-46`  
  The workspace assumes Bun for almost every entrypoint, and the CLI explicitly shells out to `bun` by name. The scraper and PDF fallback also require live Anthropic credentials. These assumptions are workable in a Bun-centric dev environment, but they are not validated up front and will fail late on machines without Bun or the required env vars.  
  **Fix:** document the runtime contract explicitly, validate required env vars early, and avoid shelling out to a hard-coded `bun` binary when a local module call would do.

## Build/release fragility

- The GitHub Actions workflow pins `bun-version: latest` and then runs `npx astro build` instead of the repo’s Bun-native build path. That is two moving targets at once: the Bun version floats, and the build command can escape the Bun lockfile’s resolution model.  
  `.github/workflows/deploy.yml:23-36`, `package.json:27`

- The release workflow never runs `scripts/build-json.ts`, so the deploy step depends on checked-in JSON artifacts instead of the YAML source of truth. That is the main reason data drift can ship unnoticed.  
  `scripts/build-json.ts:340-389`, `.github/workflows/deploy.yml:31-42`, `README.md:116-128`

- The project mixes source entrypoints (`main: src/index.ts`, `bin: src/index.ts`) with committed `dist/` outputs. There is no single “release artifact” boundary, which makes it unclear what should be trusted in CI, in local dev, or in a published package.  
  `packages/core/package.json:1-18`, `packages/parser/package.json:1-21`, `packages/rules/package.json:1-18`, `packages/viz/package.json:1-20`, `tools/cli/package.json:1-23`, `tools/scraper/package.json:1-20`

## Priority fix order

1. Regenerate and reconcile the lockfile/toolchain versions (`typescript`, `zod`, `xlsx`).
2. Unify the schema and parsing stacks so browser/CLI behavior cannot drift.
3. Move remote runtime assets off third-party CDNs or explicitly accept the external-dependency risk.
4. Make generated JSON part of CI or stop committing it.
5. Repair or remove the root `lint` command.

