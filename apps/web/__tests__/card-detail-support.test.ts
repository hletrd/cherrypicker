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
    expect(source).toContain('{formatWon(tier.maxSpending)} 이하');
    expect(source).not.toContain('{formatWon(tier.maxSpending)} 미만');
    expect(source).toContain('data-testid="card-detail-heading"');
    expect(source).toContain('tabindex="-1"');
    expect(source).toContain('use:focusDetailHeading');
    expect(source).toContain('node.focus()');
  });

  test('moves focus into detail and restores the originating card with Korean navigation copy', async () => {
    const [pageSource, gridSource] = await Promise.all([
      readFile(
        new URL('../src/components/cards/CardPage.svelte', import.meta.url),
        'utf8',
      ),
      readFile(
        new URL('../src/components/cards/CardGrid.svelte', import.meta.url),
        'utf8',
      ),
    ]);

    expect(pageSource).toContain('aria-label="이동 경로"');
    expect(pageSource).toContain('onReady={handleDetailReady}');
    expect(pageSource).toContain('focusCardId={returnFocusCardId}');
    expect(pageSource).toContain('onFocusRestored={handleFocusRestored}');
    expect(pageSource).toContain('document.title = `${name} | CherryPicker`');
    expect(pageSource).not.toContain(
      "document.querySelector<HTMLElement>('[data-testid=\"card-detail-heading\"]')?.focus()",
    );
    expect(gridSource).toContain('data-card-id={card.id}');
    expect(gridSource).toContain('use:restoreCardFocus={card.id}');
    expect(gridSource).toContain('node.focus()');
    expect(gridSource).toContain('onFocusRestored?.()');
  });
});
