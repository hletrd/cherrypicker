import { describe, expect, test } from 'bun:test';
import {
  mkdir,
  mkdtemp,
  rm,
  utimes,
  writeFile,
} from 'node:fs/promises';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const require = createRequire(import.meta.url);
const {
  coreDistFreshnessFailures,
}: {
  coreDistFreshnessFailures(coreRoot: string): string[];
} = require('../../e2e/core-dist-freshness.js');

describe('direct Playwright core build freshness', () => {
  test('checks optimizer sources as well as the matcher', async () => {
    const root = await mkdtemp(join(tmpdir(), 'core-dist-freshness-'));
    try {
      const sourceOptimizer = join(root, 'src/optimizer');
      const distOptimizer = join(root, 'dist/optimizer');
      const sourceCategorizer = join(root, 'src/categorizer');
      const distCategorizer = join(root, 'dist/categorizer');
      await Promise.all([
        mkdir(sourceOptimizer, { recursive: true }),
        mkdir(distOptimizer, { recursive: true }),
        mkdir(sourceCategorizer, { recursive: true }),
        mkdir(distCategorizer, { recursive: true }),
      ]);
      const paths = {
        sourceGreedy: join(sourceOptimizer, 'greedy.ts'),
        distGreedy: join(distOptimizer, 'greedy.js'),
        sourceMatcher: join(sourceCategorizer, 'matcher.ts'),
        distMatcher: join(distCategorizer, 'matcher.js'),
      };
      await Promise.all([
        writeFile(paths.sourceGreedy, 'export const greedy = true;\n'),
        writeFile(paths.distGreedy, 'export const greedy = true;\n'),
        writeFile(paths.sourceMatcher, 'export const matcher = true;\n'),
        writeFile(paths.distMatcher, 'export const matcher = true;\n'),
      ]);

      const old = new Date('2026-01-01T00:00:00.000Z');
      const current = new Date('2026-01-02T00:00:00.000Z');
      await Promise.all([
        utimes(paths.sourceGreedy, old, current),
        utimes(paths.distGreedy, old, old),
        utimes(paths.sourceMatcher, old, old),
        utimes(paths.distMatcher, old, current),
      ]);

      expect(coreDistFreshnessFailures(root)).toEqual([
        'optimizer/greedy.ts: source is newer than compiled peer',
      ]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  test('reports a missing compiled peer anywhere in the source graph', async () => {
    const root = await mkdtemp(join(tmpdir(), 'core-dist-missing-'));
    try {
      await mkdir(join(root, 'src/analysis'), { recursive: true });
      await mkdir(join(root, 'dist'), { recursive: true });
      await writeFile(
        join(root, 'src/analysis/performance.ts'),
        'export const value = true;\n',
      );

      expect(coreDistFreshnessFailures(root)).toEqual([
        'analysis/performance.ts: compiled peer is missing',
      ]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
