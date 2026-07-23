import { afterEach, describe, expect, test } from 'bun:test';
import {
  lstat,
  mkdtemp,
  mkdir,
  readFile,
  readlink,
  readdir,
  rm,
  symlink,
  unlink,
  writeFile,
} from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { writeReportOutput } from '../src/report-output.js';

const temporaryDirectories: string[] = [];

async function temporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'cherrypicker-report-'));
  temporaryDirectories.push(directory);
  return directory;
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

describe('writeReportOutput', () => {
  test('creates a new report exclusively', async () => {
    const directory = await temporaryDirectory();
    const output = join(directory, 'report.html');

    await writeReportOutput(output, '<h1>report</h1>');

    expect(await readFile(output, 'utf8')).toBe('<h1>report</h1>');
    expect((await lstat(output)).isFile()).toBe(true);
  });

  test('allows only one concurrent exclusive creator', async () => {
    const directory = await temporaryDirectory();
    const output = join(directory, 'report.html');

    const outcomes = await Promise.allSettled([
      writeReportOutput(output, 'first'),
      writeReportOutput(output, 'second'),
    ]);

    expect(outcomes.filter(({ status }) => status === 'fulfilled')).toHaveLength(1);
    expect(['first', 'second']).toContain(await readFile(output, 'utf8'));
  });

  test('does not follow a symlink swapped in between validation and exclusive open', async () => {
    const directory = await temporaryDirectory();
    const target = join(directory, 'target.html');
    const output = join(directory, 'report.html');
    await writeFile(target, 'target-content');

    await expect(
      writeReportOutput(output, 'replacement', {
        testingHooks: {
          afterInitialDestinationCheck: async () => {
            await symlink(target, output);
          },
        },
      }),
    ).rejects.toThrow();

    expect(await readFile(target, 'utf8')).toBe('target-content');
    expect((await lstat(output)).isSymbolicLink()).toBe(true);
    expect(await readlink(output)).toBe(target);
  });

  test('rejects an existing regular file unless overwrite is explicit', async () => {
    const directory = await temporaryDirectory();
    const output = join(directory, 'report.html');
    await writeFile(output, 'original');

    await expect(writeReportOutput(output, 'replacement')).rejects.toThrow(
      '--force',
    );
    expect(await readFile(output, 'utf8')).toBe('original');
  });

  test('atomically replaces an existing regular file with overwrite enabled', async () => {
    const directory = await temporaryDirectory();
    const output = join(directory, 'report.html');
    await writeFile(output, 'original');

    await writeReportOutput(output, 'replacement', { overwrite: true });

    expect(await readFile(output, 'utf8')).toBe('replacement');
    expect(await readdir(directory)).toEqual(['report.html']);
  });

  test('atomic replacement never follows a symlink swapped in after the final check', async () => {
    const directory = await temporaryDirectory();
    const target = join(directory, 'target.html');
    const output = join(directory, 'report.html');
    await writeFile(target, 'target-content');
    await writeFile(output, 'original');

    await writeReportOutput(output, 'replacement', {
      overwrite: true,
      testingHooks: {
        beforeAtomicRename: async () => {
          await unlink(output);
          await symlink(target, output);
        },
      },
    });

    expect(await readFile(target, 'utf8')).toBe('target-content');
    expect(await readFile(output, 'utf8')).toBe('replacement');
    expect((await lstat(output)).isFile()).toBe(true);
  });

  test.each([false, true])(
    'rejects an existing symlink without changing its target (overwrite=%s)',
    async (overwrite) => {
      const directory = await temporaryDirectory();
      const target = join(directory, 'target.html');
      const output = join(directory, 'report.html');
      await writeFile(target, 'target-content');
      await symlink(target, output);

      await expect(
        writeReportOutput(output, 'attacker-content', { overwrite }),
      ).rejects.toThrow('심볼릭 링크');

      expect(await readFile(target, 'utf8')).toBe('target-content');
      expect((await lstat(output)).isSymbolicLink()).toBe(true);
      expect(await readlink(output)).toBe(target);
    },
  );

  test('rejects a dangling symlink even with overwrite enabled', async () => {
    const directory = await temporaryDirectory();
    const missingTarget = join(directory, 'missing.html');
    const output = join(directory, 'report.html');
    await symlink(missingTarget, output);

    await expect(
      writeReportOutput(output, 'replacement', { overwrite: true }),
    ).rejects.toThrow('심볼릭 링크');

    expect((await lstat(output)).isSymbolicLink()).toBe(true);
    expect(await readlink(output)).toBe(missingTarget);
  });

  test('rejects a non-regular destination', async () => {
    const directory = await temporaryDirectory();
    const output = join(directory, 'report.html');
    await mkdir(output);

    await expect(
      writeReportOutput(output, 'replacement', { overwrite: true }),
    ).rejects.toThrow('일반 파일');
  });
});
