import { afterEach, describe, expect, test } from 'bun:test';
import {
  access,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  realpath,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { CardRuleSet } from '@cherrypicker/rules';
import {
  writeCardRule,
  type WriteCardRuleOperations,
} from '../src/writer.js';
import { makeCardRule } from './fixtures.js';

const temporaryRoots: string[] = [];

async function temporaryRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'cherrypicker-writer-'));
  temporaryRoots.push(root);
  return root;
}

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe('writeCardRule', () => {
  test('writes beneath the local expected-issuer coordinate', async () => {
    const root = await temporaryRoot();
    const path = await writeCardRule(makeCardRule(), {
      outputDir: root,
      expectedIssuer: 'shinhan',
    });

    expect(path).toBe(
      join(await realpath(root), 'shinhan', 'shinhan-security-test.yaml'),
    );
    expect(await readFile(path, 'utf-8')).toContain('id: shinhan-security-test');
  });

  test('uses the trusted rule date for both the header and YAML provenance', async () => {
    const root = await temporaryRoot();
    const path = await writeCardRule(
      makeCardRule({ lastUpdated: '2024-02-29' }),
      {
        outputDir: root,
        expectedIssuer: 'shinhan',
      },
    );
    const content = await readFile(path, 'utf-8');

    expect(content).toContain('# 추출일: 2024-02-29');
    expect(content).toContain('lastUpdated: 2024-02-29');
  });

  test('rejects traversal even if a caller bypasses the type boundary', async () => {
    const root = await temporaryRoot();
    const rule = makeCardRule() as CardRuleSet;
    rule.card.id = '../../../../outside';

    await expect(
      writeCardRule(rule, { outputDir: root, expectedIssuer: 'shinhan' }),
    ).rejects.toThrow('안전하지 않은 카드 ID');
    await expect(access(join(root, 'outside.yaml'))).rejects.toThrow();
  });

  test('rejects model issuer mismatch', async () => {
    const root = await temporaryRoot();
    await expect(
      writeCardRule(makeCardRule({ issuer: 'kb' }), {
        outputDir: root,
        expectedIssuer: 'shinhan',
      }),
    ).rejects.toThrow('카드사 불일치');
  });

  test('rejects an unsupported local issuer before creating output', async () => {
    const root = join(await temporaryRoot(), 'not-created');
    await expect(
      writeCardRule(makeCardRule(), {
        outputDir: root,
        expectedIssuer: '../outside' as 'shinhan',
      }),
    ).rejects.toThrow('지원하지 않는 카드사');
    await expect(access(root)).rejects.toThrow();
  });

  test('rejects an issuer-directory symlink', async () => {
    const root = await temporaryRoot();
    const output = join(root, 'output');
    const outside = join(root, 'outside');
    await mkdir(output);
    await mkdir(outside);
    await symlink(outside, join(output, 'shinhan'));

    await expect(
      writeCardRule(makeCardRule(), {
        outputDir: output,
        expectedIssuer: 'shinhan',
      }),
    ).rejects.toThrow('심볼릭 링크');
    expect(await readFile(join(outside, 'sentinel'), 'utf-8').catch(() => 'missing')).toBe('missing');
  });

  test('rejects a destination symlink even with overwrite enabled', async () => {
    const root = await temporaryRoot();
    const issuerDir = join(root, 'shinhan');
    const outside = join(root, 'outside.yaml');
    await mkdir(issuerDir);
    await writeFile(outside, 'sentinel');
    await symlink(outside, join(issuerDir, 'shinhan-security-test.yaml'));

    await expect(
      writeCardRule(makeCardRule(), {
        outputDir: root,
        expectedIssuer: 'shinhan',
        overwrite: true,
      }),
    ).rejects.toThrow('심볼릭 링크');
    expect(await readFile(outside, 'utf-8')).toBe('sentinel');
  });

  test('preserves an existing file unless overwrite is explicit', async () => {
    const root = await temporaryRoot();
    const issuerDir = join(root, 'shinhan');
    const destination = join(issuerDir, 'shinhan-security-test.yaml');
    await mkdir(issuerDir);
    await writeFile(destination, 'original');

    await expect(
      writeCardRule(makeCardRule(), {
        outputDir: root,
        expectedIssuer: 'shinhan',
      }),
    ).rejects.toThrow('--force');
    expect(await readFile(destination, 'utf-8')).toBe('original');

    await writeCardRule(makeCardRule(), {
      outputDir: root,
      expectedIssuer: 'shinhan',
      overwrite: true,
    });
    expect(await readFile(destination, 'utf-8')).toContain('id: shinhan-security-test');
  });

  async function expectFailureAtomicOverwrite(
    operationOverrides: Partial<WriteCardRuleOperations>,
  ): Promise<void> {
    const root = await temporaryRoot();
    const issuerDir = join(root, 'shinhan');
    const destination = join(issuerDir, 'shinhan-security-test.yaml');
    await mkdir(issuerDir);
    await writeFile(destination, 'original');

    await expect(
      writeCardRule(
        makeCardRule(),
        {
          outputDir: root,
          expectedIssuer: 'shinhan',
          overwrite: true,
        },
        operationOverrides,
      ),
    ).rejects.toThrow();

    expect(await readFile(destination, 'utf-8')).toBe('original');
    expect(
      (await readdir(issuerDir)).filter((name) => name.includes('.tmp-')),
    ).toEqual([]);
  }

  test('preserves the old rule when a write fails before producing bytes', async () => {
    await expectFailureAtomicOverwrite({
      writeFile: async () => {
        throw new Error('injected pre-write failure');
      },
    });
  });

  test('preserves the old rule and removes a partially written temporary file', async () => {
    await expectFailureAtomicOverwrite({
      writeFile: async (handle) => {
        await handle.writeFile('partial', { encoding: 'utf-8' });
        throw new Error('injected partial-write failure');
      },
    });
  });

  test('preserves the old rule when temporary-file sync fails', async () => {
    await expectFailureAtomicOverwrite({
      syncFile: async () => {
        throw new Error('injected sync failure');
      },
    });
  });

  test('preserves the old rule when the atomic rename fails', async () => {
    await expectFailureAtomicOverwrite({
      rename: async () => {
        throw new Error('injected pre-rename failure');
      },
    });
  });

  test('allows exactly one of two concurrent default writes', async () => {
    const root = await temporaryRoot();
    const results = await Promise.allSettled([
      writeCardRule(makeCardRule(), { outputDir: root, expectedIssuer: 'shinhan' }),
      writeCardRule(makeCardRule(), { outputDir: root, expectedIssuer: 'shinhan' }),
    ]);

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
  });
});
