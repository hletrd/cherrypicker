import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { CARD_ID_MAX_LENGTH } from '@cherrypicker/rules/browser';
import {
  buildCardSelectionUrl,
  parseCardSelectionQuery,
  pushCardSelectionHistory,
  resolveCardSelectionQuery,
} from '../src/lib/card-navigation-state.js';

interface PublishedCardSummary {
  meta: { totalCards: number };
  cards: Array<{ id: string }>;
}

const publishedSummary = JSON.parse(
  readFileSync(
    new URL('../public/data/cards-summary.json', import.meta.url),
    'utf8',
  ),
) as PublishedCardSummary;
const publishedCards = publishedSummary.cards;

describe('card selection query parsing', () => {
  test.each([
    ['', null],
    ['?issuer=shinhan', null],
    ['?card=shinhan-test-card', 'shinhan-test-card'],
    ['?card=hana-wonder-2.0', 'hana-wonder-2.0'],
    ['?card=shinhan%2Dtest%2Dcard', 'shinhan-test-card'],
    ['?card=', null],
    ['?card=%E0%A4%A', null],
    ['?card=../../escape', null],
    ['?card=UPPERCASE', null],
    ['?card=-leading', null],
    ['?card=trailing-', null],
    ['?card=two--parts', null],
    ['?card=two..parts', null],
    [`?card=${'a'.repeat(CARD_ID_MAX_LENGTH + 1)}`, null],
    ['?card=shinhan-one&card=shinhan-two', null],
  ])('maps %s to %s', (search, expected) => {
    expect(parseCardSelectionQuery(search)).toBe(expected);
  });
});

describe('card selection URL construction', () => {
  const current = {
    pathname: '/cherrypicker/cards',
    search: '?issuer=shinhan&page=2',
    hash: '#main-content',
  };

  test('adds an encoded card while preserving base path, query, and fragment', () => {
    expect(buildCardSelectionUrl(current, 'shinhan-test-card')).toBe(
      '/cherrypicker/cards?issuer=shinhan&page=2&card=shinhan-test-card#main-content',
    );
  });

  test('constructs a URL for a canonical dotted card ID', () => {
    expect(buildCardSelectionUrl(current, 'hana-wonder-2.0')).toBe(
      '/cherrypicker/cards?issuer=shinhan&page=2&card=hana-wonder-2.0#main-content',
    );
  });

  test('removes only card state when returning to the list', () => {
    expect(
      buildCardSelectionUrl(
        {
          ...current,
          search: '?issuer=shinhan&card=shinhan-test-card&page=2',
        },
        null,
      ),
    ).toBe('/cherrypicker/cards?issuer=shinhan&page=2#main-content');
  });

  test('replaces duplicate or stale card parameters without disturbing other state', () => {
    expect(
      buildCardSelectionUrl(
        {
          ...current,
          search: '?card=stale&issuer=shinhan&card=duplicate&page=2',
        },
        'kb-known-card',
      ),
    ).toBe(
      '/cherrypicker/cards?card=kb-known-card&issuer=shinhan&page=2#main-content',
    );
  });

  test.each([
    '../../escape',
    'UPPERCASE',
    '-leading',
    'trailing-',
    'two--parts',
    'two..parts',
    'two.-parts',
    'a'.repeat(CARD_ID_MAX_LENGTH + 1),
  ])('rejects malformed card ID %s instead of constructing an unsafe URL', (id) => {
    expect(() => buildCardSelectionUrl(current, id)).toThrow(
      'Invalid card selection ID',
    );
  });
});

