#!/usr/bin/env node
/**
 * build-json.ts — Validate all YAML card rules and build organized JSON output.
 *
 * Usage: node --experimental-strip-types scripts/build-json.ts
 *
 * Reads all YAML files from packages/rules/data/,
 * validates against Zod schemas, reports errors,
 * and outputs a single organized JSON file.
 */

import { readFile, readdir, writeFile, mkdir } from 'fs/promises';
import { basename, dirname, join, resolve } from 'path';
import { fileURLToPath } from 'url';
import { parse } from 'yaml';
import { z } from 'zod';

// ── Relaxed schema for YAML files that may have extra/missing fields ──

const nullableNumber = z.union([z.number(), z.null()]);
const optNullableNumber = z.union([z.number(), z.null()]).optional().transform((v) => v ?? null);

const rewardTierRateSchema = z.object({
  performanceTier: z.string(),
  rate: nullableNumber,
  fixedAmount: optNullableNumber,
  unit: z.string().nullable().optional().transform((v) => v ?? null),
  monthlyCap: optNullableNumber,
  perTransactionCap: optNullableNumber,
});

const rewardConditionsSchema = z.object({
  minTransaction: z.union([z.number(), z.null()]).optional().transform((v) => v ?? undefined),
  excludeOnline: z.boolean().optional(),
  specificMerchants: z.array(z.string()).optional(),
  note: z.string().optional(),
}).passthrough();

const rewardRuleSchema = z.object({
  category: z.string(),
  subcategory: z.string().optional(),
  label: z.string().optional(),
  type: z.enum(['discount', 'points', 'cashback', 'mileage']),
  tiers: z.array(rewardTierRateSchema).min(1),
  conditions: rewardConditionsSchema.optional(),
}).passthrough();

const performanceTierSchema = z.object({
  id: z.string(),
  label: z.string(),
  minSpending: z.number().int().nonnegative(),
  maxSpending: z.number().int().nonnegative().nullable().optional().default(null),
});

const cardMetaSchema = z.object({
  id: z.string(),
  issuer: z.string(),
  name: z.string(),
  nameKo: z.string(),
  type: z.enum(['credit', 'check', 'prepaid']),
  annualFee: z.object({
    domestic: z.number().int().nonnegative(),
    international: z.number().int().nonnegative(),
  }),
  url: z.string().optional().default(''),
  lastUpdated: z.string().default('2026-03-24'),
  source: z.enum(['manual', 'llm-scrape', 'web']).default('manual'),
}).strip();

const globalConstraintsSchema = z.object({
  monthlyTotalDiscountCap: z.number().nullable().optional().default(null),
  minimumAnnualSpending: z.number().nullable().optional().default(null),
  note: z.string().optional(),
}).passthrough();

const cardRuleSetSchema = z.object({
  card: cardMetaSchema,
  performanceTiers: z.array(performanceTierSchema).min(1),
  performanceExclusions: z.array(z.string()).optional().default([]),
  rewards: z.array(rewardRuleSchema).min(1),
  globalConstraints: globalConstraintsSchema.optional().default({}),
}).strip();

// ── Types ──

interface CardEntry {
  card: {
    id: string;
    issuer: string;
    name: string;
    nameKo: string;
    type: 'credit' | 'check' | 'prepaid';
    annualFee: { domestic: number; international: number };
    url: string;
    lastUpdated: string;
    source: string;
  };
  performanceTiers: Array<{
    id: string;
    label: string;
    minSpending: number;
    maxSpending: number | null;
  }>;
  performanceExclusions: string[];
  rewards: Array<{
    category: string;
    subcategory?: string;
    label?: string;
    type: string;
    tiers: Array<{
      performanceTier: string;
      rate: number | null;
      fixedAmount: number | null;
      unit: string | null;
      monthlyCap: number | null;
      perTransactionCap: number | null;
    }>;
    conditions?: Record<string, unknown>;
  }>;
  globalConstraints: {
    monthlyTotalDiscountCap: number | null;
    minimumAnnualSpending: number | null;
    note?: string;
  };
}

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
  return tier.rate ?? tier.fixedAmount ?? 0;
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

console.log('🔍 Scanning YAML card files...\n');

// Load issuers
const issuersRaw = parse(await readFile(join(DATA_DIR, 'issuers.yaml'), 'utf-8')) as { issuers: Array<{ id: string; nameKo: string; nameEn: string; website: string }> };
const issuerMap = new Map(issuersRaw.issuers.map((i) => [i.id, i]));

// Load categories
const categoriesRaw = parse(await readFile(join(DATA_DIR, 'categories.yaml'), 'utf-8')) as { categories: unknown[] };
const validCategoryIds = new Set<string>();
function extractCategoryIds(nodes: unknown[]) {
  for (const node of nodes) {
    const n = node as { id?: string; subcategories?: unknown[] };
    if (n.id) validCategoryIds.add(n.id);
    if (n.subcategories) extractCategoryIds(n.subcategories);
  }
}
extractCategoryIds(categoriesRaw.categories);

