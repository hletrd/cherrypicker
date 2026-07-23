import { cardIdSchema } from '@cherrypicker/rules/browser';

const CARD_SELECTION_PARAM = 'card';

export interface CardNavigationLocation {
  pathname: string;
  search: string;
  hash: string;
}

export interface CardNavigationHistory {
  readonly state: unknown;
  pushState(data: unknown, unused: string, url: string): void;
}

function cardSelectionParams(search: string): URLSearchParams {
  const fragmentIndex = search.indexOf('#');
  const query = fragmentIndex === -1 ? search : search.slice(0, fragmentIndex);
  return new URLSearchParams(query.startsWith('?') ? query.slice(1) : query);
}

export function isCardSelectionId(value: string): boolean {
  return cardIdSchema.safeParse(value).success;
}

export function parseCardSelectionQuery(search: string): string | null {
  const values = cardSelectionParams(search).getAll(CARD_SELECTION_PARAM);
  if (values.length !== 1) return null;
  const [cardId] = values;
  return cardId && isCardSelectionId(cardId) ? cardId : null;
}

export async function resolveCardSelectionQuery(
  search: string,
  lookup: (cardId: string) => Promise<unknown | null | undefined>,
): Promise<string | null> {
  const candidate = parseCardSelectionQuery(search);
  if (!candidate) return null;
  return (await lookup(candidate)) ? candidate : null;
}

export function buildCardSelectionUrl(
  current: CardNavigationLocation,
  cardId: string | null,
): string {
  if (cardId !== null && !isCardSelectionId(cardId)) {
    throw new TypeError(`Invalid card selection ID: ${cardId}`);
  }

  const params = cardSelectionParams(current.search);
  if (cardId === null) params.delete(CARD_SELECTION_PARAM);
  else params.set(CARD_SELECTION_PARAM, cardId);

  const query = params.toString();
  return `${current.pathname}${query ? `?${query}` : ''}${current.hash}`;
}

export function pushCardSelectionHistory(
  history: CardNavigationHistory,
  current: CardNavigationLocation,
  cardId: string | null,
): string {
  const nextUrl = buildCardSelectionUrl(current, cardId);
  history.pushState(history.state, '', nextUrl);
  return nextUrl;
}
