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
  test('renders at most 36 items and clamps the final page', () => {
    const cards = Array.from({ length: 683 }, (_, index) => `card-${index + 1}`);

    const first = getCardGridPage(cards, 1);
    expect(CARD_GRID_PAGE_SIZE).toBe(36);
    expect(first.items).toHaveLength(36);
    expect(first.start).toBe(1);
    expect(first.end).toBe(36);
    expect(first.totalPages).toBe(19);

    const final = getCardGridPage(cards, 999);
    expect(final.page).toBe(19);
    expect(final.items).toHaveLength(35);
    expect(final.start).toBe(649);
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
    expect(source).toContain('data-testid="card-grid-page-range"');
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
});
