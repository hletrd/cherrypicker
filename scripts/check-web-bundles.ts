import { gzipSync } from 'node:zlib';
import { readFile, readdir, stat } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const INITIAL_JS_RAW_BUDGET = 400 * 1024;
const INITIAL_JS_GZIP_BUDGET = 150 * 1024;
const COMPACT_CATALOG_RATIO_BUDGET = 0.65;
const SUMMARY_RAW_BUDGET = 250 * 1024;
const SUMMARY_GZIP_BUDGET = 60 * 1024;
const OPTIMIZER_CATALOG_RATIO_BUDGET = 0.65;
const DETAIL_SHARD_RAW_BUDGET = 256 * 1024;
const DETAIL_SHARD_GZIP_BUDGET = 32 * 1024;
const BASE_PATH = '/cherrypicker/';
const PARSER_FORMATS = ['csv', 'xlsx', 'pdf', 'json', 'ofx', 'html'] as const;

export function initialScriptUrls(html: string): string[] {
  const urls = new Set<string>();
  for (const match of html.matchAll(
    /(?:src|component-url|renderer-url|before-hydration-url)="([^"]+\.js)"/g,
  )) {
    urls.add(match[1]!);
  }
  return [...urls].sort();
}

export function staticImportSpecifiers(source: string): string[] {
  const specifiers = new Set<string>();
  for (const match of source.matchAll(
    /\b(?:import|export)[^"'()]*?\bfrom\s*["']([^"']+)["']/g,
  )) {
    specifiers.add(match[1]!);
  }
  for (const match of source.matchAll(/\bimport\s*["']([^"']+)["']/g)) {
    specifiers.add(match[1]!);
  }
  return [...specifiers];
}

export function dynamicImportSpecifiers(source: string): string[] {
  const specifiers: string[] = [];
  for (const match of source.matchAll(
    /\bimport\s*\(\s*["']([^"']+)["']\s*\)/g,
  )) {
    specifiers.push(match[1]!);
  }
  return specifiers;
}

function parserSpecifier(format: (typeof PARSER_FORMATS)[number]): string {
  return `./${format}.js`;
}

