import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function parseArgs(args: string[]): {
  issuer: string;
  url?: string;
  output?: string;
} {
  let issuer: string | undefined;
  let url: string | undefined;
  let output: string | undefined;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--issuer' && args[i + 1]) {
      issuer = args[i + 1];
      i++;
    } else if (args[i] === '--url' && args[i + 1]) {
      url = args[i + 1];
      i++;
    } else if (args[i] === '--output' && args[i + 1]) {
      output = args[i + 1];
      i++;
    }
  }

  if (!issuer) {
    throw new Error(
      '--issuer 옵션이 필요합니다.\n  사용법: cherrypicker scrape --issuer <issuerId> [--url <url>] [--output <dir>]\n  지원 카드사: hyundai, kb, samsung, shinhan, lotte, hana, woori, ibk, nh, bc',
    );
  }

  return { issuer, url, output };
}

export async function runScrape(args: string[]): Promise<void> {
  const { issuer, url, output } = parseArgs(args);

  // Build args for the scraper CLI
  const scraperArgs: string[] = ['--issuer', issuer];
  if (url) {
    scraperArgs.push('--url', url);
  }
  if (output) {
    scraperArgs.push('--output', output);
  }

  // Resolve scraper CLI path relative to monorepo root
  const scraperCli = join(__dirname, '../../../../tools/scraper/src/cli.ts');

  console.log(`카드사 스크래핑 시작: ${issuer}`);
  if (url) {
    console.log(`대상 URL: ${url}`);
  }

  const result = spawnSync('bun', ['run', scraperCli, ...scraperArgs], {
    stdio: 'inherit',
    encoding: 'utf-8',
  });

  if (result.status !== 0) {
    throw new Error(`스크래퍼 종료 코드: ${result.status ?? 'unknown'}`);
  }
}
