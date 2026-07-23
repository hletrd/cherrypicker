#!/usr/bin/env bun

import { randomUUID } from 'node:crypto';
import type { Dirent } from 'node:fs';
import {
  mkdir,
  readFile,
  readdir,
  rename,
  writeFile,
} from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';
import {
  issuersFileSchema,
  type CardType,
  type IssuerMeta,
} from '../packages/rules/src/index.js';
import { parsePublicationCard } from './catalog-publication.js';

export const ROOT_CATALOG_BEGIN = '<!-- BEGIN GENERATED ISSUER COUNTS -->';
export const ROOT_CATALOG_END = '<!-- END GENERATED ISSUER COUNTS -->';
export const ISSUER_INDEX_BEGIN = '<!-- BEGIN GENERATED CARD INDEX -->';
export const ISSUER_INDEX_END = '<!-- END GENERATED CARD INDEX -->';

export const repositoryRoot = resolve(
  dirname(fileURLToPath(import.meta.url)),
  '..',
);

export interface ReadmeCatalogCard {
  fileName: string;
  id: string;
  issuer: string;
  nameKo: string;
  type: CardType;
  lastUpdated: string;
}

export interface ReadmeCatalogIssuer {
  meta: IssuerMeta;
  cards: ReadmeCatalogCard[];
}

export interface ReadmeCatalog {
  issuers: ReadmeCatalogIssuer[];
  totalCards: number;
}

export interface ReadmeUpdate {
  path: string;
  current: string | null;
  expected: string;
}

