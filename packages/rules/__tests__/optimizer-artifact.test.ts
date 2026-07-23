import { afterAll, describe, expect, test } from 'bun:test';
import {
  mkdtemp,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import {
  isRecommendationEligibleCard,
  loadAllCardRules,
  loadOptimizerCatalogArtifact,
  parseOptimizerCatalogArtifact,
} from '../src/index.js';

const HASH = 'a'.repeat(64);
const dataDirectory = resolve(import.meta.dir, '../data');
const optimizerArtifactPath = resolve(
  import.meta.dir,
  '../../../apps/web/public/data/cards-optimizer.json',
);
const temporaryDirectories: string[] = [];

const validCard = {
  card: {
    id: 'test-card',
    issuer: 'test',
    name: 'Test Card',
    nameKo: '테스트 카드',
    type: 'credit',
    annualFee: { domestic: 0, international: 0 },
    lastUpdated: '2026-07-23',
    source: 'manual',
  },
  performanceTiers: [
    { id: 'tier0', label: '무실적', minSpending: 0, maxSpending: null },
  ],
  performanceExclusions: [],
  rewards: [
    {
      id: 'base',
      category: '*',
      type: 'discount',
      tiers: [
        {
          performanceTier: 'tier0',
          rate: 1,
          monthlyCap: null,
          perTransactionCap: null,
        },
      ],
      priority: 1,
      combination: 'exclusive',
      stackingGroup: 'base',
      capGroup: 'base',
      support: { status: 'supported' },
    },
  ],
  globalConstraints: {
    monthlyTotalDiscountCap: null,
    minimumAnnualSpending: null,
  },
};

afterAll(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

describe('compiled optimizer artifact contract', () => {
  test('validates identity and normalizes every card through the canonical schema', () => {
    const artifact = parseOptimizerCatalogArtifact({
      sourceHash: HASH,
      cards: [validCard],
    });

    expect(artifact.sourceHash).toBe(HASH);
    expect(artifact.cards).toHaveLength(1);
    expect(artifact.cards[0]?.rewards[0]?.tiers[0]).toMatchObject({
      fixedAmount: null,
      unit: null,
      value: { kind: 'percentage', amount: 1 },
    });
    expect(
      parseOptimizerCatalogArtifact(
        JSON.parse(JSON.stringify(artifact)) as unknown,
      ),
    ).toEqual(artifact);
  });

  test.each([
    ['short hash', 'a'.repeat(63)],
    ['uppercase hash', 'A'.repeat(64)],
    ['non-hex hash', 'g'.repeat(64)],
  ])('rejects a %s', (_name, sourceHash) => {
    expect(() =>
      parseOptimizerCatalogArtifact({
        sourceHash,
        cards: [validCard],
      }),
    ).toThrow('64 lowercase hexadecimal');
  });

  test('rejects empty, duplicate, malformed, and unknown artifact data', () => {
    expect(() =>
      parseOptimizerCatalogArtifact({ cards: [validCard] }),
    ).toThrow('.sourceHash');
    expect(() =>
      parseOptimizerCatalogArtifact({ sourceHash: HASH, cards: [] }),
    ).toThrow('.cards');
    expect(() =>
      parseOptimizerCatalogArtifact({
        sourceHash: HASH,
        cards: [validCard, structuredClone(validCard)],
      }),
    ).toThrow('duplicate card id');
    expect(() =>
      parseOptimizerCatalogArtifact({
        sourceHash: HASH,
        cards: [{ ...validCard, rewards: [] }],
      }),
    ).toThrow('.cards.0.rewards');
    expect(() =>
      parseOptimizerCatalogArtifact({
        sourceHash: HASH,
        cards: [validCard],
        unexpected: true,
      }),
    ).toThrow('Unrecognized key');
    expect(() =>
      parseOptimizerCatalogArtifact({
        sourceHash: HASH,
        cards: [{
          ...validCard,
          card: {
            ...validCard.card,
            discontinued: true,
          },
        }],
      }),
    ).toThrow('discontinued cards are not recommendation eligible');
  });

  test('the Node reader rejects malformed JSON with its source path', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'optimizer-artifact-'));
    temporaryDirectories.push(directory);
    const file = join(directory, 'cards-optimizer.json');
    await writeFile(file, '{"sourceHash":');

    await expect(loadOptimizerCatalogArtifact(file)).rejects.toThrow(
      `Invalid JSON in compiled optimizer artifact at ${file}`,
    );
  });

  test(
    'the published optimizer graph has exact normalized parity with authoring YAML',
    async () => {
      const [compiled, authored] = await Promise.all([
        loadOptimizerCatalogArtifact(optimizerArtifactPath),
        loadAllCardRules(join(dataDirectory, 'cards')),
      ]);
      const sortedAuthored = authored
        .filter(isRecommendationEligibleCard)
        .sort((left, right) =>
          left.card.id < right.card.id
            ? -1
            : left.card.id > right.card.id
              ? 1
              : 0
        );

      expect(compiled.sourceHash).toMatch(/^[a-f0-9]{64}$/);
      expect(compiled.cards).toHaveLength(682);
      expect(compiled.cards).toEqual(sortedAuthored);
    },
    30_000,
  );
});
