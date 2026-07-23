const { readFileSync } = require('node:fs');
const path = require('node:path');
const { expect, test } = require('@playwright/test');

const SAFE_FALLBACK_BASE_URL = 'http://127.0.0.1:4173/cherrypicker/';
const publicDataDir = path.join(__dirname, '../apps/web/public/data');
const frameGuardSource = readFileSync(
  path.join(__dirname, '../apps/web/public/scripts/frame-guard.js'),
  'utf8',
);
const publishedSummary = JSON.parse(
  readFileSync(path.join(publicDataDir, 'cards-summary.json'), 'utf8'),
);
const fixtureSummaryCard = publishedSummary.cards[0];
const fixtureIssuer = publishedSummary.issuers.find(
  (issuer) => issuer.id === fixtureSummaryCard.issuer,
);
const publishedDetail = JSON.parse(
  readFileSync(
    path.join(
      publicDataDir,
      'card-details',
      `${fixtureSummaryCard.issuer}.json`,
    ),
    'utf8',
  ),
);
const fixtureRule = publishedDetail.cards.find(
  (rule) => rule.card.id === fixtureSummaryCard.id,
);

if (!fixtureIssuer || !fixtureRule) {
  throw new Error('Security E2E fixture card is missing from split artifacts');
}

function appUrl(relativePath = '') {
  const base = new URL(
    process.env.PLAYWRIGHT_BASE_URL ?? SAFE_FALLBACK_BASE_URL,
  );
  base.search = '';
  base.hash = '';
  if (!base.pathname.endsWith('/')) base.pathname += '/';
  return new URL(relativePath.replace(/^\/+/, ''), base).toString();
}

function isolatedSummaryArtifact() {
  return {
    meta: {
      ...publishedSummary.meta,
      totalIssuers: 1,
      totalCards: 1,
    },
    issuers: [{ ...fixtureIssuer, cardCount: 1 }],
    cards: [{ ...fixtureSummaryCard }],
  };
}

function isolatedDetailArtifact(url) {
  return {
    sourceHash: publishedDetail.sourceHash,
    issuer: { ...publishedDetail.issuer, cardCount: 1 },
    cards: [
      {
        ...fixtureRule,
        card: { ...fixtureRule.card, url },
      },
    ],
  };
}

async function installSplitCatalogFixture(page, url) {
  await page.route(/\/data\/cards-summary\.json$/, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(isolatedSummaryArtifact()),
    }),
  );
  await page.route(
    new RegExp(
      `/data/card-details/${fixtureSummaryCard.issuer}\\.json$`,
    ),
    (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(isolatedDetailArtifact(url)),
      }),
  );
}

for (const unsafeUrl of [
  'javascript:alert(document.domain)',
  'data:text/html,<script>alert(document.domain)</script>',
]) {
  test(`C1-036 suppresses an official link for ${unsafeUrl.split(':')[0]} URLs`, async ({
    page,
  }) => {
    await installSplitCatalogFixture(page, unsafeUrl);
    await page.goto(
      appUrl(`cards#card=${encodeURIComponent(fixtureSummaryCard.id)}`),
    );

    await expect(page.getByRole('alert')).toBeVisible();
    await expect(
      page.getByRole('link', { name: '공식 카드 페이지' }),
    ).toHaveCount(0);
    await expect(
      page.locator('a[href^="javascript:"], a[href^="data:"]'),
    ).toHaveCount(0);
  });
}

test('C1-036 renders a safe HTTPS official link with opener isolation', async ({
  page,
}) => {
  const safeUrl = 'https://cards.example.test/product?id=1#benefits';
  await installSplitCatalogFixture(page, safeUrl);
  await page.goto(
    appUrl(`cards#card=${encodeURIComponent(fixtureSummaryCard.id)}`),
  );

  const officialLink = page.getByRole('link', {
    name: '공식 카드 페이지',
  });
  await expect(officialLink).toBeVisible();
  await expect(officialLink).toHaveAttribute('href', safeUrl);
  await expect(officialLink).toHaveAttribute('target', '_blank');
  await expect(officialLink).toHaveAttribute('rel', 'noopener noreferrer');
});

test('C1-037 reveals top-level content without ineffective header meta claims', async ({
  page,
}) => {
  await page.goto(appUrl());

  const root = page.locator('html');
  await expect(root).not.toHaveClass(/frame-guard-pending/);
  await expect(root).not.toHaveAttribute('data-frame-blocked', 'true');
  await expect(page.locator('main')).toBeVisible();
  await expect(
    page.locator('meta[http-equiv="X-Frame-Options"]'),
  ).toHaveCount(0);
  await expect(
    page.locator('meta[http-equiv="X-Content-Type-Options"]'),
  ).toHaveCount(0);

  const metaCsp = await page
    .locator('meta[http-equiv="Content-Security-Policy"]')
    .getAttribute('content');
  expect(metaCsp).not.toMatch(/frame-ancestors/i);

  await page
    .getByRole('link', { name: '카드 목록', exact: true })
    .first()
    .click();
  await expect(page).toHaveURL(/\/cards\/?$/);
  await expect(page.getByRole('heading', { name: '카드 목록' })).toBeVisible();
});

test('C1-037 keeps a cross-origin framed application hidden and pointer-inert', async ({
  page,
}) => {
  const targetUrl = appUrl();
  const attackerUrl = new URL(targetUrl);
  attackerUrl.port = attackerUrl.port === '65535' ? '65534' : '65535';
  attackerUrl.pathname = '/cherrypicker-frame-attacker.html';
  attackerUrl.search = '';
  attackerUrl.hash = '';

  expect(attackerUrl.origin).not.toBe(new URL(targetUrl).origin);

  await page.route(targetUrl, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: `<!doctype html>
        <html lang="ko" class="frame-guard-pending">
          <head>
            <style>
              html.frame-guard-pending body {
                visibility: hidden !important;
                pointer-events: none !important;
              }
            </style>
            <script>${frameGuardSource}</script>
          </head>
          <body>
            <button type="button">분석 시작</button>
          </body>
        </html>`,
    }),
  );
  await page.route(attackerUrl.toString(), (route) =>
    route.fulfill({
      status: 200,
      contentType: 'text/html',
      body: `<!doctype html>
        <html lang="en">
          <body>
            <iframe
              id="application-frame"
              title="framed CherryPicker"
              sandbox="allow-scripts allow-same-origin"
              src="${targetUrl}"
            ></iframe>
          </body>
        </html>`,
    }),
  );
  await page.goto(attackerUrl.toString());
  await expect
    .poll(() => page.frames().map((frame) => frame.url()))
    .toContain(targetUrl);

  const framedApp = page.frameLocator('#application-frame');
  const framedRoot = framedApp.locator('html');
  await expect(framedRoot).toHaveClass(/frame-guard-pending/);
  await expect(framedRoot).toHaveAttribute('data-frame-blocked', 'true');
  await expect
    .poll(() =>
      framedApp.locator('body').evaluate((body) => {
        const style = getComputedStyle(body);
        return {
          visibility: style.visibility,
          pointerEvents: style.pointerEvents,
        };
      }),
    )
    .toEqual({ visibility: 'hidden', pointerEvents: 'none' });
  await expect(
    framedApp.locator('button'),
  ).toBeHidden();
});
