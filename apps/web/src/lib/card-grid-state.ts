export const CARD_GRID_PAGE_SIZE = 36;

export const CARD_GRID_TYPE_FILTERS = [
  'all',
  'credit',
  'check',
  'prepaid',
] as const;

export const CARD_GRID_SORT_ORDERS = [
  'name',
  'fee-asc',
  'fee-desc',
  'rewards',
] as const;

export type CardGridTypeFilter = (typeof CARD_GRID_TYPE_FILTERS)[number];
export type CardGridSortOrder = (typeof CARD_GRID_SORT_ORDERS)[number];

export interface CardGridQueryState {
  search: string;
  type: CardGridTypeFilter;
  issuer: string;
  sort: CardGridSortOrder;
  page: number;
}

export interface CardGridPage<T> {
  items: T[];
  page: number;
  totalPages: number;
  totalItems: number;
  start: number;
  end: number;
}

export const DEFAULT_CARD_GRID_QUERY: Readonly<CardGridQueryState> = {
  search: '',
  type: 'all',
  issuer: '',
  sort: 'name',
  page: 1,
};

const CARD_GRID_QUERY_KEYS = [
  'search',
  'type',
  'issuer',
  'sort',
  'page',
] as const;
const MAX_SEARCH_LENGTH = 200;
const ISSUER_PATTERN = /^[a-z0-9-]+$/;

function includesValue<T extends string>(
  values: readonly T[],
  value: string | null,
): value is T {
  return value !== null && values.includes(value as T);
}

function normalizedSearch(value: unknown): string {
  return typeof value === 'string'
    ? value.trim().slice(0, MAX_SEARCH_LENGTH)
    : '';
}

function normalizedIssuer(value: unknown): string {
  if (typeof value !== 'string') return '';
  const issuer = value.trim().toLowerCase();
  return ISSUER_PATTERN.test(issuer) ? issuer : '';
}

function normalizedPage(value: unknown): number {
  if (typeof value === 'number') {
    return Number.isSafeInteger(value) && value > 0 ? value : 1;
  }
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) return 1;
  const page = Number(value);
  return Number.isSafeInteger(page) ? page : 1;
}

export function readCardGridQuery(
  input: URLSearchParams | string,
): CardGridQueryState {
  const params = typeof input === 'string'
    ? new URLSearchParams(input.startsWith('?') ? input.slice(1) : input)
    : input;
  const type = params.get('type');
  const sort = params.get('sort');
  return {
    search: normalizedSearch(params.get('search')),
    type: includesValue(CARD_GRID_TYPE_FILTERS, type) ? type : 'all',
    issuer: normalizedIssuer(params.get('issuer')),
    sort: includesValue(CARD_GRID_SORT_ORDERS, sort) ? sort : 'name',
    page: normalizedPage(params.get('page')),
  };
}

export function writeCardGridQuery(
  state: CardGridQueryState,
  base?: URLSearchParams,
): URLSearchParams {
  const params = new URLSearchParams(base);
  for (const key of CARD_GRID_QUERY_KEYS) params.delete(key);

  const search = normalizedSearch(state.search);
  const issuer = normalizedIssuer(state.issuer);
  const type = includesValue(CARD_GRID_TYPE_FILTERS, state.type)
    ? state.type
    : 'all';
  const sort = includesValue(CARD_GRID_SORT_ORDERS, state.sort)
    ? state.sort
    : 'name';
  const page = normalizedPage(state.page);

  if (search) params.set('search', search);
  if (type !== 'all') params.set('type', type);
  if (issuer) params.set('issuer', issuer);
  if (sort !== 'name') params.set('sort', sort);
  if (page > 1) params.set('page', String(page));
  return params;
}

export function clampCardGridPage(
  requestedPage: number,
  totalItems: number,
): number {
  const totalPages = Math.max(1, Math.ceil(totalItems / CARD_GRID_PAGE_SIZE));
  const page = normalizedPage(requestedPage);
  return Math.min(page, totalPages);
}

export function getCardGridPage<T>(
  items: readonly T[],
  requestedPage: number,
): CardGridPage<T> {
  const page = clampCardGridPage(requestedPage, items.length);
  const totalPages = Math.max(
    1,
    Math.ceil(items.length / CARD_GRID_PAGE_SIZE),
  );
  const offset = (page - 1) * CARD_GRID_PAGE_SIZE;
  const pageItems = items.slice(offset, offset + CARD_GRID_PAGE_SIZE);
  return {
    items: pageItems,
    page,
    totalPages,
    totalItems: items.length,
    start: pageItems.length > 0 ? offset + 1 : 0,
    end: pageItems.length > 0 ? offset + pageItems.length : 0,
  };
}

export function getCardGridPageNumbers(
  currentPage: number,
  totalPages: number,
): number[] {
  const safeTotal = Math.max(1, normalizedPage(totalPages));
  const page = Math.min(normalizedPage(currentPage), safeTotal);
  const windowSize = 5;
  let start = Math.max(1, page - Math.floor(windowSize / 2));
  const end = Math.min(safeTotal, start + windowSize - 1);
  start = Math.max(1, end - windowSize + 1);
  return Array.from({ length: end - start + 1 }, (_, index) => start + index);
}
