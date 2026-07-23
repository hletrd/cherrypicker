import { constants, type Stats } from 'node:fs';
import {
  lstat,
  open,
  realpath,
  rename,
  unlink,
  type FileHandle,
} from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import { basename, dirname, join, resolve } from 'node:path';

export interface WriteReportOutputOptions {
  overwrite?: boolean;
  /**
   * Deterministic race hooks for the filesystem safety suite. Production
   * callers must leave this unset.
   * @internal
   */
  testingHooks?: ReportOutputTestingHooks;
}

export interface ReportOutputTestingHooks {
  afterInitialDestinationCheck?: (destination: string) => void | Promise<void>;
  beforeAtomicRename?: (destination: string) => void | Promise<void>;
}

async function destinationStatus(path: string): Promise<Stats | undefined> {
  try {
    return await lstat(path);
  } catch (error) {
    if (
      error instanceof Error &&
      'code' in error &&
      error.code === 'ENOENT'
    ) {
      return undefined;
    }
    throw error;
  }
}

function assertRegularDestination(
  path: string,
  status: Stats | undefined,
): void {
  if (!status) return;
  if (status.isSymbolicLink()) {
    throw new Error(`보고서 출력 경로는 심볼릭 링크일 수 없습니다: ${path}`);
  }
  if (!status.isFile()) {
    throw new Error(`보고서 출력 경로는 일반 파일이어야 합니다: ${path}`);
  }
}

async function writeAndSync(handle: FileHandle, contents: string): Promise<void> {
  await handle.writeFile(contents, { encoding: 'utf8' });
  await handle.sync();
}

async function canonicalDestination(outputPath: string): Promise<string> {
  if (outputPath.trim().length === 0 || outputPath.includes('\u0000')) {
    throw new Error('보고서 출력 파일 경로를 지정하세요.');
  }
  const absolute = resolve(outputPath);
  const canonicalParent = await realpath(dirname(absolute));
  return join(canonicalParent, basename(absolute));
}

async function writeExclusive(path: string, contents: string): Promise<void> {
  const flags =
    constants.O_WRONLY |
    constants.O_CREAT |
    constants.O_EXCL |
    constants.O_NOFOLLOW;
  const handle = await open(path, flags, 0o600);
  try {
    await writeAndSync(handle, contents);
  } finally {
    await handle.close();
  }
}

async function writeAtomicReplacement(
  destination: string,
  contents: string,
  hooks: ReportOutputTestingHooks | undefined,
): Promise<void> {
  const temporary = join(
    dirname(destination),
    `.${basename(destination)}.${process.pid}.${randomBytes(12).toString('hex')}.tmp`,
  );
  let handle: FileHandle | undefined;
  let temporaryExists = false;
  try {
    handle = await open(
      temporary,
      constants.O_WRONLY |
        constants.O_CREAT |
        constants.O_EXCL |
        constants.O_NOFOLLOW,
      0o600,
    );
    temporaryExists = true;
    await writeAndSync(handle, contents);
    await handle.close();
    handle = undefined;

    // Re-check immediately before rename. rename(2) replaces the directory
    // entry itself, so a final-component symlink introduced after this check is
    // replaced rather than followed.
    assertRegularDestination(
      destination,
      await destinationStatus(destination),
    );
    await hooks?.beforeAtomicRename?.(destination);
    await rename(temporary, destination);
    temporaryExists = false;
  } finally {
    if (handle) {
      await handle.close().catch(() => undefined);
    }
    if (temporaryExists) {
      await unlink(temporary).catch(() => undefined);
    }
  }
}

export async function writeReportOutput(
  outputPath: string,
  contents: string,
  options: WriteReportOutputOptions = {},
): Promise<void> {
  const destination = await canonicalDestination(outputPath);
  const current = await destinationStatus(destination);
  assertRegularDestination(destination, current);
  await options.testingHooks?.afterInitialDestinationCheck?.(destination);

  if (current && !options.overwrite) {
    throw new Error(
      `보고서 출력 파일이 이미 존재합니다. 덮어쓰려면 --force를 사용하세요: ${destination}`,
    );
  }

  if (options.overwrite) {
    await writeAtomicReplacement(
      destination,
      contents,
      options.testingHooks,
    );
    return;
  }
  await writeExclusive(destination, contents);
}