describe('card selection validation', () => {
  test('resolves a known query with one summary lookup', async () => {
    const lookedUp: string[] = [];
    const selected = await resolveCardSelectionQuery(
      '?card=shinhan-test-card',
      async (cardId) => {
        lookedUp.push(cardId);
        return { id: cardId };
      },
    );

    expect(selected).toBe('shinhan-test-card');
    expect(lookedUp).toEqual(['shinhan-test-card']);
  });

  test('resolves a canonical dotted query with one summary lookup', async () => {
    const lookedUp: string[] = [];
    const selected = await resolveCardSelectionQuery(
      '?card=hana-wonder-2.0',
      async (cardId) => {
        lookedUp.push(cardId);
        return publishedCards.find((card) => card.id === cardId);
      },
    );

    expect(selected).toBe('hana-wonder-2.0');
    expect(lookedUp).toEqual(['hana-wonder-2.0']);
  });

  test('maps an unknown but well-formed query to list state', async () => {
    const lookedUp: string[] = [];
    const selected = await resolveCardSelectionQuery(
      '?card=unknown-card',
      async (cardId) => {
        lookedUp.push(cardId);
        return null;
      },
    );

    expect(selected).toBeNull();
    expect(lookedUp).toEqual(['unknown-card']);
  });

  test.each([
    '?card=../../escape',
    '?card=UPPERCASE',
    '?card=-leading',
    '?card=trailing-',
    '?card=two--parts',
    '?card=two..parts',
    `?card=${'a'.repeat(CARD_ID_MAX_LENGTH + 1)}`,
    '?card=one&card=two',
  ])('does not issue a lookup for malformed selection state %s', async (search) => {
    let lookupCount = 0;
    const selected = await resolveCardSelectionQuery(
      search,
      async () => {
        lookupCount++;
        return { id: 'unexpected' };
      },
    );

    expect(selected).toBeNull();
    expect(lookupCount).toBe(0);
  });
});

describe('card selection history', () => {
  test('select and explicit back each push one composable history entry', () => {
    const state = { astro: 'preserved' };
    const calls: unknown[][] = [];
    const history = {
      state,
      pushState(...args: unknown[]) {
        calls.push(args);
      },
    };

    const detailUrl = pushCardSelectionHistory(
      history,
      {
        pathname: '/cherrypicker/cards',
        search: '?issuer=shinhan',
        hash: '#main-content',
      },
      'shinhan-test-card',
    );
    const detail = new URL(detailUrl, 'https://example.test');
    const listUrl = pushCardSelectionHistory(history, detail, null);

    expect(detailUrl).toBe(
      '/cherrypicker/cards?issuer=shinhan&card=shinhan-test-card#main-content',
    );
    expect(listUrl).toBe(
      '/cherrypicker/cards?issuer=shinhan#main-content',
    );
    expect(calls).toEqual([
      [state, '', detailUrl],
      [state, '', listUrl],
    ]);
  });

  test('a dotted catalog selection and direct query resolve the same detail', async () => {
    const calls: unknown[][] = [];
    const detailUrl = pushCardSelectionHistory(
      {
        state: null,
        pushState(...args: unknown[]) {
          calls.push(args);
        },
      },
      {
        pathname: '/cherrypicker/cards',
        search: '',
        hash: '',
      },
      'hana-wonder-2.0',
    );
    const search = new URL(detailUrl, 'https://example.test').search;
    const resolved = await resolveCardSelectionQuery(
      search,
      async (cardId) => publishedCards.find((card) => card.id === cardId),
    );

    expect(resolved).toBe('hana-wonder-2.0');
    expect(calls).toEqual([[null, '', detailUrl]]);
  });
});

describe('published card selection corpus', () => {
  test('round-trips every published ID through the canonical navigation grammar', () => {
    const dottedIds = publishedCards
      .map((card) => card.id)
      .filter((id) => id.includes('.'));
    expect(publishedCards).toHaveLength(publishedSummary.meta.totalCards);
    expect(dottedIds).toHaveLength(8);

    for (const { id } of publishedCards) {
      const detailUrl = buildCardSelectionUrl(
        { pathname: '/cards', search: '', hash: '#main-content' },
        id,
      );
      const detail = new URL(detailUrl, 'https://example.test');
      expect(parseCardSelectionQuery(detail.search)).toBe(id);
      expect(detail.hash).toBe('#main-content');
    }
  });
});
