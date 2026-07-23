# Vendored runtime archives

`xlsx-0.20.3.tgz` is the exact SheetJS archive used by the browser and parser
workspaces. SheetJS recommends vendoring this archive for stable installs:

- <https://docs.sheetjs.com/docs/getting-started/installation/nodejs/>
- <https://docs.sheetjs.com/docs/getting-started/installation/bun/>

Run `bun run dependencies:check` before installing or updating dependencies.
The gate verifies the committed SHA-256 and SHA-512 digests, rejects remote
package URLs in workspace manifests and `bun.lock`, and checks production
imports against each workspace's direct dependencies.
