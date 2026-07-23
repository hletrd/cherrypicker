const { expect, test } = require('@playwright/test');
const path = require('node:path');

const BASE =
  process.env.PLAYWRIGHT_BASE_URL ??
  'http://127.0.0.1:4173/cherrypicker/';
const STABLE_STYLE = path.join(__dirname, 'visual-regression.css');

async function waitForHydration(page) {
  await page.waitForFunction(() => {
    const islands = [...document.querySelectorAll('astro-island')];
    return islands.length > 0 && islands.every((island) => !island.hasAttribute('ssr'));
  });
  await page.evaluate(async () => {
    await document.fonts.ready;
  });
}

test('mobile home hero keeps its bounded visual layout', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto(BASE);
  await waitForHydration(page);

  const hero = page.getByTestId('home-hero');
  await expect(hero).toBeVisible();
  await expect(hero).toHaveScreenshot('home-hero-mobile.png', {
    stylePath: STABLE_STYLE,
  });
});

test('card tile keeps its visual structure', async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 900 });
  await page.goto(new URL('cards', BASE).toString());
  await waitForHydration(page);

  const firstCard = page.getByTestId('card-grid-card').first();
  await expect(firstCard).toBeVisible();
  await expect(firstCard).toHaveScreenshot('card-tile.png', {
    stylePath: STABLE_STYLE,
  });
});
