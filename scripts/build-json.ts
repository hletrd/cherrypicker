#!/usr/bin/env bun
/**
 * build-json.ts — Validate all YAML card rules and build organized JSON output.
 *
 * Usage: bun run data:build
 *
 * Reads all YAML files from packages/rules/data/,
 * validates against Zod schemas, reports errors,
 * and outputs a single organized JSON file.
 */

import { readFile, readdir, writeFile, mkdir, unlink } from 'fs/promises';
import { basename, dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { parse } from 'yaml';
import { MerchantMatcher } from '../packages/core/src/categorizer/matcher.js';
import {
  categoriesFileSchema,
  issuersFileSchema,
  CatalogValidationError,
  CategoryRegistry,
  validateCardCatalog,
} from '../packages/rules/src/index.js';
import type {
  CardRuleSet,
  CategoryNode,
  IssuerMeta,
} from '../packages/rules/src/index.js';
import {
  buildWebCatalogArtifacts,
  isIndexableReward,
  parsePublicationCard,
  publicationRewardIndexValue,
  staleGeneratedShardNames,
} from './catalog-publication.js';

type CardEntry = CardRuleSet;

type RewardIndexValueKind = 'rate' | 'fixedAmount';

interface IndexedReward {
  cardId: string;
  issuer: string;
  type: string;
  rewardValue: number;
  rewardValueKind: RewardIndexValueKind;
  unit: string | null;
  monthlyCap: number | null;
  subcategory?: string;
}

interface IssuerData {
  id: string;
  nameKo: string;
  nameEn: string;
  website: string;
  cardCount: number;
  cards: CardEntry[];
}

interface OrganizedOutput {
  meta: {
    version: string;
    generatedAt: string;
    totalIssuers: number;
    totalCards: number;
    categories: string[];
    sourceHash: string;
  };
  issuers: IssuerData[];
  categories: unknown[];
  index: {
    byCategory: Record<string, IndexedReward[]>;
    byType: { credit: string[]; check: string[]; prepaid: string[] };
    noMinSpend: string[];
  };
}

function getTierComparableValue(tier: CardEntry['rewards'][number]['tiers'][number]): number {
  return publicationRewardIndexValue(tier).amount;
}

function pickBestTier(tiers: CardEntry['rewards'][number]['tiers']) {
  return tiers.reduce((best, tier) => {
    return getTierComparableValue(tier) > getTierComparableValue(best) ? tier : best;
  }, tiers[0]!);
}

// ── Helpers ──

async function collectYamlFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await collectYamlFiles(fullPath)));
    } else if (entry.isFile() && /\.ya?ml$/.test(entry.name) && entry.name !== 'categories.yaml' && entry.name !== 'issuers.yaml') {
      files.push(fullPath);
    }
  }
  return files.sort();
}

// ── Main ──

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DATA_DIR = join(ROOT, 'packages/rules/data');
const CARDS_DIR = join(DATA_DIR, 'cards');
const OUTPUT_DIR = join(ROOT, 'packages/rules/data');
const CHECK_MODE = process.argv.includes('--check');
const validationNow = new Date();
const validationClock = () => validationNow;

console.log('🔍 Scanning YAML card files...\n');

// Load issuers
const issuersResult = issuersFileSchema.safeParse(
  parse(await readFile(join(DATA_DIR, 'issuers.yaml'), 'utf-8')),
);
if (!issuersResult.success) {
  throw new Error(`Invalid issuers.yaml:\n${issuersResult.error.message}`);
}
const issuerMap = new Map<string, IssuerMeta>(
  issuersResult.data.issuers.map((issuer) => [issuer.id, issuer]),
);

// Load categories
const categoriesResult = categoriesFileSchema.safeParse(
  parse(await readFile(join(DATA_DIR, 'categories.yaml'), 'utf-8')),
);
if (!categoriesResult.success) {
  throw new Error(`Invalid categories.yaml:\n${categoriesResult.error.message}`);
}
const categoriesRaw: { categories: CategoryNode[] } = {
  categories: categoriesResult.data.categories as CategoryNode[],
};
const categoryRegistry = new CategoryRegistry(categoriesRaw.categories);
const merchantMatcher = new MerchantMatcher(categoriesRaw.categories, {
  strict: true,
});

