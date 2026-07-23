import { constants } from 'node:fs';
import { lstat, mkdir, open, realpath } from 'node:fs/promises';
import type { FileHandle } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';
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

  const today = new Date().toISOString().slice(0, 10);
  const header = [
    `# ${rule.card.nameKo} (${rule.card.name})`,
    `# 발급사: ${rule.card.issuer}`,
    `# 추출일: ${today}`,
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
): Promise<string> {
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

  await mkdir(outputDir, { recursive: true });
  const rootReal = await realpath(outputDir);
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
  const flags = overwrite
    ? constants.O_WRONLY | constants.O_CREAT | constants.O_TRUNC | noFollow
    : constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | noFollow;

  let handle: FileHandle | undefined;
  try {
    handle = await open(filePath, flags, 0o644);
    await handle.writeFile(content, { encoding: 'utf-8' });
  } catch (error) {
    const code = error instanceof Error && 'code' in error
      ? (error as NodeJS.ErrnoException).code
      : undefined;
    if (!overwrite && code === 'EEXIST') {
      throw new Error(`이미 존재하는 파일입니다: ${filePath}\n덮어쓰려면 --force 옵션을 사용하세요.`);
    }
    throw error;
  } finally {
    await handle?.close();
  }

  return filePath;
}