// Scan all YAML files
const yamlFiles = await collectYamlFiles(CARDS_DIR);
console.log(`📂 Found ${yamlFiles.length} YAML card files across ${issuerMap.size} registered issuers\n`);

const cards: CardEntry[] = [];
const errors: Array<{ file: string; error: string }> = [];
const warnings: Array<{ file: string; warning: string }> = [];

for (const filePath of yamlFiles) {
  const relPath = filePath.replace(ROOT + '/', '');
  const issuerDir = basename(dirname(filePath));

  try {
    const content = await readFile(filePath, 'utf-8');
    const raw = parse(content) as unknown;
    const result = cardRuleSetSchema.safeParse(raw);

    if (!result.success) {
      const issues = result.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n');
      errors.push({ file: relPath, error: issues });
      continue;
    }

    const card = result.data as CardEntry;

    // Validate issuer matches directory
    if (card.card.issuer !== issuerDir) {
      warnings.push({ file: relPath, warning: `issuer "${card.card.issuer}" doesn't match directory "${issuerDir}"` });
    }

    // Validate category IDs
    for (const reward of card.rewards) {
      if (reward.category !== '*' && reward.category !== 'uncategorized' && !validCategoryIds.has(reward.category)) {
        warnings.push({ file: relPath, warning: `unknown category "${reward.category}"` });
      }
    }

    // Check performance tier references
    const tierIds = new Set(card.performanceTiers.map((t) => t.id));
    for (const reward of card.rewards) {
      for (const tier of reward.tiers) {
        if (!tierIds.has(tier.performanceTier)) {
          warnings.push({ file: relPath, warning: `reward references unknown tier "${tier.performanceTier}"` });
        }
      }
    }

    // Check for missing issuer registration
    if (!issuerMap.has(card.card.issuer)) {
      warnings.push({ file: relPath, warning: `issuer "${card.card.issuer}" not in issuers.yaml` });
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
if (warnings.length > 0) {
  console.log(`\n⚠️  Warnings: ${warnings.length}`);
  for (const { file, warning } of warnings) {
    console.log(`  ${file}: ${warning}`);
  }
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
    const cat = reward.subcategory ? `${reward.category}.${reward.subcategory}` : reward.category;
    if (!byCategoryIndex[cat]) byCategoryIndex[cat] = [];
    const bestTier = pickBestTier(reward.tiers);
    byCategoryIndex[cat]!.push({
      cardId: card.card.id,
      issuer: card.card.issuer,
      type: reward.type,
      rewardValue: getTierComparableValue(bestTier),
      rewardValueKind: bestTier.rate !== null ? 'rate' : 'fixedAmount',
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
    r.tiers.some((t) => t.performanceTier === 'tier0' && getTierComparableValue(t) > 0)
  );
}).map((c) => c.card.id);

const output: OrganizedOutput = {
  meta: {
    version: '1.0.0',
    generatedAt: new Date().toISOString(),
    totalIssuers: issuersOutput.length,
    totalCards: cards.length,
    categories: [...validCategoryIds].sort(),
  },
  issuers: issuersOutput,
  categories: categoriesRaw.categories,
  index: {
    byCategory: byCategoryIndex,
    byType: { credit: creditCards, check: checkCards, prepaid: prepaidCards },
    noMinSpend,
  },
};

// Write output
const outputPath = join(OUTPUT_DIR, 'cards.json');
await writeFile(outputPath, JSON.stringify(output, null, 2), 'utf-8');

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
        .map((r) => ({
          category: r.subcategory ? `${r.category}.${r.subcategory}` : r.category,
          type: r.type,
          bestValue: getTierComparableValue(pickBestTier(r.tiers)),
          bestValueKind: pickBestTier(r.tiers).rate !== null ? 'rate' : 'fixedAmount',
          unit: pickBestTier(r.tiers).unit,
        }))
        .sort((a, b) => b.bestValue - a.bestValue)
        .slice(0, 5),
    })),
  })),
  index: output.index,
};

const compactPath = join(OUTPUT_DIR, 'cards-compact.json');
await writeFile(compactPath, JSON.stringify(compactOutput, null, 2), 'utf-8');
console.log(`   ${compactPath} (compact index)`);

// Copy to web app's public directory for static serving
const webPublicDir = join(ROOT, 'apps/web/public/data');
await mkdir(webPublicDir, { recursive: true });
await writeFile(join(webPublicDir, 'cards.json'), JSON.stringify(output, null, 2), 'utf-8');

// Also write categories as JSON
const categoriesJsonPath = join(webPublicDir, 'categories.json');
await writeFile(categoriesJsonPath, JSON.stringify(categoriesRaw, null, 2), 'utf-8');
console.log(`   ${join(webPublicDir, 'cards.json')} (web public)`);
console.log(`   ${categoriesJsonPath} (web public)`);

console.log('\n✨ Done!');
