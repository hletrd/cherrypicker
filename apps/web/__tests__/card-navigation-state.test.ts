import { describe, expect, test } from 'bun:test';
import {
  buildCardSelectionUrl,
  parseCardSelectionQuery,
  pushCardSelectionHistory,
  resolveCardSelectionQuery,
} from '../src/lib/card-navigation-state.js';

describe('card selection query parsing', () => {
  test.each([
    ['', null],
    ['?issuer=shinhan', null],
    ['?card=shinhan-test-card', 'shinhan-test-card'],
    ['?card=shinhan%2Dtest%2Dcard', 'shinhan-test-card'],
    ['?card=', null],
    ['?card=%E0%A4%A', null],
    ['?card=../../escape', null],
    ['?card=UPPERCASE', null],
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

  test('rejects a malformed card ID instead of constructing an unsafe URL', () => {
    expect(() => buildCardSelectionUrl(current, '../../escape')).toThrow(
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

  test('does not issue a lookup for malformed selection state', async () => {
    let lookupCount = 0;
    const selected = await resolveCardSelectionQuery(
      '?card=../../escape',
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
});