export function parserSourceFailures(source: string): string[] {
  const failures: string[] = [];
  const concreteSpecifiers = new Set(PARSER_FORMATS.map(parserSpecifier));
  const eagerConcrete = staticImportSpecifiers(source).filter((specifier) =>
    concreteSpecifiers.has(specifier as ReturnType<typeof parserSpecifier>),
  );
  if (eagerConcrete.length > 0) {
    failures.push(
      `parser dispatcher eagerly imports or re-exports: ${eagerConcrete.join(', ')}`,
    );
  }

  const allDynamic = dynamicImportSpecifiers(source);
  for (const format of PARSER_FORMATS) {
    const caseStart = new RegExp(`case\\s+['"]${format}['"]\\s*:\\s*\\{`).exec(source);
    if (!caseStart || caseStart.index === undefined) {
      failures.push(`parser dispatcher has no ${format} case`);
      continue;
    }

    const bodyStart = caseStart.index + caseStart[0].length;
    const remainder = source.slice(bodyStart);
    const nextCase = /\n\s*(?:case\s+['"]|default\s*:)/.exec(remainder);
    const body = nextCase ? remainder.slice(0, nextCase.index) : remainder;
    const imports = dynamicImportSpecifiers(body);
    const expected = parserSpecifier(format);
    if (imports.length !== 1 || imports[0] !== expected) {
      failures.push(
        `${format} case must import only ${expected}; found ${imports.join(', ') || 'none'}`,
      );
    }

    const total = allDynamic.filter((specifier) => specifier === expected).length;
    if (total !== 1) {
      failures.push(
        `${expected} must have exactly one dispatcher import; found ${total}`,
      );
    }
  }

  return failures;
}

function builtAssetName(importer: string, specifier: string): string | null {
  if (!specifier.startsWith('.')) return null;
  return relative('/', resolve('/', dirname(importer), specifier));
}

export function parserChunkFailures(chunks: ReadonlyMap<string, string>): string[] {
  const candidates: Array<{
    chunk: string;
    entries: Map<(typeof PARSER_FORMATS)[number], string>;
  }> = [];

  for (const [chunk, source] of chunks) {
    const imports = dynamicImportSpecifiers(source);
    const entries = new Map<(typeof PARSER_FORMATS)[number], string>();
    for (const format of PARSER_FORMATS) {
      const matches = imports.filter((specifier) =>
        new RegExp(`(?:^|/)${format}\\.[^/]+\\.js$`).test(specifier),
      );
      if (matches.length === 1) entries.set(format, matches[0]!);
    }
    if (entries.size === PARSER_FORMATS.length) candidates.push({ chunk, entries });
  }

  if (candidates.length !== 1) {
    return [
      `expected one built parser dispatcher with six deferred entries; found ${candidates.length}`,
    ];
  }

  const [{ chunk: dispatcher, entries }] = candidates;
  const targets = new Map<string, string>();
  const failures: string[] = [];
  for (const [format, specifier] of entries) {
    const target = builtAssetName(dispatcher, specifier);
    if (!target || !chunks.has(target)) {
      failures.push(`${format} parser chunk is missing: ${specifier}`);
      continue;
    }
    targets.set(format, target);
  }

  if (new Set(targets.values()).size !== PARSER_FORMATS.length) {
    failures.push('concrete parser imports do not resolve to six distinct chunks');
  }

  for (const [format, entry] of targets) {
    const visited = new Set<string>();
    const queue = [entry];
    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);
      const source = chunks.get(current);
      if (source === undefined) continue;
      for (const specifier of staticImportSpecifiers(source)) {
        const dependency = builtAssetName(current, specifier);
        if (dependency && chunks.has(dependency)) queue.push(dependency);
      }
    }

    for (const [otherFormat, otherEntry] of targets) {
      if (otherFormat !== format && visited.has(otherEntry)) {
        failures.push(
          `${format} parser chunk eagerly reaches ${otherFormat} parser chunk`,
        );
      }
    }
  }

  return failures;
}

export function catalogLoaderSourceFailures(
  cardsSource: string,
  analyzerSource: string,
): string[] {
  const failures: string[] = [];
  if (/data\/cards\.json/.test(cardsSource)) {
    failures.push('browser loader still requests legacy data/cards.json');
  }
  for (const endpoint of [
    'data/cards-summary.json',
    'data/cards-optimizer.json',
    'data/card-details/',
  ]) {
    if (!cardsSource.includes(endpoint)) {
      failures.push(`browser loader does not reference ${endpoint}`);
    }
  }
  if (!analyzerSource.includes('loadOptimizerCatalog')) {
    failures.push('analyzer does not consume the optimizer artifact loader');
  }
  if (
    analyzerSource.includes('toCoreCardRuleSets') ||
    analyzerSource.includes('cachedCoreRules')
  ) {
    failures.push('analyzer still copies or separately caches the optimizer catalog');
  }
  return failures;
}

export interface CatalogArtifactBudgetInput {
  legacyRawBytes: number;
  summary: Uint8Array;
  optimizer: Uint8Array;
  detailShards: ReadonlyMap<string, Uint8Array>;
}

