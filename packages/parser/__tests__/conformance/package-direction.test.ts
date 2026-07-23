import { describe, expect, test } from 'bun:test';
import {
  existsSync,
  readdirSync,
  readFileSync,
} from 'node:fs';
import {
  dirname,
  extname,
  join,
  relative,
  resolve,
  sep,
} from 'node:path';

const REPO_ROOT = resolve(import.meta.dir, '../../../..');
const SOURCE_EXTENSIONS = new Set([
  '.cjs',
  '.js',
  '.jsx',
  '.mjs',
  '.ts',
  '.tsx',
]);
const MODULE_SPECIFIER_PATTERN =
  /(?:\bfrom|\bimport\s*\(|\bimport|\brequire\s*\()\s*['"]([^'"]+)['"]/gu;

function sourceFiles(directory: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...sourceFiles(path));
    } else if (entry.isFile() && SOURCE_EXTENSIONS.has(extname(entry.name))) {
      files.push(path);
    }
  }
  return files;
}

function packageModuleFiles(): string[] {
  const files: string[] = [];
  const packagesDirectory = join(REPO_ROOT, 'packages');
  for (const workspace of readdirSync(packagesDirectory, {
    withFileTypes: true,
  })) {
    if (!workspace.isDirectory()) continue;
    for (const directoryName of ['src', '__tests__', 'test', 'tests']) {
      const directory = join(packagesDirectory, workspace.name, directoryName);
      if (existsSync(directory)) files.push(...sourceFiles(directory));
    }
  }
  return files;
}

function appImportViolations(): string[] {
  const violations: string[] = [];
  for (const file of packageModuleFiles()) {
    const source = readFileSync(file, 'utf8');
    for (const match of source.matchAll(MODULE_SPECIFIER_PATTERN)) {
      const specifier = match[1]!;
      const target = specifier.startsWith('.')
        ? relative(REPO_ROOT, resolve(dirname(file), specifier))
        : null;
      if (
        specifier === ['@cherrypicker', 'web'].join('/')
        || specifier.startsWith(`${['@cherrypicker', 'web'].join('/')}/`)
        || target === 'apps'
        || target?.startsWith(`apps${sep}`)
      ) {
        violations.push(`${relative(REPO_ROOT, file)}: ${specifier}`);
      }
    }
  }
  return violations.sort();
}

describe('workspace dependency direction', () => {
  test('package source and tests never import app modules', () => {
    expect(appImportViolations()).toEqual([]);
  });
});
