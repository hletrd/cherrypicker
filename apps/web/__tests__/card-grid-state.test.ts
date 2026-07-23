import { describe, expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
import {
  CARD_GRID_PAGE_SIZE,
  getCardGridPage,
  getCardGridPageNumbers,
  readCardGridQuery,
  writeCardGridQuery,
} from '../src/lib/card-grid-state.js';

describe('card grid pagination', () => {
  test('renders a stable 12-item page and clamps the final page', () => {
    const cards = Array.from({ length: 683 }, (_, index) => `card-${index + 1}`);

    const first = getCardGridPage(cards, 1);
    expect(CARD_GRID_PAGE_SIZE).toBe(12);
    expect(first.items).toHaveLength(12);
    expect(first.start).toBe(1);
    expect(first.end).toBe(12);
    expect(first.totalPages).toBe(57);

    const final = getCardGridPage(cards, 999);
    expect(final.page).toBe(57);
    expect(final.items).toHaveLength(11);
    expect(final.start).toBe(673);
    expect(final.end).toBe(683);
  });

  test('uses a stable empty range and a bounded page-control window', () => {
    expect(getCardGridPage([], 7)).toEqual({
      items: [],
      page: 1,
      totalPages: 1,
      totalItems: 0,
      start: 0,
      end: 0,
    });
    expect(getCardGridPageNumbers(1, 19)).toEqual([1, 2, 3, 4, 5]);
    expect(getCardGridPageNumbers(10, 19)).toEqual([8, 9, 10, 11, 12]);
    expect(getCardGridPageNumbers(19, 19)).toEqual([15, 16, 17, 18, 19]);
  });
});

describe('card grid query state', () => {
  test('round-trips list state while preserving unrelated parameters', () => {
    const params = writeCardGridQuery(
      {
        search: '  여행 카드  ',
        type: 'credit',
        issuer: 'SHINHAN',
        sort: 'fee-desc',
        page: 4,
      },
      new URLSearchParams('campaign=summer'),
    );

    expect(params.get('campaign')).toBe('summer');
    expect(params.get('search')).toBe('여행 카드');
    expect(readCardGridQuery(params)).toEqual({
      search: '여행 카드',
      type: 'credit',
      issuer: 'shinhan',
      sort: 'fee-desc',
      page: 4,
    });
  });

  test('fails closed to defaults for invalid query values', () => {
    expect(
      readCardGridQuery(
        'type=unknown&issuer=%2Fescape&sort=sideways&page=-2',
      ),
    ).toEqual({
      search: '',
      type: 'all',
      issuer: '',
      sort: 'name',
      page: 1,
    });
  });

  test('omits default values from the URL', () => {
    expect(
      writeCardGridQuery({
        search: '',
        type: 'all',
        issuer: '',
        sort: 'name',
        page: 1,
      }).toString(),
    ).toBe('');
  });
});

describe('CardGrid production wiring', () => {
  test('renders only the paged slice and exposes accessible pagination state', async () => {
    const componentUrl = new URL(
      '../src/components/cards/CardGrid.svelte',
      import.meta.url,
    );
    const source = await readFile(componentUrl, 'utf8');

    expect(source).toContain('{#each pageInfo.items as card}');
    expect(source).not.toContain('{#each filteredCards as card}');
    expect(source).toContain('aria-label="이전 페이지"');
    expect(source).toContain('aria-label="다음 페이지"');
    expect(source).toContain("aria-current={pageInfo.page === pageNumber ? 'page' : undefined}");
    expect(source).toContain("'card-grid-page-range'");
    expect(source).toContain("{@render paginationControls('top')}");
    expect(source).toContain("{@render paginationControls('bottom')}");
    expect(source).toContain('data-testid="issuer-filter-toggle"');
    expect(source).toContain('aria-controls="issuer-filter-options"');
    expect(source).toContain('readCardGridQuery(window.location.search)');
    expect(source).toContain('writeCardGridQuery(');
  });

  test('resets pagination whenever a result-reducing filter changes', async () => {
    const componentUrl = new URL(
      '../src/components/cards/CardGrid.svelte',
      import.meta.url,
    );
    const source = await readFile(componentUrl, 'utf8');

    for (const setter of [
      'setSearchQuery',
      'setTypeFilter',
      'setIssuerFilter',
    ]) {
      const start = source.indexOf(`function ${setter}`);
      expect(start).toBeGreaterThan(-1);
      expect(source.slice(start, start + 180)).toContain('currentPage = 1');
    }
  });

  test('restores focus to the visible mobile issuer toggle after collapsing options', async () => {
    const componentUrl = new URL(
      '../src/components/cards/CardGrid.svelte',
      import.meta.url,
    );
    const source = await readFile(componentUrl, 'utf8');
    const start = source.indexOf('async function setIssuerFilter');
    const handler = source.slice(start, start + 500);

    expect(start).toBeGreaterThan(-1);
    expect(source).toContain('bind:this={issuerFilterToggle}');
    expect(handler).toContain(
      'const shouldRestoreFocus = isElementVisible(issuerFilterToggle)',
    );
    expect(handler.indexOf('issuersExpanded = false')).toBeLessThan(
      handler.indexOf('await tick()'),
    );
    expect(handler).toContain(
      'if (shouldRestoreFocus && isElementVisible(issuerFilterToggle))',
    );
    expect(handler).toContain('issuerFilterToggle.focus()');
  });
});