export function catalogArtifactBudgetFailures(
  input: CatalogArtifactBudgetInput,
): string[] {
  const failures: string[] = [];
  const summaryGzipBytes = gzipSync(input.summary, { level: 9 }).length;
  const optimizerRatio = input.optimizer.byteLength / input.legacyRawBytes;

  if (input.summary.byteLength > SUMMARY_RAW_BUDGET) {
    failures.push(
      `cards-summary.json is ${formatKiB(input.summary.byteLength)} raw; budget is ${formatKiB(SUMMARY_RAW_BUDGET)}`,
    );
  }
  if (summaryGzipBytes > SUMMARY_GZIP_BUDGET) {
    failures.push(
      `cards-summary.json is ${formatKiB(summaryGzipBytes)} gzip; budget is ${formatKiB(SUMMARY_GZIP_BUDGET)}`,
    );
  }
  if (optimizerRatio > OPTIMIZER_CATALOG_RATIO_BUDGET) {
    failures.push(
      `cards-optimizer.json is ${(optimizerRatio * 100).toFixed(1)}% of cards.json; budget is ${OPTIMIZER_CATALOG_RATIO_BUDGET * 100}%`,
    );
  }

  for (const [name, shard] of input.detailShards) {
    if (shard.byteLength > DETAIL_SHARD_RAW_BUDGET) {
      failures.push(
        `${name} is ${formatKiB(shard.byteLength)} raw; detail-shard budget is ${formatKiB(DETAIL_SHARD_RAW_BUDGET)}`,
      );
    }
    const gzipBytes = gzipSync(shard, { level: 9 }).length;
    if (gzipBytes > DETAIL_SHARD_GZIP_BUDGET) {
      failures.push(
        `${name} is ${formatKiB(gzipBytes)} gzip; detail-shard budget is ${formatKiB(DETAIL_SHARD_GZIP_BUDGET)}`,
      );
    }
  }
  return failures;
}

function within(parent: string, candidate: string): boolean {
  const path = relative(parent, candidate);
  return path === '' || (!path.startsWith('..') && !isAbsolute(path));
}

