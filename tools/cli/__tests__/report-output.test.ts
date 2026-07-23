import { afterEach, describe, expect, test } from 'bun:test';
import {
  chmod,
  lstat,
  mkdtemp,
  mkdir,
  readFile,
  readlink,
  readdir,
  rename,
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

  test('rejects an intermediate output-directory replacement before exclusive creation', async () => {
    const root = await temporaryDirectory();
    const directory = join(root, 'reports');
    const movedDirectory = join(root, 'reports-original');
    const outside = join(root, 'outside');
    const output = join(directory, 'report.html');
    await mkdir(directory);
    await mkdir(outside);

    await expect(
      writeReportOutput(output, 'replacement', {
        testingHooks: {
          afterInitialDestinationCheck: async () => {
            await rename(directory, movedDirectory);
            await symlink(outside, directory);
          },
        },
      }),
    ).rejects.toThrow('실제 디렉토리');

    expect(await readdir(outside)).toEqual([]);
    expect(await readdir(movedDirectory)).toEqual([]);
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

  test('rejects an intermediate output-directory replacement before atomic commit', async () => {
    const root = await temporaryDirectory();
    const directory = join(root, 'reports');
    const movedDirectory = join(root, 'reports-original');
    const outside = join(root, 'outside');
    const output = join(directory, 'report.html');
    await mkdir(directory);
    await mkdir(outside);
    await writeFile(output, 'original');
    await writeFile(join(outside, 'report.html'), 'outside');

    await expect(
      writeReportOutput(output, 'replacement', {
        overwrite: true,
        testingHooks: {
          beforeAtomicRename: async () => {
            await rename(directory, movedDirectory);
            await symlink(outside, directory);
          },
        },
      }),
    ).rejects.toThrow('실제 디렉토리');

    expect(await readFile(join(movedDirectory, 'report.html'), 'utf8')).toBe(
      'original',
    );
    expect(await readFile(join(outside, 'report.html'), 'utf8')).toBe(
      'outside',
    );
    const detachedTemporaryFiles = (await readdir(movedDirectory)).filter(
      (name) => name.includes('.tmp'),
    );
    expect(detachedTemporaryFiles).toHaveLength(1);
    expect(
      await readFile(
        join(movedDirectory, detachedTemporaryFiles[0]!),
        'utf8',
      ),
    ).toBe('');
    expect(
      (await readdir(outside)).filter((name) => name.includes('.tmp')),
    ).toEqual([]);
  });

  test('rejects a group-writable output directory', async () => {
    const root = await temporaryDirectory();
    const directory = join(root, 'shared-reports');
    await mkdir(directory);
    await chmod(directory, 0o770);

    await expect(
      writeReportOutput(join(directory, 'report.html'), 'content'),
    ).rejects.toThrow('그룹이나 다른 사용자');
    expect(await readdir(directory)).toEqual([]);
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
