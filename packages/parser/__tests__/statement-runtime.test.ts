import { describe, expect, test } from 'bun:test';
import {
  existsSync,
  readFileSync,
} from 'node:fs';
import { readFile } from 'node:fs/promises';
import {
  dirname,
  resolve,
} from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  FILE_FORMAT_SNIFF_BYTES,
  decodeBuffer,
  detectBank,
  detectEncoding,
} from '../src/detect.js';
import { parseCSV } from '../src/csv/index.js';
import { parseStatement } from '../src/statement.js';

const statementEntry = fileURLToPath(
  new URL('../src/statement.ts', import.meta.url),
);
const cliEntry = fileURLToPath(
  new URL('../../../tools/cli/src/index.ts', import.meta.url),
);
const kbFixture = fileURLToPath(
  new URL('./fixtures/sample-kb.csv', import.meta.url),
);

function collectStaticRuntimeGraph(entry: string): {
  files: Set<string>;
  externalSpecifiers: Set<string>;
} {
  const files = new Set<string>();
  const externalSpecifiers = new Set<string>();
  const pending = [entry];
  const staticImport =
    /^\s*(?:import|export)\s+(?!type\b)(?:[^;]*?\sfrom\s+)?['"]([^'"]+)['"];/gm;

  while (pending.length > 0) {
    const file = pending.pop()!;
    if (files.has(file)) continue;
    files.add(file);

    const source = readFileSync(file, 'utf-8');
    for (const match of source.matchAll(staticImport)) {
      const specifier = match[1]!;
      if (!specifier.startsWith('.')) {
        externalSpecifiers.add(specifier);
        continue;
      }

      const importedPath = resolve(dirname(file), specifier);
      const sourcePath = importedPath.endsWith('.js')
        ? `${importedPath.slice(0, -3)}.ts`
        : importedPath;
      if (existsSync(sourcePath)) {
        pending.push(sourcePath);
      }
    }
  }

  return { files, externalSpecifiers };
}

describe('lazy statement dispatch boundary', () => {
  test('the eager CSV dispatch graph excludes XLSX, PDF, and Anthropic', () => {
    const cliGraph = collectStaticRuntimeGraph(cliEntry);
    expect(cliGraph.externalSpecifiers).toContain(
      '@cherrypicker/parser/statement',
    );
    expect(cliGraph.externalSpecifiers).not.toContain('@cherrypicker/parser');

    const parserGraph = collectStaticRuntimeGraph(statementEntry);
    expect(
      [...parserGraph.files].some((file) =>
        /\/packages\/parser\/src\/(?:xlsx|pdf)\//.test(file)
      ),
    ).toBe(false);
    expect(
      [...parserGraph.externalSpecifiers].filter((specifier) =>
        ['xlsx', 'pdf-parse', 'unpdf', '@anthropic-ai/sdk'].includes(specifier)
      ),
    ).toEqual(
      [],
    );
  });
});

describe('statement read orchestration', () => {
  test('a known CSV uses one complete read and preserves parse output', async () => {
    const bytes = await readFile(kbFixture);
    let completeReads = 0;
    let prefixReads = 0;

    const result = await parseStatement(
      kbFixture,
      undefined,
      {
        readFile: async () => {
          completeReads++;
          return bytes;
        },
        readPrefix: async () => {
          prefixReads++;
          return bytes.subarray(0, FILE_FORMAT_SNIFF_BYTES);
        },
      },
    );

    const encoding = detectEncoding(bytes);
    const content = decodeBuffer(bytes, encoding);
    const expected = parseCSV(
      content,
      detectBank(content).bank ?? undefined,
    );
    for (const error of expected.errors) {
      error.file ??= kbFixture;
      error.format ??= expected.format;
    }

    expect(result).toEqual(expected);
    expect(completeReads).toBe(1);
    expect(prefixReads).toBe(0);
  });

  test('unknown extensions sniff only a bounded prefix before one complete read', async () => {
    const bytes = await readFile(kbFixture);
    const requestedPrefixSizes: number[] = [];
    let completeReads = 0;

    const result = await parseStatement(
      'statement.data',
      undefined,
      {
        readFile: async () => {
          completeReads++;
          return bytes;
        },
        readPrefix: async (_filePath, maxBytes) => {
          requestedPrefixSizes.push(maxBytes);
          return bytes.subarray(0, maxBytes);
        },
      },
    );

    expect(result.format).toBe('csv');
    expect(result.transactions.length).toBeGreaterThan(0);
    expect(requestedPrefixSizes).toEqual([FILE_FORMAT_SNIFF_BYTES]);
    expect(FILE_FORMAT_SNIFF_BYTES).toBeLessThan(bytes.length);
    expect(completeReads).toBe(1);
  });

  test('PDF dispatch parses the injected complete bytes without reopening the path', async () => {
    const bytes = Buffer.from('%PDF-1.4\ncaptured-invalid-pdf');
    let completeReads = 0;

    const result = await parseStatement(
      '/definitely/replaced-or-missing/statement.pdf',
      undefined,
      {
        readFile: async () => {
          completeReads++;
          return bytes;
        },
      },
    );

    expect(completeReads).toBe(1);
    expect(result.format).toBe('pdf');
    expect(result.transactions).toEqual([]);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]?.message).toContain('PDF 텍스트 추출 실패');
    expect(result.errors[0]?.message).not.toContain('ENOENT');
  });
});