// Scan all YAML files
const yamlFiles = await collectYamlFiles(CARDS_DIR);
console.log(`📂 Found ${yamlFiles.length} YAML card files across ${issuerMap.size} registered issuers\n`);

const cards: CardEntry[] = [];
const errors: Array<{ file: string; error: string }> = [];

for (const filePath of yamlFiles) {
  const relPath = filePath.replace(ROOT + '/', '');
  const issuerDir = basename(dirname(filePath));

  try {
    const content = await readFile(filePath, 'utf-8');
    const raw = parse(content) as unknown;
    const card = parsePublicationCard(raw, relPath, validationClock);

    // Validate issuer matches directory
    if (card.card.issuer !== issuerDir) {
      errors.push({
        file: relPath,
        error: `issuer "${card.card.issuer}" doesn't match directory "${issuerDir}"`,
      });
      continue;
    }

    // Check for missing issuer registration
    if (!issuerMap.has(card.card.issuer)) {
      errors.push({
        file: relPath,
        error: `issuer "${card.card.issuer}" not in issuers.yaml`,
      });
      continue;
    }

    cards.push(card);
  } catch (e) {
    errors.push({ file: relPath, error: e instanceof Error ? e.message : String(e) });
  }
}

// ── Report ──

console.log(`✅ Parsed: ${cards.length} cards`);
if (errors.length > 0) {
  console.log(`❌ Errors: ${errors.length}`);
  for (const { file, error } of errors) {
    console.log(`\n  ${file}:`);
    console.log(`    ${error}`);
  }
}
if (errors.length > 0) {
  process.exit(1);
}

try {
  validateCardCatalog(cards, categoryRegistry, {
    resolveMerchant: (merchant) => {
      const resolved = merchantMatcher.match(merchant);
      return {
        category: resolved.category,
        subcategory: resolved.subcategory,
      };
    },
    clock: validationClock,
  });
} catch (error) {
  if (error instanceof CatalogValidationError) {
    console.error(error.message);
    process.exit(1);
  }
  throw error;
}

// ── Build organized output ──

// Group by issuer
const issuerGroups = new Map<string, CardEntry[]>();
for (const card of cards) {
  const issuer = card.card.issuer;
  if (!issuerGroups.has(issuer)) issuerGroups.set(issuer, []);
  issuerGroups.get(issuer)!.push(card);
}

// Sort issuers by card count descending
const sortedIssuers = [...issuerGroups.entries()]
  .sort((a, b) => b[1].length - a[1].length);

const issuersOutput: IssuerData[] = sortedIssuers.map(([issuerId, issuerCards]) => {
  const meta = issuerMap.get(issuerId);
  // Sort cards: credit first, then by annual fee ascending
  const sorted = issuerCards.sort((a, b) => {
    if (a.card.type !== b.card.type) return a.card.type === 'credit' ? -1 : 1;
    return a.card.annualFee.domestic - b.card.annualFee.domestic;
  });

  return {
    id: issuerId,
    nameKo: meta?.nameKo ?? issuerId,
    nameEn: meta?.nameEn ?? issuerId,
    website: meta?.website ?? '',
    cardCount: sorted.length,
    cards: sorted,
  };
});

// Build category index — which cards offer rewards in each category
const byCategoryIndex: Record<string, IndexedReward[]> = {};
for (const card of cards) {
  for (const reward of card.rewards) {
    if (!isIndexableReward(reward)) continue;
    const cat = reward.subcategory ? `${reward.category}.${reward.subcategory}` : reward.category;
    if (!byCategoryIndex[cat]) byCategoryIndex[cat] = [];
    const bestTier = pickBestTier(reward.tiers);
    byCategoryIndex[cat]!.push({
      cardId: card.card.id,
      issuer: card.card.issuer,
      type: reward.type,
      rewardValue: getTierComparableValue(bestTier),
      rewardValueKind: publicationRewardIndexValue(bestTier).kind,
      unit: bestTier.unit,
      monthlyCap: bestTier.monthlyCap,
      subcategory: reward.subcategory,
    });
  }
}

