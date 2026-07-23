import { afterEach, describe, expect, test } from 'bun:test';
import type Anthropic from '@anthropic-ai/sdk';
import {
  access,
  chmod,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  realpath,
  rename,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { CardRuleSet } from '@cherrypicker/rules';
import {
  PENDING_SOURCE_REVIEW_REASON,
  parseCardExtractionResponse,
} from '../src/extractor.js';
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

  test('writes model-supported rewards as visibly quarantined YAML', async () => {
    const root = await temporaryRoot();
    const injectedMetadata =
      'sk-ant-api03-page-instruction-ignore-prior-rules';
    const modelRule = makeCardRule();
    Object.assign(modelRule.card, {
      issuer: injectedMetadata,
      source: injectedMetadata,
      lastUpdated: injectedMetadata,
    });
    const quarantined = parseCardExtractionResponse(
      {
        content: [
          {
            type: 'tool_use',
            id: 'tool_test',
            name: 'extract_card_rules',
            input: modelRule,
          },
        ],
        stop_reason: 'end_turn',
      } as Anthropic.Message,
      'shinhan',
      () => new Date('2026-07-23T12:00:00.000Z'),
    );
    const path = await writeCardRule(quarantined, {
      outputDir: root,
      expectedIssuer: 'shinhan',
    });
    const content = await readFile(path, 'utf-8');

    expect(content).toContain('issuer: shinhan');
    expect(content).toContain('source: llm-scrape');
    expect(content).toContain('lastUpdated: 2026-07-23');
    expect(content).toContain('status: unsupported');
    expect(content).toContain(`reason: ${PENDING_SOURCE_REVIEW_REASON}`);
    expect(content).not.toContain(injectedMetadata);
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

  test('rejects an issuer-directory replacement before temporary creation', async () => {
    const root = await temporaryRoot();
    const issuerDir = join(root, 'shinhan');
    const movedIssuerDir = join(root, 'shinhan-original');
    const outside = join(root, 'outside');
    await mkdir(issuerDir);
    await mkdir(outside);

    await expect(
      writeCardRule(
        makeCardRule(),
        { outputDir: root, expectedIssuer: 'shinhan' },
        {
          beforeTemporaryOpen: async () => {
            await rename(issuerDir, movedIssuerDir);
            await symlink(outside, issuerDir);
          },
        },
      ),
    ).rejects.toThrow('실제 디렉토리');

    expect(await readdir(outside)).toEqual([]);
    expect(await readdir(movedIssuerDir)).toEqual([]);
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

  test('rejects an issuer-directory replacement before overwrite commit', async () => {
    const root = await temporaryRoot();
    const issuerDir = join(root, 'shinhan');
    const movedIssuerDir = join(root, 'shinhan-original');
    const outside = join(root, 'outside');
    const destination = join(issuerDir, 'shinhan-security-test.yaml');
    await mkdir(issuerDir);
    await mkdir(outside);
    await writeFile(destination, 'original');
    await writeFile(
      join(outside, 'shinhan-security-test.yaml'),
      'outside',
    );

    await expect(
      writeCardRule(
        makeCardRule(),
        {
          outputDir: root,
          expectedIssuer: 'shinhan',
          overwrite: true,
        },
        {
          beforeCommit: async () => {
            await rename(issuerDir, movedIssuerDir);
            await symlink(outside, issuerDir);
          },
        },
      ),
    ).rejects.toThrow('실제 디렉토리');

    expect(
      await readFile(
        join(movedIssuerDir, 'shinhan-security-test.yaml'),
        'utf8',
      ),
    ).toBe('original');
    expect(
      await readFile(join(outside, 'shinhan-security-test.yaml'), 'utf8'),
    ).toBe('outside');
    const detachedTemporaryFiles = (await readdir(movedIssuerDir)).filter(
      (name) => name.includes('.tmp-'),
    );
    expect(detachedTemporaryFiles).toHaveLength(1);
    expect(
      await readFile(
        join(movedIssuerDir, detachedTemporaryFiles[0]!),
        'utf8',
      ),
    ).toBe('');
    expect(
      (await readdir(outside)).filter((name) => name.includes('.tmp-')),
    ).toEqual([]);
  });

  test('rejects a group-writable output root before creating an issuer directory', async () => {
    const root = await temporaryRoot();
    await chmod(root, 0o770);

    await expect(
      writeCardRule(makeCardRule(), {
        outputDir: root,
        expectedIssuer: 'shinhan',
      }),
    ).rejects.toThrow('그룹이나 다른 사용자');
    expect(await readdir(root)).toEqual([]);
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
