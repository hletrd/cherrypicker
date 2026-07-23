import { describe, expect, test } from 'bun:test';
import { readFile } from 'node:fs/promises';
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
