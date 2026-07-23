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

interface TrustedDirectory {
  canonicalPath: string;
  device: number;
  inode: number;
  handle: FileHandle;
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

function sameDirectoryIdentity(
  status: Pick<Stats, 'dev' | 'ino'>,
  directory: TrustedDirectory,
): boolean {
  return status.dev === directory.device && status.ino === directory.inode;
}

async function assertTrustedDirectoryChain(path: string): Promise<void> {
  const effectiveUserId =
    typeof process.geteuid === 'function' ? process.geteuid() : undefined;
  if (effectiveUserId === undefined) {
    throw new Error(
      '이 플랫폼에서는 안전한 보고서 출력 디렉토리를 확인할 수 없습니다.',
    );
  }

  let current = path;
  while (true) {
    const status = await lstat(current);
    if (status.isSymbolicLink() || !status.isDirectory()) {
      throw new Error(
        `보고서 출력 디렉토리 경로는 실제 디렉토리여야 합니다: ${current}`,
      );
    }
    if (status.uid !== effectiveUserId && status.uid !== 0) {
      throw new Error(
        `보고서 출력 디렉토리 경로의 소유자를 신뢰할 수 없습니다: ${current}\n` +
          '현재 사용자 소유의 전용 디렉토리를 출력 경로로 지정하세요.',
      );
    }
    const writableByOtherPrincipal = (status.mode & 0o022) !== 0;
    const trustedStickySystemDirectory =
      status.uid === 0 && (status.mode & 0o1000) !== 0;
    if (writableByOtherPrincipal && !trustedStickySystemDirectory) {
      throw new Error(
        `보고서 출력 디렉토리 경로는 그룹이나 다른 사용자가 쓸 수 없어야 합니다: ${current}`,
      );
    }
    if (current === dirname(current)) break;
    current = dirname(current);
  }
}

async function openTrustedDirectory(path: string): Promise<TrustedDirectory> {
  await assertTrustedDirectoryChain(path);
  const handle = await open(
    path,
    constants.O_RDONLY |
      (constants.O_DIRECTORY ?? 0) |
      (constants.O_NOFOLLOW ?? 0),
  );
  try {
    const [handleStatus, pathStatus, canonicalPath] = await Promise.all([
      handle.stat(),
      lstat(path),
      realpath(path),
    ]);
    if (
      !handleStatus.isDirectory() ||
      pathStatus.isSymbolicLink() ||
      !pathStatus.isDirectory() ||
      handleStatus.dev !== pathStatus.dev ||
      handleStatus.ino !== pathStatus.ino ||
      canonicalPath !== path
    ) {
      throw new Error(
        `보고서 출력 디렉토리가 확인 중 변경되었습니다: ${path}`,
      );
    }
    return {
      canonicalPath: path,
      device: handleStatus.dev,
      inode: handleStatus.ino,
      handle,
    };
  } catch (error) {
    await handle.close().catch(() => undefined);
    throw error;
  }
}

async function assertTrustedDirectory(
  directory: TrustedDirectory,
): Promise<void> {
  await assertTrustedDirectoryChain(directory.canonicalPath);
  const [handleStatus, pathStatus, canonicalPath] = await Promise.all([
    directory.handle.stat(),
    lstat(directory.canonicalPath),
    realpath(directory.canonicalPath),
  ]);
  if (
    !handleStatus.isDirectory() ||
    pathStatus.isSymbolicLink() ||
    !pathStatus.isDirectory() ||
    !sameDirectoryIdentity(handleStatus, directory) ||
    !sameDirectoryIdentity(pathStatus, directory) ||
    canonicalPath !== directory.canonicalPath
  ) {
    throw new Error(
      `보고서 출력 디렉토리가 작업 중 변경되었습니다: ${directory.canonicalPath}`,
    );
  }
}

async function syncTrustedDirectory(
  directory: TrustedDirectory,
): Promise<void> {
  await assertTrustedDirectory(directory);
  try {
    await directory.handle.sync();
  } catch (error) {
    const code =
      error instanceof Error && 'code' in error
        ? (error as NodeJS.ErrnoException).code
        : undefined;
    if (!['EBADF', 'EINVAL', 'ENOTSUP'].includes(code ?? '')) throw error;
  }
}

async function canonicalDestination(outputPath: string): Promise<{
  destination: string;
  directory: TrustedDirectory;
}> {
  if (outputPath.trim().length === 0 || outputPath.includes('\u0000')) {
    throw new Error('보고서 출력 파일 경로를 지정하세요.');
  }
  const absolute = resolve(outputPath);
  const canonicalParent = await realpath(dirname(absolute));
  return {
    destination: join(canonicalParent, basename(absolute)),
    directory: await openTrustedDirectory(canonicalParent),
  };
}

async function writeExclusive(
  path: string,
  contents: string,
  directory: TrustedDirectory,
): Promise<void> {
  await assertTrustedDirectory(directory);
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
  await syncTrustedDirectory(directory);
}

async function writeAtomicReplacement(
  destination: string,
  contents: string,
  directory: TrustedDirectory,
  hooks: ReportOutputTestingHooks | undefined,
): Promise<void> {
  const temporary = join(
    dirname(destination),
    `.${basename(destination)}.${process.pid}.${randomBytes(12).toString('hex')}.tmp`,
  );
  let handle: FileHandle | undefined;
  let temporaryExists = false;
  let operationError: unknown;
  try {
    await assertTrustedDirectory(directory);
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

    // Re-check immediately before rename. rename(2) replaces the directory
    // entry itself, so a final-component symlink introduced after this check is
    // replaced rather than followed.
    assertRegularDestination(
      destination,
      await destinationStatus(destination),
    );
    await hooks?.beforeAtomicRename?.(destination);
    await assertTrustedDirectory(directory);
    await handle.close();
    handle = undefined;
    await rename(temporary, destination);
    temporaryExists = false;
    await syncTrustedDirectory(directory);
  } catch (error) {
    operationError = error;
  }

  const cleanupErrors: unknown[] = [];
  let directoryStillTrusted = false;
  if (temporaryExists) {
    try {
      await assertTrustedDirectory(directory);
      directoryStillTrusted = true;
    } catch {
      // Keep using the retained file handle to remove payload bytes. Never
      // unlink through a pathname that now resolves through a replacement.
    }
  }
  if (handle) {
    if (temporaryExists && !directoryStillTrusted) {
      try {
        await handle.truncate(0);
        await handle.sync();
      } catch (error) {
        cleanupErrors.push(error);
      }
    }
    try {
      await handle.close();
    } catch (error) {
      cleanupErrors.push(error);
    }
    handle = undefined;
  }
  if (temporaryExists && directoryStillTrusted) {
    try {
      await unlink(temporary);
      temporaryExists = false;
    } catch (error) {
      cleanupErrors.push(error);
    }
  }

  if (cleanupErrors.length > 0) {
    throw new AggregateError(
      operationError === undefined
        ? cleanupErrors
        : [operationError, ...cleanupErrors],
      `임시 보고서 출력 파일 정리에 실패했습니다: ${temporary}`,
    );
  }
  if (operationError !== undefined) throw operationError;
}

export async function writeReportOutput(
  outputPath: string,
  contents: string,
  options: WriteReportOutputOptions = {},
): Promise<void> {
  const { destination, directory } = await canonicalDestination(outputPath);
  try {
    const current = await destinationStatus(destination);
    assertRegularDestination(destination, current);
    await options.testingHooks?.afterInitialDestinationCheck?.(destination);
    await assertTrustedDirectory(directory);

    if (current && !options.overwrite) {
      throw new Error(
        `보고서 출력 파일이 이미 존재합니다. 덮어쓰려면 --force를 사용하세요: ${destination}`,
      );
    }

    if (options.overwrite) {
      await writeAtomicReplacement(
        destination,
        contents,
        directory,
        options.testingHooks,
      );
      return;
    }
    await writeExclusive(destination, contents, directory);
  } finally {
    await directory.handle.close().catch(() => undefined);
  }
}