// Sort each category by comparable value descending
for (const cat of Object.keys(byCategoryIndex)) {
  byCategoryIndex[cat]!.sort((a, b) => b.rewardValue - a.rewardValue);
}

// Build type index
const creditCards = cards.filter((c) => c.card.type === 'credit').map((c) => c.card.id);
const checkCards = cards.filter((c) => c.card.type === 'check').map((c) => c.card.id);
const prepaidCards = cards.filter((c) => c.card.type === 'prepaid').map((c) => c.card.id);

// Build no-min-spend index (cards with tier0 that has meaningful rewards)
const noMinSpend = cards.filter((c) => {
  return c.rewards.some((r) =>
    isIndexableReward(r) &&
    r.tiers.some((t) => t.performanceTier === 'tier0' && getTierComparableValue(t) > 0)
  );
}).map((c) => c.card.id);

const publicationVersion = '1.0.0';
const publicationMeta = {
  version: publicationVersion,
  generatedAt: `${cards
    .map((entry) => entry.card.lastUpdated)
    .sort()
    .at(-1) ?? '1970-01-01'}T00:00:00.000Z`,
  totalIssuers: issuersOutput.length,
  totalCards: cards.length,
  categories: categoryRegistry.canonicalKeys().sort(),
};
const webCatalog = buildWebCatalogArtifacts(
  publicationMeta,
  issuersOutput,
  categoriesRaw.categories,
);
const { sourceHash } = webCatalog;

const output: OrganizedOutput = {
  meta: {
    ...publicationMeta,
    sourceHash,
  },
  issuers: issuersOutput,
  categories: categoriesRaw.categories,
  index: {
    byCategory: byCategoryIndex,
    byType: { credit: creditCards, check: checkCards, prepaid: prepaidCards },
    noMinSpend,
  },
};

const driftedPaths: string[] = [];
async function publish(path: string, content: string): Promise<void> {
  if (!CHECK_MODE) {
    await writeFile(path, content, 'utf-8');
    return;
  }
  try {
    const current = await readFile(path, 'utf-8');
    if (current !== content) driftedPaths.push(path);
  } catch {
    driftedPaths.push(path);
  }
}

async function reconcileShardDirectory(
  directory: string,
  expectedNames: ReadonlySet<string>,
): Promise<void> {
  let existingNames: string[] = [];
  try {
    existingNames = (await readdir(directory, { withFileTypes: true }))
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      .sort();
  } catch (error) {
    if (
      !(error instanceof Error) ||
      !('code' in error) ||
      error.code !== 'ENOENT'
    ) {
      throw error;
    }
  }

  for (const name of staleGeneratedShardNames(existingNames, expectedNames)) {
    const stalePath = join(directory, name);
    if (CHECK_MODE) {
      driftedPaths.push(stalePath);
    } else {
      await unlink(stalePath);
    }
  }
}

// Write output
const outputPath = join(OUTPUT_DIR, 'cards.json');
await publish(outputPath, JSON.stringify(output, null, 2));

console.log(`\n📊 Output: ${outputPath}`);
console.log(`   ${output.meta.totalIssuers} issuers, ${output.meta.totalCards} cards`);
console.log(`   ${creditCards.length} credit cards, ${checkCards.length} check cards, ${prepaidCards.length} prepaid cards`);
console.log(`   ${noMinSpend.length} cards with no minimum spend`);
console.log(`   ${Object.keys(byCategoryIndex).length} categories indexed`);

// Also write a compact version without the full card data (just the index)
const compactOutput = {
  meta: output.meta,
  issuers: issuersOutput.map((i) => ({
    id: i.id,
    nameKo: i.nameKo,
    nameEn: i.nameEn,
    website: i.website,
    cardCount: i.cardCount,
    cards: i.cards.map((c) => ({
      id: c.card.id,
      name: c.card.name,
      nameKo: c.card.nameKo,
      type: c.card.type,
      annualFee: c.card.annualFee.domestic,
      topRewards: c.rewards
        .filter(isIndexableReward)
        .map((r) => ({
          category: r.subcategory ? `${r.category}.${r.subcategory}` : r.category,
          type: r.type,
          bestValue: getTierComparableValue(pickBestTier(r.tiers)),
          bestValueKind: publicationRewardIndexValue(
            pickBestTier(r.tiers),
          ).kind,
          unit: pickBestTier(r.tiers).unit,
        }))
        .sort((a, b) => b.bestValue - a.bestValue)
        .slice(0, 5),
    })),
  })),
  index: output.index,
};

