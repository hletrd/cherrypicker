import { describe, expect, test } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';

const browserFiles = [
  '../../../packages/parser/src/browser.ts',
  '../../../packages/parser/src/shared/amount.ts',
  '../../../packages/parser/src/shared/date-cell.ts',
  '../../../packages/parser/src/shared/encoding.ts',
  '../../../packages/parser/src/shared/pdf-text.ts',
  '../../../packages/parser/src/shared/sheet-cells.ts',
].map((path) => new URL(path, import.meta.url));

describe('browser parser boundary', () => {
  test('does not directly import Node, PDF extraction, or remote-LLM dependencies', () => {
    const source = browserFiles.map((file) => readFileSync(file, 'utf8')).join('\n');
    expect(source).not.toMatch(
      /(?:node:fs|node:path|fs\/promises|pdf-parse|unpdf|@anthropic-ai\/sdk)/,
    );
  });

  test('web adapters do not redefine corrected parser algorithms', () => {
    const directory = new URL('../src/lib/parser/', import.meta.url);
    const source = readdirSync(directory)
      .filter((name) => name.endsWith('.ts'))
      .map((name) => readFileSync(new URL(name, directory), 'utf8'))
      .join('\n');

    expect(source).not.toMatch(
      /fallbackAmountPattern|detectBestEncoding|\b(?:let|const)\s+last(?:Amount|Date)\b/,
    );
  });
});
