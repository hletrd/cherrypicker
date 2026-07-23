import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import {
  formatScrapeHelp,
  parseScraperArgs,
  type ScraperArgs,
} from '@cherrypicker/scraper/args';
import { validateFilePath } from '../validation.js';
import { sanitizeTerminalText } from '../terminal.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export type ScrapeCommandArgs = ScraperArgs;

export interface ScrapeCommandDependencies {
  spawn(command: string, args: readonly string[]): { status: number | null };
  log(message: string): void;
}

const DEFAULT_DEPENDENCIES: ScrapeCommandDependencies = {
  spawn(command, args) {
    return spawnSync(command, [...args], {
      stdio: 'inherit',
      encoding: 'utf-8',
    });
  },
  log(message) {
    console.log(message);
  },
};

export function parseScrapeCommandArgs(
  args: readonly string[],
): ScrapeCommandArgs {
  return parseScraperArgs(args);
}

export function buildScraperArgs(parsed: ScrapeCommandArgs): string[] {
  if (parsed.help || !parsed.issuer) return [];
  const scraperArgs: string[] = ['--issuer', parsed.issuer];
  if (parsed.url) scraperArgs.push('--url', parsed.url);
  for (const host of parsed.allowHosts) {
    scraperArgs.push('--allow-host', host);
  }
  if (parsed.output) scraperArgs.push('--output', parsed.output);
  if (parsed.force) scraperArgs.push('--force');
  return scraperArgs;
}

export async function runScrape(
  args: readonly string[],
  dependencyOverrides: Partial<ScrapeCommandDependencies> = {},
): Promise<void> {
  const parsed = parseScrapeCommandArgs(args);
  const dependencies = {
    ...DEFAULT_DEPENDENCIES,
    ...dependencyOverrides,
  };
  if (parsed.help) {
    dependencies.log(formatScrapeHelp('cherrypicker scrape'));
    return;
  }
  const { issuer, output } = parsed;

  if (output) {
    validateFilePath(output, { mustExist: false, label: '출력 디렉토리' });
  }

  const scraperArgs = buildScraperArgs(parsed);
  const scraperCli = join(__dirname, '../../../../tools/scraper/src/cli.ts');

  dependencies.log(
    `카드사 스크래핑 시작: ${sanitizeTerminalText(issuer)}`,
  );

  const result = dependencies.spawn(
    'bun',
    ['run', scraperCli, ...scraperArgs],
  );

  if (result.status !== 0) {
    throw new Error(`스크래퍼 종료 코드: ${result.status ?? 'unknown'}`);
  }
}
