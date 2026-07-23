import { randomUUID } from 'node:crypto';
import { constants, type Stats } from 'node:fs';
import {
  link,
  lstat,
  mkdir,
  open,
  realpath,
  rename,
  unlink,
} from 'node:fs/promises';
import type { FileHandle } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve } from 'node:path';
import { stringify } from 'yaml';
import { cardIdSchema } from '@cherrypicker/rules';
import type { CardRuleSet } from '@cherrypicker/rules';
import type { ScraperIssuer } from './config.js';
import { isScraperIssuer } from './config.js';

export interface WriteCardRuleOptions {
  outputDir: string;
  expectedIssuer: ScraperIssuer;
  overwrite?: boolean;
}

export interface WriteCardRuleOperations {
  open(
    path: string,
    flags: number,
    mode: number,
  ): Promise<FileHandle>;
  writeFile(handle: FileHandle, content: string): Promise<void>;
  syncFile(handle: FileHandle): Promise<void>;
  closeFile(handle: FileHandle): Promise<void>;
  rename(source: string, destination: string): Promise<void>;
  link(source: string, destination: string): Promise<void>;
  unlink(path: string): Promise<void>;
  syncDirectory(handle: FileHandle): Promise<void>;
  beforeTemporaryOpen(path: string): Promise<void>;
  beforeCommit(path: string): Promise<void>;
}

async function syncDirectory(handle: FileHandle): Promise<void> {
  try {
    await handle.sync();
  } catch (error) {
    const code = error instanceof Error && 'code' in error
      ? (error as NodeJS.ErrnoException).code
      : undefined;
    if (!['EBADF', 'EINVAL', 'ENOTSUP'].includes(code ?? '')) {
      throw error;
    }
  }
}

const DEFAULT_WRITE_OPERATIONS: WriteCardRuleOperations = {
  open,
  writeFile: async (handle, content) => {
    await handle.writeFile(content, { encoding: 'utf-8' });
  },
  syncFile: async (handle) => {
    await handle.sync();
  },
  closeFile: async (handle) => {
    await handle.close();
  },
  rename,
  link,
  unlink,
  syncDirectory,
  beforeTemporaryOpen: async () => undefined,
  beforeCommit: async () => undefined,
};

interface TrustedDirectory {
  canonicalPath: string;
  device: number;
  inode: number;
  handle: FileHandle;
}

function isNotFound(error: unknown): boolean {
  return (
    error instanceof Error &&
    'code' in error &&
    (error as NodeJS.ErrnoException).code === 'ENOENT'
  );
}

async function lstatIfExists(path: string) {
  try {
    return await lstat(path);
  } catch (error) {
    if (isNotFound(error)) return undefined;
    throw error;
  }
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
      '이 플랫폼에서는 안전한 카드 출력 디렉토리를 확인할 수 없습니다.',
    );
  }

  let current = path;
  while (true) {
    const status = await lstat(current);
    if (status.isSymbolicLink() || !status.isDirectory()) {
      throw new Error(
        `카드 출력 디렉토리 경로는 실제 디렉토리여야 합니다: ${current}`,
      );
    }
    if (status.uid !== effectiveUserId && status.uid !== 0) {
      throw new Error(
        `카드 출력 디렉토리 경로의 소유자를 신뢰할 수 없습니다: ${current}\n` +
          '--output에 현재 사용자 소유의 전용 디렉토리를 지정하세요.',
      );
    }
    const writableByOtherPrincipal = (status.mode & 0o022) !== 0;
    const trustedStickySystemDirectory =
      status.uid === 0 && (status.mode & 0o1000) !== 0;
    if (writableByOtherPrincipal && !trustedStickySystemDirectory) {
      throw new Error(
        `카드 출력 디렉토리 경로는 그룹이나 다른 사용자가 쓸 수 없어야 합니다: ${current}`,
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
      throw new Error(`카드 출력 디렉토리가 확인 중 변경되었습니다: ${path}`);
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
      `카드 출력 디렉토리가 작업 중 변경되었습니다: ${directory.canonicalPath}`,
    );
  }
}

