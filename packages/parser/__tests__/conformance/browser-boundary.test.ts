import { describe, expect, test } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';

const browserFiles = [
  '../../src/browser.ts',
  '../../src/shared/amount.ts',
  '../../src/shared/date-cell.ts',
  '../../src/shared/encoding.ts',
  '../../src/shared/pdf-text.ts',
  '../../src/shared/sheet-cells.ts',
].map((path) => new URL(path, import.meta.url));

describe('browser parser boundary', () => {
  test('does not directly import Node, PDF extraction, or remote-LLM dependencies', () => {
    const source = browserFiles.map((file) => readFileSync(file, 'utf8')).join('\n');
    expect(source).not.toMatch(
      /(?:node:fs|node:path|fs\/promises|pdf-parse|unpdf|@anthropic-ai\/sdk)/,
    );
  });

  test('web adapters do not redefine corrected parser algorithms', () => {
    const directory = new URL('../../../../apps/web/src/lib/parser/', import.meta.url);
    const source = readdirSync(directory)
      .filter((name) => name.endsWith('.ts'))
      .map((name) => readFileSync(new URL(name, directory), 'utf8'))
      .join('\n');

    expect(source).not.toMatch(
      /fallbackAmountPattern|detectBestEncoding|\b(?:let|const)\s+last(?:Amount|Date)\b/,
    );
  });
});