const compactPath = join(OUTPUT_DIR, 'cards-compact.json');
await publish(compactPath, JSON.stringify(compactOutput, null, 2));
console.log(`   ${compactPath} (compact index)`);

// Copy to web app's public directory for static serving
const webPublicDir = join(ROOT, 'apps/web/public/data');
if (!CHECK_MODE) await mkdir(webPublicDir, { recursive: true });
await publish(join(webPublicDir, 'cards.json'), JSON.stringify(output, null, 2));

// Also write categories as JSON
const categoriesJsonPath = join(webPublicDir, 'categories.json');
await publish(
  categoriesJsonPath,
  JSON.stringify(webCatalog.categories, null, 2),
);
console.log(`   ${join(webPublicDir, 'cards.json')} (web public)`);
console.log(`   ${categoriesJsonPath} (web public)`);

// Browser runtime artifacts: compact list data, issuer-scoped details, and a
// identity-wrapped optimizer-ready rule array. Unsupported rewards remain in
// detail and optimizer payloads for disclosure, but never enter summary
// reward counts.
const summaryPath = join(webPublicDir, 'cards-summary.json');
const optimizerPath = join(webPublicDir, 'cards-optimizer.json');
const detailDir = join(webPublicDir, 'card-details');
if (!CHECK_MODE) await mkdir(detailDir, { recursive: true });

await publish(summaryPath, JSON.stringify(webCatalog.summary));
await publish(optimizerPath, JSON.stringify(webCatalog.optimizer));

const expectedDetailNames = new Set<string>();
for (const [issuerId, shard] of webCatalog.detailShards) {
  const fileName = `${issuerId}.json`;
  expectedDetailNames.add(fileName);
  await publish(join(detailDir, fileName), JSON.stringify(shard));
}
await reconcileShardDirectory(detailDir, expectedDetailNames);

console.log(`   ${summaryPath} (web card summary)`);
console.log(`   ${optimizerPath} (web optimizer catalog)`);
console.log(`   ${detailDir} (${expectedDetailNames.size} issuer detail shards)`);

// Generate fallback category labels TypeScript module for web app (C7-04)
// This eliminates the hardcoded duplication anti-pattern by generating the
// fallback directly from the canonical categories.yaml source.
const fallbackEntries: string[] = [];
for (const node of categoriesRaw.categories as Array<{ id: string; labelKo: string; subcategories?: Array<{ id: string; labelKo: string }> }>) {
  fallbackEntries.push(`    ['${node.id}', '${node.labelKo}'],`);
  if (node.subcategories) {
    for (const sub of node.subcategories) {
      fallbackEntries.push(`    ['${sub.id}', '${sub.labelKo}'],`);
      fallbackEntries.push(`    ['${node.id}.${sub.id}', '${sub.labelKo}'],`);
    }
  }
}
const fallbackModule = `/** Auto-generated from categories.yaml by scripts/build-json.ts\n *  Do not edit manually — run 'bun run data:build' to regenerate.\n */\nexport const FALLBACK_CATEGORY_LABELS: ReadonlyMap<string, string> = new Map([\n${fallbackEntries.join('\n')}\n  ]);\n`;
const fallbackPath = join(ROOT, 'apps/web/src/lib/category-labels-fallback.ts');
await publish(fallbackPath, fallbackModule);
console.log(`   ${fallbackPath} (auto-generated fallback labels)`);

if (driftedPaths.length > 0) {
  console.error('\nGenerated catalog drift detected:');
  for (const path of driftedPaths) console.error(`  ${path}`);
  process.exitCode = 1;
}

console.log('\n✨ Done!');