function assertContained(root: string, destination: string, label: string): void {
  const rel = relative(root, destination);
  if (
    rel === '' ||
    rel === '..' ||
    rel.startsWith(`..${process.platform === 'win32' ? '\\' : '/'}`) ||
    isAbsolute(rel)
  ) {
    throw new Error(`${label} 경로가 출력 디렉토리를 벗어납니다.`);
  }
}

function serializeRule(rule: CardRuleSet): string {
  const yamlContent = stringify(rule, {
    indent: 2,
    nullStr: 'null',
    defaultStringType: 'PLAIN',
    collectionStyle: 'block',
    lineWidth: 120,
    sortMapEntries: false,
  });

  const header = [
    `# ${rule.card.nameKo} (${rule.card.name})`,
    `# 발급사: ${rule.card.issuer}`,
    `# 추출일: ${rule.card.lastUpdated}`,
    `# 출처: llm-scrape`,
    `# 이 파일은 자동 생성되었습니다. 내용을 검토 후 사용하세요.`,
    '',
  ].join('\n');

  return header + yamlContent;
}

/**
 * Serialize CardRuleSet to YAML and write to {outputDir}/{issuer}/{card-id}.yaml.
 * Returns the written file path.
 */
export async function writeCardRule(
  rule: CardRuleSet,
  options: WriteCardRuleOptions,
  operationOverrides: Partial<WriteCardRuleOperations> = {},
): Promise<string> {
  const operations = {
    ...DEFAULT_WRITE_OPERATIONS,
    ...operationOverrides,
  };
  const { outputDir, expectedIssuer, overwrite = false } = options;
  if (!isScraperIssuer(expectedIssuer)) {
    throw new Error(`지원하지 않는 카드사입니다: "${expectedIssuer}"`);
  }
  const parsedId = cardIdSchema.safeParse(rule.card.id);
  if (!parsedId.success) {
    throw new Error(`안전하지 않은 카드 ID입니다: ${parsedId.error.issues[0]?.message ?? rule.card.id}`);
  }
  if (rule.card.issuer !== expectedIssuer) {
    throw new Error(
      `카드사 불일치: 요청 "${expectedIssuer}", 추출 결과 "${rule.card.issuer}"`,
    );
  }

  await mkdir(outputDir, { recursive: true, mode: 0o700 });
  const rootReal = await realpath(outputDir);
  await assertTrustedDirectoryChain(rootReal);
  const issuerPath = resolve(rootReal, expectedIssuer);
  assertContained(rootReal, issuerPath, '카드사');

  const issuerBefore = await lstatIfExists(issuerPath);
  if (issuerBefore?.isSymbolicLink()) {
    throw new Error('카드사 출력 디렉토리는 심볼릭 링크일 수 없습니다.');
  }
  if (issuerBefore && !issuerBefore.isDirectory()) {
    throw new Error('카드사 출력 경로가 디렉토리가 아닙니다.');
  }
  if (!issuerBefore) {
    try {
      await mkdir(issuerPath);
    } catch (error) {
      const code = error instanceof Error && 'code' in error
        ? (error as NodeJS.ErrnoException).code
        : undefined;
      if (code !== 'EEXIST') throw error;
    }
  }

  const issuerAfter = await lstat(issuerPath);
  if (issuerAfter.isSymbolicLink() || !issuerAfter.isDirectory()) {
    throw new Error('카드사 출력 디렉토리가 안전한 실제 디렉토리가 아닙니다.');
  }
  const issuerReal = await realpath(issuerPath);
  assertContained(rootReal, issuerReal, '카드사');
  const trustedIssuer = await openTrustedDirectory(issuerReal);

  try {
    const filePath = resolve(issuerReal, `${parsedId.data}.yaml`);
    assertContained(rootReal, filePath, '카드');

    const existing = await lstatIfExists(filePath);
    if (existing?.isSymbolicLink()) {
      throw new Error('출력 파일은 심볼릭 링크일 수 없습니다.');
    }
    if (existing && !existing.isFile()) {
      throw new Error('출력 경로가 일반 파일이 아닙니다.');
    }
    if (existing && !overwrite) {
      throw new Error(`이미 존재하는 파일입니다: ${filePath}\n덮어쓰려면 --force 옵션을 사용하세요.`);
    }

    const content = serializeRule(rule);
    const noFollow = constants.O_NOFOLLOW ?? 0;
    const temporaryPath = resolve(
      issuerReal,
      `.${parsedId.data}.yaml.tmp-${process.pid}-${randomUUID()}`,
    );
    assertContained(rootReal, temporaryPath, '임시 카드');
    const flags =
      constants.O_WRONLY |
      constants.O_CREAT |
      constants.O_EXCL |
      noFollow;
    let handle: FileHandle | undefined;
    let temporaryExists = false;

    try {
      await operations.beforeTemporaryOpen(issuerReal);
      await assertTrustedDirectory(trustedIssuer);
      handle = await operations.open(temporaryPath, flags, 0o600);
      temporaryExists = true;
      await operations.writeFile(handle, content);
      await operations.syncFile(handle);

      await operations.beforeCommit(issuerReal);
      await assertTrustedDirectory(trustedIssuer);
      await operations.closeFile(handle);
      handle = undefined;
      const destinationBeforeCommit = await lstatIfExists(filePath);
      if (destinationBeforeCommit?.isSymbolicLink()) {
        throw new Error('출력 파일은 심볼릭 링크일 수 없습니다.');
      }
      if (destinationBeforeCommit && !destinationBeforeCommit.isFile()) {
        throw new Error('출력 경로가 일반 파일이 아닙니다.');
      }
      if (destinationBeforeCommit && !overwrite) {
        throw new Error(
          `이미 존재하는 파일입니다: ${filePath}\n덮어쓰려면 --force 옵션을 사용하세요.`,
        );
      }

      if (overwrite) {
        await operations.rename(temporaryPath, filePath);
        temporaryExists = false;
      } else {
        // Node does not expose renameat2(RENAME_NOREPLACE). A hard link gives
        // the create-only path the same atomic no-clobber guarantee, while
        // replacements use the atomic rename commit above.
        await operations.link(temporaryPath, filePath);
        await operations.unlink(temporaryPath);
        temporaryExists = false;
      }
      await assertTrustedDirectory(trustedIssuer);
      await operations.syncDirectory(trustedIssuer.handle);
    } catch (error) {
      const code = error instanceof Error && 'code' in error
        ? (error as NodeJS.ErrnoException).code
        : undefined;
      let cleanupError: unknown;
      let directoryStillTrusted = false;
      try {
        await assertTrustedDirectory(trustedIssuer);
        directoryStillTrusted = true;
      } catch {
        // The path no longer names the validated directory. Do not run a
        // path-based cleanup against an attacker-controlled replacement.
      }
      if (handle) {
        if (temporaryExists && !directoryStillTrusted) {
          try {
            await handle.truncate(0);
            await handle.sync();
          } catch (cleanup) {
            cleanupError = cleanup;
          }
        }
        try {
          await operations.closeFile(handle);
        } catch (cleanup) {
          cleanupError ??= cleanup;
        }
        handle = undefined;
      }
      if (temporaryExists && directoryStillTrusted) {
        try {
          await operations.unlink(temporaryPath);
          temporaryExists = false;
        } catch (cleanup) {
          if (!isNotFound(cleanup)) cleanupError ??= cleanup;
        }
      }
      if (cleanupError !== undefined) {
        throw new AggregateError(
          [error, cleanupError],
          `임시 출력 파일을 안전하게 정리하지 못했습니다: ${temporaryPath}`,
        );
      }
      if (!overwrite && code === 'EEXIST') {
        throw new Error(`이미 존재하는 파일입니다: ${filePath}\n덮어쓰려면 --force 옵션을 사용하세요.`);
      }
      throw error;
    }

    return filePath;
  } finally {
    await trustedIssuer.handle.close().catch(() => undefined);
  }
}
