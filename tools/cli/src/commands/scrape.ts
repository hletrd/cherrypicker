import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import { SCRAPER_ISSUERS } from '@cherrypicker/rules';
import type { ScraperIssuer } from '@cherrypicker/rules';
import { validateFilePath } from '../validation.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface ScrapeCommandArgs {
  issuer: ScraperIssuer;
  url?: string;
  output?: string;
  force: boolean;
  allowHosts: string[];
}

function requireValue(args: string[], index: number, option: string): string {
  const value = args[index + 1];
  if (!value || value.startsWith('--')) {
    throw new Error(`${option} 옵션에 값이 필요합니다.`);
  }
  return value;
}

export function parseScrapeCommandArgs(args: string[]): ScrapeCommandArgs {
  let issuer: string | undefined;
  let url: string | undefined;
  let output: string | undefined;
  let force = false;
  const allowHosts: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]!;
    if (arg === '--issuer') {
      issuer = requireValue(args, i, arg);
      i++;
    } else if (arg === '--url') {
      url = requireValue(args, i, arg);
      i++;
    } else if (arg === '--output') {
      output = requireValue(args, i, arg);
      i++;
    } else if (arg === '--allow-host') {
      allowHosts.push(requireValue(args, i, arg));
      i++;
    } else if (arg === '--force') {
      force = true;
    } else {
      throw new Error(`알 수 없는 옵션입니다: ${arg}`);
    }
  }

  if (!issuer) {
    throw new Error(
      '--issuer 옵션이 필요합니다.\n  사용법: cherrypicker scrape --issuer <issuerId> [--url <url>] [--allow-host <host>] [--output <dir>] [--force]',
    );
  }
  if (!(SCRAPER_ISSUERS as readonly string[]).includes(issuer)) {
    throw new Error(
      `지원하지 않는 카드사입니다: "${issuer}". 지원 카드사: ${SCRAPER_ISSUERS.join(', ')}`,
    );
  }

  return {
    issuer: issuer as ScraperIssuer,
    url,
    output,
    force,
    allowHosts,
  };
}

export function buildScraperArgs(parsed: ScrapeCommandArgs): string[] {
  const scraperArgs: string[] = ['--issuer', parsed.issuer];
  if (parsed.url) scraperArgs.push('--url', parsed.url);
  for (const host of parsed.allowHosts) {
    scraperArgs.push('--allow-host', host);
  }
  if (parsed.output) scraperArgs.push('--output', parsed.output);
  if (parsed.force) scraperArgs.push('--force');
  return scraperArgs;
}

export async function runScrape(args: string[]): Promise<void> {
  const parsed = parseScrapeCommandArgs(args);
  const { issuer, output } = parsed;

  if (output) {
    validateFilePath(output, { mustExist: false, label: '출력 디렉토리' });
  }

  // Build args for the scraper CLI
  const scraperArgs = buildScraperArgs(parsed);

  // Resolve scraper CLI path relative to monorepo root
  const scraperCli = join(__dirname, '../../../../tools/scraper/src/cli.ts');

  console.log(`카드사 스크래핑 시작: ${issuer}`);

  const result = spawnSync('bun', ['run', scraperCli, ...scraperArgs], {
    stdio: 'inherit',
    encoding: 'utf-8',
  });

  if (result.status !== 0) {
    throw new Error(`스크래퍼 종료 코드: ${result.status ?? 'unknown'}`);
  }
}
