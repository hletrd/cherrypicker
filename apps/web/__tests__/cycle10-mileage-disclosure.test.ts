import { describe, expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import { partitionCatalogRewards } from '../src/lib/catalog-reward-display.js';
import { formatUnsupportedRewardReasonKo } from '../src/lib/card-detail-display.js';

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
    const mileageRewards = groups.unsupported.filter(
      (reward) => reward.type === 'mileage',
    );
    expect(
      mileageRewards.map((reward) => [
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
    expect(
      mileageRewards.map((reward) =>
        reward.support.status === 'unsupported'
          ? formatUnsupportedRewardReasonKo(reward.support.reason)
          : null,
      ),
    ).toEqual(Array(6).fill(
      '마일리지를 원화로 환산할 기준이 없어 확정 혜택표와 추천 계산에서 제외했어요.',
    ));

    const componentSource = await readFile(
      new URL('../src/components/cards/CardDetail.svelte', import.meta.url),
      'utf8',
    );
    expect(componentSource).toContain(
      'formatUnsupportedRewardReasonKo(reward.support.reason)',
    );
    expect(componentSource).toContain(
      'data-testid="unsupported-reward-reason"',
    );
  });
});