function compareText(left: string, right: string): number {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

function countOccurrences(value: string, needle: string): number {
  let count = 0;
  let offset = 0;
  while (true) {
    const index = value.indexOf(needle, offset);
    if (index < 0) return count;
    count += 1;
    offset = index + needle.length;
  }
}

async function readIfPresent(path: string): Promise<string | null> {
  try {
    return await readFile(path, 'utf8');
  } catch (error) {
    if (
      error instanceof Error &&
      'code' in error &&
      error.code === 'ENOENT'
    ) {
      return null;
    }
    throw error;
  }
}

async function atomicWrite(path: string, content: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  const temporaryPath = `${path}.tmp-${process.pid}-${randomUUID()}`;
  await writeFile(temporaryPath, content, 'utf8');
  await rename(temporaryPath, path);
}

export function escapeMarkdownTableCell(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('\\', '&#92;')
    .replaceAll('|', '&#124;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('`', '&#96;')
    .replaceAll('[', '&#91;')
    .replaceAll(']', '&#93;')
    .replaceAll('*', '&#42;')
    .replaceAll('_', '&#95;')
    .replaceAll('~', '&#126;')
    .replace(/\r\n?|\n/g, '<br>');
}

function encodeRelativeLink(fileName: string): string {
  return `./${encodeURIComponent(fileName)}`;
}

function displayCardType(type: CardType): string {
  switch (type) {
    case 'credit':
      return '신용';
    case 'check':
      return '체크';
    case 'prepaid':
      return '선불';
  }
}

function sortedIssuerCards(cards: ReadmeCatalogCard[]): ReadmeCatalogCard[] {
  return [...cards].sort(
    (left, right) =>
      compareText(left.nameKo, right.nameKo) ||
      compareText(left.id, right.id) ||
      compareText(left.fileName, right.fileName),
  );
}

function sortedRootIssuers(
  issuers: ReadmeCatalogIssuer[],
): ReadmeCatalogIssuer[] {
  return [...issuers].sort(
    (left, right) =>
      right.cards.length - left.cards.length ||
      compareText(left.meta.id, right.meta.id),
  );
}

export function replaceGeneratedSection(
  markdown: string,
  beginMarker: string,
  endMarker: string,
  generatedSection: string,
): string {
  const beginCount = countOccurrences(markdown, beginMarker);
  const endCount = countOccurrences(markdown, endMarker);

  if (beginCount !== endCount || beginCount > 1) {
    throw new Error(
      `Expected zero or one matching ${beginMarker}/${endMarker} marker pair`,
    );
  }

  if (beginCount === 0) {
    const separator = markdown.endsWith('\n\n')
      ? ''
      : markdown.endsWith('\n')
        ? '\n'
        : '\n\n';
    return `${markdown}${separator}${generatedSection}\n`;
  }

  const beginIndex = markdown.indexOf(beginMarker);
  const endIndex = markdown.indexOf(endMarker, beginIndex + beginMarker.length);
  if (endIndex < beginIndex) {
    throw new Error(`${endMarker} must follow ${beginMarker}`);
  }

  return (
    markdown.slice(0, beginIndex) +
    generatedSection +
    markdown.slice(endIndex + endMarker.length)
  );
}

export function renderRootCatalogSection(catalog: ReadmeCatalog): string {
  const issuers = sortedRootIssuers(catalog.issuers);
  const rowTotal = issuers.reduce(
    (total, issuer) => total + issuer.cards.length,
    0,
  );
  if (rowTotal !== catalog.totalCards) {
    throw new Error(
      `Issuer row total ${rowTotal} does not match catalog total ${catalog.totalCards}`,
    );
  }

  const rows = issuers.map(
    ({ meta, cards }) =>
      `| ${escapeMarkdownTableCell(meta.nameKo)} | \`${escapeMarkdownTableCell(meta.id)}\` | ${cards.length} |`,
  );

  return [
    ROOT_CATALOG_BEGIN,
    `[![Cards](https://img.shields.io/badge/cards-${catalog.totalCards}-2f81f7)](packages/rules/data/cards/)`,
    `[![Issuers](https://img.shields.io/badge/issuers-${issuers.length}-2f81f7)](packages/rules/data/issuers.yaml)`,
    '',
    '| 카드사 | ID | 카드 수 |',
    '|---|---:|---:|',
    ...rows,
    ROOT_CATALOG_END,
  ].join('\n');
}

export function renderIssuerIndexSection(
  issuer: ReadmeCatalogIssuer,
): string {
  const cards = sortedIssuerCards(issuer.cards);
  const latestUpdated =
    cards.map(({ lastUpdated }) => lastUpdated).sort(compareText).at(-1) ??
    '없음';
  const rows = cards.map(
    (card) =>
      `| ${escapeMarkdownTableCell(card.nameKo)} | ${displayCardType(card.type)} | [` +
      `${escapeMarkdownTableCell(card.fileName)}](${encodeRelativeLink(card.fileName)}) |`,
  );

  return [
    ISSUER_INDEX_BEGIN,
    '## 전체 카드 인덱스',
    '',
    `> YAML 기준 **${cards.length}개** · 최신 업데이트: \`${latestUpdated}\``,
    '',
    '| 카드명 | 유형 | YAML |',
    '|---|---:|---|',
    ...rows,
    ISSUER_INDEX_END,
  ].join('\n');
}

function minimalIssuerReadme(issuer: IssuerMeta): string {
  return [
    `# ${escapeMarkdownTableCell(issuer.nameKo)} (${escapeMarkdownTableCell(issuer.nameEn)})`,
    '',
    '이 디렉터리의 YAML 파일이 CherryPicker가 사용하는 카드 데이터입니다.',
    '',
  ].join('\n');
}

export async function loadReadmeCatalog(
  root = repositoryRoot,
): Promise<ReadmeCatalog> {
  const dataDirectory = join(root, 'packages/rules/data');
  const cardsDirectory = join(dataDirectory, 'cards');
  const issuerSource = parse(
    await readFile(join(dataDirectory, 'issuers.yaml'), 'utf8'),
  ) as unknown;
  const issuerResult = issuersFileSchema.safeParse(issuerSource);
  if (!issuerResult.success) {
    throw new Error(`Invalid issuers.yaml:\n${issuerResult.error.message}`);
  }

  const registeredIssuerIds = new Set<string>();
  for (const issuer of issuerResult.data.issuers) {
    if (registeredIssuerIds.has(issuer.id)) {
      throw new Error(`Duplicate issuer id in issuers.yaml: ${issuer.id}`);
    }
    registeredIssuerIds.add(issuer.id);
  }

  const directoryEntries = await readdir(cardsDirectory, {
    withFileTypes: true,
  });
  const unregisteredDirectories = directoryEntries
    .filter(
      (entry) =>
        entry.isDirectory() && !registeredIssuerIds.has(entry.name),
    )
    .map(({ name }) => name)
    .sort(compareText);
  if (unregisteredDirectories.length > 0) {
    throw new Error(
      `Unregistered issuer directories: ${unregisteredDirectories.join(', ')}`,
    );
  }

  const seenCardIds = new Map<string, string>();
  const issuers: ReadmeCatalogIssuer[] = [];

  for (const issuer of issuerResult.data.issuers) {
    const issuerDirectory = join(cardsDirectory, issuer.id);
    let issuerEntries: Dirent[];
    try {
      issuerEntries = await readdir(issuerDirectory, { withFileTypes: true });
    } catch (error) {
      if (
        error instanceof Error &&
        'code' in error &&
        error.code === 'ENOENT'
      ) {
        throw new Error(
          `Missing card directory for registered issuer ${issuer.id}`,
        );
      }
      throw error;
    }

    const yamlFiles = issuerEntries
      .filter(
        (entry) =>
          entry.isFile() && /\.(?:yaml|yml)$/i.test(entry.name),
      )
      .map(({ name }) => name)
      .sort(compareText);
    const cards: ReadmeCatalogCard[] = [];

    for (const fileName of yamlFiles) {
      const absolutePath = join(issuerDirectory, fileName);
      const sourceName = relative(root, absolutePath);
      const raw = parse(await readFile(absolutePath, 'utf8')) as unknown;
      const rule = parsePublicationCard(raw, sourceName);
      if (rule.card.issuer !== issuer.id) {
        throw new Error(
          `${sourceName}: issuer "${rule.card.issuer}" does not match directory "${issuer.id}"`,
        );
      }

      const previousSource = seenCardIds.get(rule.card.id);
      if (previousSource !== undefined) {
        throw new Error(
          `Duplicate card id "${rule.card.id}" in ${previousSource} and ${sourceName}`,
        );
      }
      seenCardIds.set(rule.card.id, sourceName);
      cards.push({
        fileName,
        id: rule.card.id,
        issuer: rule.card.issuer,
        nameKo: rule.card.nameKo,
        type: rule.card.type,
        lastUpdated: rule.card.lastUpdated,
      });
    }

    issuers.push({ meta: issuer, cards });
  }

  return {
    issuers,
    totalCards: issuers.reduce(
      (total, issuer) => total + issuer.cards.length,
      0,
    ),
  };
}

export async function planReadmeUpdates(
  catalog: ReadmeCatalog,
  root = repositoryRoot,
): Promise<ReadmeUpdate[]> {
  const rootReadmePath = join(root, 'README.md');
  const rootReadme = await readIfPresent(rootReadmePath);
  if (rootReadme === null) {
    throw new Error(`Missing root README: ${rootReadmePath}`);
  }

  const updates: ReadmeUpdate[] = [
    {
      path: rootReadmePath,
      current: rootReadme,
      expected: replaceGeneratedSection(
        rootReadme,
        ROOT_CATALOG_BEGIN,
        ROOT_CATALOG_END,
        renderRootCatalogSection(catalog),
      ),
    },
  ];

  for (const issuer of catalog.issuers) {
    const readmePath = join(
      root,
      'packages/rules/data/cards',
      issuer.meta.id,
      'README.md',
    );
    const current = await readIfPresent(readmePath);
    const base = current ?? minimalIssuerReadme(issuer.meta);
    updates.push({
      path: readmePath,
      current,
      expected: replaceGeneratedSection(
        base,
        ISSUER_INDEX_BEGIN,
        ISSUER_INDEX_END,
        renderIssuerIndexSection(issuer),
      ),
    });
  }

  return updates;
}

export async function synchronizeReadmeCatalog(options: {
  root?: string;
  check?: boolean;
} = {}): Promise<{
  catalog: ReadmeCatalog;
  driftedPaths: string[];
}> {
  const root = options.root ?? repositoryRoot;
  const catalog = await loadReadmeCatalog(root);
  const updates = await planReadmeUpdates(catalog, root);
  const changedUpdates = updates.filter(
    ({ current, expected }) => current !== expected,
  );

  if (!options.check) {
    for (const update of changedUpdates) {
      await atomicWrite(update.path, update.expected);
    }
  }

  return {
    catalog,
    driftedPaths: changedUpdates.map(({ path }) => relative(root, path)),
  };
}

async function main(): Promise<void> {
  const supportedArguments = new Set(['--check']);
  const unsupportedArguments = process.argv
    .slice(2)
    .filter((argument) => !supportedArguments.has(argument));
  if (unsupportedArguments.length > 0) {
    throw new Error(
      `Unsupported argument(s): ${unsupportedArguments.join(', ')}. Usage: bun scripts/readme-catalog.ts [--check]`,
    );
  }

  const check = process.argv.includes('--check');
  const { catalog, driftedPaths } = await synchronizeReadmeCatalog({ check });
  if (check && driftedPaths.length > 0) {
    console.error('Generated README catalog drift detected:');
    for (const path of driftedPaths) console.error(`  ${path}`);
    process.exitCode = 1;
    return;
  }

  const action = check ? 'Verified' : 'Generated';
  console.log(
    `${action} README catalog: ${catalog.totalCards} cards across ${catalog.issuers.length} issuers.`,
  );
  if (!check && driftedPaths.length > 0) {
    for (const path of driftedPaths) console.log(`  ${path}`);
  }
}

if (import.meta.main) {
  try {
    await main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
