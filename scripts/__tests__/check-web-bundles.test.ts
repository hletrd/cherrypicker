import { describe, expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  catalogArtifactBudgetFailures,
  catalogLoaderSourceFailures,
  dynamicImportSpecifiers,
  initialScriptUrls,
  parserChunkFailures,
  parserSourceFailures,
  staticImportSpecifiers,
} from '../check-web-bundles.js';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

describe('web bundle graph parsing', () => {
  test('collects external and Astro island entry scripts once', () => {
    expect(
      initialScriptUrls(`
        <script src="/cherrypicker/scripts/layout.js"></script>
        <astro-island
          component-url="/cherrypicker/_astro/FileDropzone.hash.js"
          renderer-url="/cherrypicker/_astro/client.hash.js"
        ></astro-island>
        <script src="/cherrypicker/scripts/layout.js"></script>
      `),
    ).toEqual([
      '/cherrypicker/_astro/FileDropzone.hash.js',
      '/cherrypicker/_astro/client.hash.js',
      '/cherrypicker/scripts/layout.js',
    ]);
  });

  test('follows static imports but excludes dynamic imports', () => {
    expect(
      staticImportSpecifiers(`
        import { start } from "./runtime.js";
        export { helper } from "./helper.js";
        import "./side-effect.js";
        const analyzer = import("./analyzer.js");
      `),
    ).toEqual(['./runtime.js', './helper.js', './side-effect.js']);
  });

  test('collects literal dynamic imports in source order', () => {
    expect(
      dynamicImportSpecifiers(`
        const csv = import("./csv.js");
        const ignored = import(variable);
        const pdf = import( './pdf.js' );
        const html = import(\`./html.js\`);
      `),
    ).toEqual(['./csv.js', './pdf.js', './html.js']);
  });
});

describe('format parser isolation', () => {
  const isolatedDispatcher = `
    switch (format) {
      case 'csv': { await import('./csv.js'); break; }
      case 'xlsx': { await import('./xlsx.js'); break; }
      case 'pdf': { await import('./pdf.js'); break; }
      case 'json': { await import('./json.js'); break; }
      case 'ofx': { await import('./ofx.js'); break; }
      case 'html': { await import('./html.js'); break; }
      default: { break; }
    }
  `;

  test('locks the production dispatcher to one selected concrete import', async () => {
    const source = await readFile(
      resolve(repoRoot, 'apps/web/src/lib/parser/index.ts'),
      'utf8',
    );
    expect(parserSourceFailures(source)).toEqual([]);
  });

  test('rejects an eager re-export and a cross-format case import', () => {
    const source = isolatedDispatcher
      .replace(
        "case 'csv': { await import('./csv.js'); break; }",
        "case 'csv': { await import('./csv.js'); await import('./pdf.js'); break; }",
      )
      .concat("\nexport { parseXLSX } from './xlsx.js';");

    expect(parserSourceFailures(source)).toEqual(
      expect.arrayContaining([
        'parser dispatcher eagerly imports or re-exports: ./xlsx.js',
        'csv case must import only ./csv.js; found ./csv.js, ./pdf.js',
        './pdf.js must have exactly one dispatcher import; found 2',
      ]),
    );
  });

  test('requires six distinct deferred chunks with no sibling reachability', () => {
    const chunks = new Map([
      [
        'analyzer.hash.js',
        `
          import("./csv.a.js");
          import("./xlsx.b.js");
          import("./pdf.c.js");
          import("./json.d.js");
          import("./ofx.e.js");
          import("./html.f.js");
        `,
      ],
      ['csv.a.js', 'import "./shared.g.js";'],
      ['xlsx.b.js', ''],
      ['pdf.c.js', ''],
      ['json.d.js', ''],
      ['ofx.e.js', ''],
      ['html.f.js', ''],
      ['shared.g.js', ''],
    ]);

    expect(parserChunkFailures(chunks)).toEqual([]);
    chunks.set('shared.g.js', 'import "./pdf.c.js";');
    expect(parserChunkFailures(chunks)).toContain(
      'csv parser chunk eagerly reaches pdf parser chunk',
    );
  });
});

describe('catalog artifact isolation and budgets', () => {
  test('locks production consumers to split catalog artifacts', async () => {
    const [cardsSource, analyzerSource] = await Promise.all([
      readFile(resolve(repoRoot, 'apps/web/src/lib/cards.ts'), 'utf8'),
      readFile(resolve(repoRoot, 'apps/web/src/lib/analyzer.ts'), 'utf8'),
    ]);
    expect(catalogLoaderSourceFailures(cardsSource, analyzerSource)).toEqual([]);
  });

  test('rejects a legacy request and retained optimizer transformation', () => {
    expect(
      catalogLoaderSourceFailures(
        `fetch('data/cards.json')`,
        `const cachedCoreRules = toCoreCardRuleSets(rules)`,
      ),
    ).toEqual(
      expect.arrayContaining([
        'browser loader still requests legacy data/cards.json',
        'analyzer does not consume the optimizer artifact loader',
        'analyzer still copies or separately caches the optimizer catalog',
      ]),
    );
  });

  test('enforces raw artifact ratios and per-shard limits', () => {
    const failures = catalogArtifactBudgetFailures({
      legacyRawBytes: 100,
      summary: new Uint8Array(250 * 1024 + 1),
      optimizer: new Uint8Array(66),
      detailShards: new Map([
        ['large.json', new Uint8Array(256 * 1024 + 1)],
      ]),
    });

    expect(failures).toEqual(
      expect.arrayContaining([
        expect.stringContaining('cards-summary.json is 250.0 KiB raw'),
        expect.stringContaining('cards-optimizer.json is 66.0%'),
        expect.stringContaining('large.json is 256.0 KiB raw'),
      ]),
    );
  });

  test('accepts compact artifacts within every limit', () => {
    expect(
      catalogArtifactBudgetFailures({
        legacyRawBytes: 1_000,
        summary: new Uint8Array(100),
        optimizer: new Uint8Array(600),
        detailShards: new Map([['issuer.json', new Uint8Array(100)]]),
      }),
    ).toEqual([]);
  });
});
