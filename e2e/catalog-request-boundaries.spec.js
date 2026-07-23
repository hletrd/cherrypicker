const path = require('node:path');
const { readFileSync } = require('node:fs');
const { expect, test } = require('@playwright/test');

const SAFE_FALLBACK_BASE_URL = 'http://127.0.0.1:4173/cherrypicker/';
const uploadFixture = path.join(__dirname, 'fixtures', 'regression-upload.csv');
const summaryArtifact = JSON.parse(
  readFileSync(
    path.join(__dirname, '../apps/web/public/data/cards-summary.json'),
    'utf8',
  ),
);

function appUrl(relativePath = '') {
  const base = new URL(
    process.env.PLAYWRIGHT_BASE_URL ?? SAFE_FALLBACK_BASE_URL,
  );
  base.search = '';
  base.hash = '';
  if (!base.pathname.endsWith('/')) base.pathname += '/';
  return new URL(relativePath.replace(/^\/+/, ''), base).toString();
}

function classifyCatalogRequest(url) {
  const pathname = new URL(url).pathname;

  if (/\/data\/cards-summary\.json$/.test(pathname)) {
    return { kind: 'summary', pathname };
  }
  if (/\/data\/cards-optimizer\.json$/.test(pathname)) {
    return { kind: 'optimizer', pathname };
  }
  if (/\/data\/cards\.json$/.test(pathname)) {
    return { kind: 'legacy', pathname };
  }

  const detailMatch = pathname.match(
    /\/data\/card-details\/([a-z0-9][a-z0-9-]*)\.json$/,
  );
  if (detailMatch) {
    return { kind: 'detail', pathname, issuer: detailMatch[1] };
  }

  return null;
}

function collectCatalogRequests(page) {
  const requests = [];
  page.on('request', (request) => {
    const catalogRequest = classifyCatalogRequest(request.url());
    if (catalogRequest) requests.push(catalogRequest);
  });
  return requests;
}

function requestsOfKind(requests, kind) {
  return requests.filter((request) => request.kind === kind);
}

test('card list and one detail stay on split catalog artifacts', async ({
  page,
}) => {
  const requests = collectCatalogRequests(page);

  await page.goto(appUrl('cards'));
  await expect(page.getByRole('heading', { name: '카드 목록' })).toBeVisible();

  const cardButtons = page.getByTestId('card-grid-card');
  await expect(cardButtons.first()).toBeVisible();

  const renderedCardCount = await cardButtons.count();
  expect(renderedCardCount).toBeGreaterThan(0);
  expect(renderedCardCount).toBeLessThanOrEqual(36);
  expect(requestsOfKind(requests, 'summary')).toHaveLength(1);
  expect(requestsOfKind(requests, 'detail')).toHaveLength(0);
  expect(requestsOfKind(requests, 'optimizer')).toHaveLength(0);
  expect(requestsOfKind(requests, 'legacy')).toHaveLength(0);

  await cardButtons.first().click();
  await page.waitForFunction(() => window.location.hash.length > 1);

  const selectedCardId = decodeURIComponent(new URL(page.url()).hash.slice(1));
  const selectedCard = summaryArtifact.cards.find(
    (card) => card.id === selectedCardId,
  );
  expect(selectedCard).toBeTruthy();

  await expect(
    page.getByRole('heading', {
      level: 1,
      name: selectedCard.nameKo,
      exact: true,
    }),
  ).toBeVisible();

  expect(
    requestsOfKind(requests, 'detail').map((request) => request.issuer),
  ).toEqual([selectedCard.issuer]);
  expect(requestsOfKind(requests, 'summary')).toHaveLength(1);
  expect(requestsOfKind(requests, 'optimizer')).toHaveLength(0);
  expect(requestsOfKind(requests, 'legacy')).toHaveLength(0);
});

test('upload analysis fetches one optimizer artifact and never legacy data', async ({
  page,
}) => {
  const requests = collectCatalogRequests(page);

  await page.goto(appUrl());
  await page.waitForFunction(() =>
    Boolean(document.querySelector('astro-island:not([ssr])')),
  );
  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles(uploadFixture);
  await page.getByRole('spinbutton').fill('300000');
  await page.getByRole('button', { name: /^분석 시작/ }).click();
  const dashboardAction = page.getByRole('button', { name: '대시보드 보기' });
  await expect(dashboardAction).toBeVisible({ timeout: 30_000 });
  await expect(dashboardAction).toBeFocused();
  await dashboardAction.click();
  await page.waitForURL('**/dashboard', { timeout: 30_000 });
  await expect(
    page.getByRole('heading', { name: '내 지출 분석' }),
  ).toBeVisible();
  await expect(page.locator('#dashboard-data-content')).toBeVisible();

  const optimizerRequestCount = requestsOfKind(
    requests,
    'optimizer',
  ).length;
  expect(optimizerRequestCount).toBeGreaterThan(0);
  expect(optimizerRequestCount).toBeLessThanOrEqual(1);
  expect(requestsOfKind(requests, 'legacy')).toHaveLength(0);
});
