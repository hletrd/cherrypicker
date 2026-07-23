import { describe, expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import {
  catalogRewardCategoryKey,
  partitionCatalogRewards,
} from '../src/lib/catalog-reward-display.js';

describe('catalog reward display boundary', () => {
  test('keeps unsupported rewards for disclosure but out of the exact table', () => {
    const supported = {
      id: 'supported',
      category: 'dining',
      subcategory: 'cafe',
      support: { status: 'supported' as const },
    };
    const unsupported = {
      id: 'unsupported',
      category: 'travel',
      support: {
        status: 'unsupported' as const,
        reason: 'missing statement fact',
      },
    };

    const groups = partitionCatalogRewards([unsupported, supported]);

    expect(groups.supported).toEqual([supported]);
    expect(groups.unsupported).toEqual([unsupported]);
    expect(catalogRewardCategoryKey(supported)).toBe('dining.cafe');
    expect(catalogRewardCategoryKey(unsupported)).toBe('travel');
  });

  test('wires the supported table and unsupported disclosure separately', async () => {
    const source = await readFile(
      new URL(
        '../src/components/cards/CardDetail.svelte',
        import.meta.url,
      ),
      'utf8',
    );

    expect(source).toContain('for (const reward of supportedRewards)');
    expect(source).toContain('data-testid="supported-reward-table"');
    expect(source).toContain('data-testid="unsupported-reward-disclosure"');
    expect(source).toContain('data-testid="unsupported-reward-item"');
    expect(source).toContain('{#each unsupportedRewards as reward}');
  });
});
