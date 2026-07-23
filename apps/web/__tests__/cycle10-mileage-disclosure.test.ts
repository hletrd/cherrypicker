import { describe, expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { partitionCatalogRewards } from '../src/lib/catalog-reward-display.js';

describe('Cycle 10 mileage catalog disclosure', () => {
  test('keeps raw Samsung mileage promises out of the exact Won table', async () => {
    const artifact = JSON.parse(
      await readFile(
        new URL('../public/data/card-details/samsung.json', import.meta.url),
        'utf8',
      ),
    ) as {
      cards: Array<{
        card: { id: string };
        rewards: Array<{
          id: string;
          type: string;
          category: string;
          support:
            | { status: 'supported' }
            | { status: 'unsupported'; reason: string };
        }>;
      }>;
    };
    const card = artifact.cards.find(
      ({ card: metadata }) =>
        metadata.id === 'samsung-and-mileage-platinum',
    )!;
    const groups = partitionCatalogRewards(card.rewards);

    expect(
      groups.supported.filter((reward) => reward.type === 'mileage'),
    ).toEqual([]);
    expect(
      groups.unsupported
        .filter((reward) => reward.type === 'mileage')
        .map((reward) => [
          reward.id,
          reward.support.status === 'unsupported'
            ? reward.support.reason
            : null,
        ]),
    ).toEqual([
      ['reward-001', 'mileage reward valuation contract is not modeled'],
      ['reward-002', 'mileage reward valuation contract is not modeled'],
      ['reward-003', 'mileage reward valuation contract is not modeled'],
      ['reward-004', 'mileage reward valuation contract is not modeled'],
      ['reward-005', 'mileage reward valuation contract is not modeled'],
      ['reward-006', 'mileage reward valuation contract is not modeled'],
    ]);
  });
});