function assetPath(distDir: string, url: string, importer?: string): string {
  const withoutQuery = url.split(/[?#]/, 1)[0]!;
  if (withoutQuery.startsWith(BASE_PATH)) {
    return resolve(distDir, withoutQuery.slice(BASE_PATH.length));
  }
  if (withoutQuery.startsWith('/')) {
    throw new Error(`Unexpected built asset outside ${BASE_PATH}: ${url}`);
  }
  if (!importer) {
    throw new Error(`Relative entry asset has no importer: ${url}`);
  }
  return resolve(dirname(importer), withoutQuery);
}

async function collectInitialGraph(
  distDir: string,
  entryUrls: string[],
): Promise<Map<string, Buffer>> {
  const graph = new Map<string, Buffer>();
  const queue = entryUrls.map((url) => assetPath(distDir, url));

  while (queue.length > 0) {
    const path = queue.shift()!;
    if (graph.has(path)) continue;
    if (!within(distDir, path)) {
      throw new Error(`Built JS dependency escapes dist: ${path}`);
    }
    const contents = await readFile(path);
    graph.set(path, contents);
    for (const specifier of staticImportSpecifiers(contents.toString('utf8'))) {
      if (!specifier.endsWith('.js')) continue;
      queue.push(assetPath(distDir, specifier, path));
    }
  }
  return graph;
}

function formatKiB(bytes: number): string {
  return `${(bytes / 1024).toFixed(1)} KiB`;
}

async function main(): Promise<void> {
  const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const distDir = resolve(repoRoot, 'apps/web/dist');
  const html = await readFile(resolve(distDir, 'index.html'), 'utf8');
  const graph = await collectInitialGraph(distDir, initialScriptUrls(html));
  const parserSource = await readFile(
    resolve(repoRoot, 'apps/web/src/lib/parser/index.ts'),
    'utf8',
  );
  const cardsSource = await readFile(
    resolve(repoRoot, 'apps/web/src/lib/cards.ts'),
    'utf8',
  );
  const analyzerSource = await readFile(
    resolve(repoRoot, 'apps/web/src/lib/analyzer.ts'),
    'utf8',
  );
  const assetDir = resolve(distDir, '_astro');
  const chunkNames = (await readdir(assetDir))
    .filter((name) => name.endsWith('.js'))
    .sort();
  const chunks = new Map(
    await Promise.all(
      chunkNames.map(async (name) => [
        name,
        await readFile(resolve(assetDir, name), 'utf8'),
      ] as const),
    ),
  );

  const inlineScripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)]
    .map((match) => Buffer.from(match[1] ?? '', 'utf8'))
    .filter((contents) => contents.length > 0);
  const scripts = [...graph.values(), ...inlineScripts];
  const rawBytes = scripts.reduce((sum, contents) => sum + contents.length, 0);
  const gzipBytes = scripts.reduce(
    (sum, contents) => sum + gzipSync(contents, { level: 9 }).length,
    0,
  );

  const forbiddenInitialChunks = [...graph.keys()].filter((path) =>
    /(?:^|[._/-])(pdf|xlsx|ofx|html|json)(?:[._/-]|$)/i.test(path),
  );
  const failures: string[] = [];
  failures.push(
    ...parserSourceFailures(parserSource).map((failure) => `source: ${failure}`),
    ...parserChunkFailures(chunks).map((failure) => `bundle: ${failure}`),
    ...catalogLoaderSourceFailures(cardsSource, analyzerSource).map(
      (failure) => `catalog source: ${failure}`,
    ),
  );
  if (rawBytes > INITIAL_JS_RAW_BUDGET) {
    failures.push(
      `home initial JS is ${formatKiB(rawBytes)}; budget is ${formatKiB(INITIAL_JS_RAW_BUDGET)}`,
    );
  }
  if (gzipBytes > INITIAL_JS_GZIP_BUDGET) {
    failures.push(
      `home initial JS gzip is ${formatKiB(gzipBytes)}; budget is ${formatKiB(INITIAL_JS_GZIP_BUDGET)}`,
    );
  }
  if (forbiddenInitialChunks.length > 0) {
    failures.push(
      `home initial graph eagerly includes format parser chunks: ${forbiddenInitialChunks
        .map((path) => relative(distDir, path))
        .join(', ')}`,
    );
  }

  const legacyCatalog = await stat(resolve(repoRoot, 'packages/rules/data/cards.json'));
  const compactCatalog = await stat(
    resolve(repoRoot, 'packages/rules/data/cards-compact.json'),
  );
  const compactRatio = compactCatalog.size / legacyCatalog.size;
  if (compactRatio > COMPACT_CATALOG_RATIO_BUDGET) {
    failures.push(
      `compact catalog is ${(compactRatio * 100).toFixed(1)}% of cards.json; budget is ${COMPACT_CATALOG_RATIO_BUDGET * 100}%`,
    );
  }

  const publicDataDir = resolve(repoRoot, 'apps/web/public/data');
  const detailDir = resolve(publicDataDir, 'card-details');
  const detailNames = (await readdir(detailDir))
    .filter((name) => name.endsWith('.json'))
    .sort();
  const summary = await readFile(resolve(publicDataDir, 'cards-summary.json'));
  const optimizer = await readFile(resolve(publicDataDir, 'cards-optimizer.json'));
  const detailShards = new Map(
    await Promise.all(
      detailNames.map(async (name) => [
        name,
        await readFile(resolve(detailDir, name)),
      ] as const),
    ),
  );
  failures.push(
    ...catalogArtifactBudgetFailures({
      legacyRawBytes: legacyCatalog.size,
      summary,
      optimizer,
      detailShards,
    }),
  );
  const summaryGzipBytes = gzipSync(summary, { level: 9 }).length;
  const optimizerRatio = optimizer.length / legacyCatalog.size;
  const largestDetail = [...detailShards]
    .map(([name, contents]) => ({
      name,
      raw: contents.length,
      gzip: gzipSync(contents, { level: 9 }).length,
    }))
    .sort((a, b) => b.raw - a.raw || a.name.localeCompare(b.name))[0];

  if (failures.length > 0) {
    throw new Error(`Web bundle budget failed:\n- ${failures.join('\n- ')}`);
  }

  console.log(
    [
      `Web bundle budget passed: ${graph.size} initial files`,
      `${formatKiB(rawBytes)} decoded`,
      `${formatKiB(gzipBytes)} gzip`,
      `compact catalog ${(compactRatio * 100).toFixed(1)}% of legacy`,
      `summary ${formatKiB(summary.length)} raw/${formatKiB(summaryGzipBytes)} gzip`,
      `optimizer ${(optimizerRatio * 100).toFixed(1)}% of legacy`,
      largestDetail
        ? `largest detail ${largestDetail.name} ${formatKiB(largestDetail.raw)} raw/${formatKiB(largestDetail.gzip)} gzip`
        : 'no detail shards',
    ].join(', '),
  );
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
