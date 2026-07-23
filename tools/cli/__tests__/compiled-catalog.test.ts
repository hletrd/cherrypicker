import { describe, expect, test } from 'bun:test';
import {
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import {
  loadCardRule,
  loadCategories,
} from '@cherrypicker/rules';
import {
  DEFAULT_OPTIMIZER_CATALOG_PATH,
  authoringCatalogDisclosure,
  loadCliCardCatalog,
} from '../src/card-catalog.js';
import { sanitizeTerminalText } from '../src/terminal.js';
import { readOptimizerCatalog } from '../../../apps/web/src/lib/card-catalog-reader.js';

describe('compiled CLI card catalog', () => {
  test('uses the web optimizer artifact by default with an identical normalized graph', async () => {
    const raw = JSON.parse(
      await readFile(DEFAULT_OPTIMIZER_CATALOG_PATH, 'utf8'),
    ) as unknown;
    const [cliCatalog, webCatalog] = await Promise.all([
      loadCliCardCatalog(),
      Promise.resolve(readOptimizerCatalog(raw)),
    ]);

    expect(cliCatalog.mode).toBe('compiled');
    if (cliCatalog.mode !== 'compiled') {
      throw new Error('expected compiled catalog mode');
    }
    expect(
      DEFAULT_OPTIMIZER_CATALOG_PATH.endsWith(
        'apps/web/public/data/cards-optimizer.json',
      ),
    ).toBe(true);
    expect(cliCatalog.sourceHash).toBe(webCatalog.sourceHash);
    expect(cliCatalog.cards).toEqual(webCatalog.cards);
    expect(
      cliCatalog.cards.some((card) => card.card.discontinued === true),
    ).toBe(false);
  });

  test('rejects either authoring source without its semantic pair', async () => {
    const categories = await loadCategories(
      resolve(
        import.meta.dir,
        '../../../packages/rules/data/categories.yaml',
      ),
    );

    await expect(
      loadCliCardCatalog(undefined, categories),
    ).rejects.toThrow('함께 지정');
    await expect(
      loadCliCardCatalog('cards-without-categories'),
    ).rejects.toThrow('함께 지정');
  });

  test('sorts custom rules by card ID and excludes discontinued cards', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'cli-catalog-order-'));
    try {
      const dataDir = resolve(import.meta.dir, '../../../packages/rules/data');
      const [base, categories] = await Promise.all([
        loadCardRule(join(dataDir, 'cards/shinhan/simple-plan.yaml')),
        loadCategories(join(dataDir, 'categories.yaml')),
      ]);
      const zCard = structuredClone(base);
      zCard.card.id = 'fixture-z-card';
      const aCard = structuredClone(base);
      aCard.card.id = 'fixture-a-card';
      const discontinued = structuredClone(base);
      discontinued.card.id = 'fixture-m-discontinued';
      discontinued.card.discontinued = true;

      for (const [subdirectory, card] of [
        ['z-first-created', zCard],
        ['a-second-created', aCard],
        ['m-third-created', discontinued],
      ] as const) {
        const targetDirectory = join(directory, subdirectory);
        await mkdir(targetDirectory);
        await writeFile(
          join(targetDirectory, 'card.yaml'),
          JSON.stringify(card),
        );
      }

      const catalog = await loadCliCardCatalog(directory, categories);
      expect(catalog.mode).toBe('authoring');
      expect(catalog.cards.map((card) => card.card.id)).toEqual([
        'fixture-a-card',
        'fixture-z-card',
      ]);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  test('semantically rejects supported annual caps in custom catalogs', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'cli-annual-cap-'));
    try {
      const dataDir = resolve(import.meta.dir, '../../../packages/rules/data');
      const [base, categories] = await Promise.all([
        loadCardRule(join(dataDir, 'cards/shinhan/simple-plan.yaml')),
        loadCategories(join(dataDir, 'categories.yaml')),
      ]);
      base.card.id = 'fixture-annual-cap';
      base.rewards[0]!.tiers[0]!.annualCap = 1_000;
      const file = join(directory, 'annual-cap.yaml');
      await writeFile(file, JSON.stringify(base));

      await expect(
        loadCliCardCatalog(directory, categories),
      ).rejects.toThrow(/positive annualCap/);

      base.rewards[0]!.support = {
        status: 'unsupported',
        reason: 'year-to-date reward usage is not available',
      };
      await writeFile(file, JSON.stringify(base));
      const catalog = await loadCliCardCatalog(directory, categories);
      expect(catalog.cards).toHaveLength(1);
      expect(
        catalog.cards[0]?.rewards[0]?.support.status,
      ).toBe('unsupported');
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  test('rejects future freshness and duplicate tiers in custom catalogs', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'cli-catalog-truth-'));
    try {
      const dataDir = resolve(import.meta.dir, '../../../packages/rules/data');
      const [base, categories] = await Promise.all([
        loadCardRule(join(dataDir, 'cards/shinhan/simple-plan.yaml')),
        loadCategories(join(dataDir, 'categories.yaml')),
      ]);
      base.card.id = 'fixture-catalog-truth';
      base.card.lastUpdated = '2026-07-24';
      const file = join(directory, 'card.yaml');
      await writeFile(file, JSON.stringify(base));

      await expect(
        loadCliCardCatalog(
          directory,
          categories,
          () => new Date('2026-07-23T23:59:59.999Z'),
        ),
      ).rejects.toThrow(
        /lastUpdated "2026-07-24" is after validation date "2026-07-23"/,
      );

      base.card.lastUpdated = '2026-07-23';
      base.rewards[0]!.tiers.push({
        ...base.rewards[0]!.tiers[0]!,
      });
      await writeFile(file, JSON.stringify(base));
      try {
        await loadCliCardCatalog(
          directory,
          categories,
          () => new Date('2026-07-23T23:59:59.999Z'),
        );
        throw new Error('expected duplicate tier rejection');
      } catch (error) {
        expect(error).toBeInstanceOf(AggregateError);
        const failures = (error as AggregateError).errors
          .map((failure) => String(failure))
          .join('\n');
        expect(failures).toContain('duplicate performance tier reference');
      }
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  test('authoring override disclosure remains terminal-safe', () => {
    const disclosure = authoringCatalogDisclosure({
      mode: 'authoring',
      cards: [],
      path:
        'cards\u001b]8;;https://example.invalid\u0007LINK\u001b]8;;\u0007' +
        '\u001b[31mCOLOR\u001b[0m\r\n\u202e',
    });
    const rendered = sanitizeTerminalText(disclosure);

    expect(rendered).toContain('작성용 카드 규칙 모드');
    expect(rendered).toContain('LINK');
    expect(rendered).toContain('COLOR');
    expect(rendered).not.toContain('https://example.invalid');
    expect(rendered).not.toMatch(/[\u001b\r\n\u202e]/);
  });
});
