#!/usr/bin/env bun
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchCardPage, cleanHTML } from './fetcher.js';
import { extractCardRules } from './extractor.js';
import { writeCardRule } from './writer.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface IssuerTarget {
  issuer: string;
  baseUrl: string;
  cardListUrl?: string;
  notes?: string;
}

function parseArgs(args: string[]): {
  issuer: string;
  url?: string;
  output: string;
} {
  let issuer: string | undefined;
  let url: string | undefined;
  let output = join(__dirname, '../../../packages/rules/data/cards');

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--issuer' && args[i + 1]) {
      issuer = args[i + 1];
      i++;
    } else if (args[i] === '--url' && args[i + 1]) {
      url = args[i + 1];
      i++;
    } else if (args[i] === '--output' && args[i + 1]) {
      output = args[i + 1]!;
      i++;
    } else if (args[i] === '--help' || args[i] === '-h') {
      printHelp();
      process.exit(0);
    }
  }

  if (!issuer) {
    console.error('오류: --issuer 옵션이 필요합니다.');
    printHelp();
    process.exit(1);
  }

  return { issuer, url, output };
}

function printHelp(): void {
  console.log(`
CardPick 카드 규칙 스크래퍼

사용법:
  bun run tools/scraper/src/cli.ts --issuer <issuerId> [--url <url>] [--output <dir>]

옵션:
  --issuer <id>    카드사 ID (필수): hyundai, kb, samsung, shinhan, lotte, hana, woori, ibk, nh, bc
  --url <url>      스크래핑할 특정 카드 URL (생략 시 카드사 기본 URL 사용)
  --output <dir>   출력 디렉토리 (기본: packages/rules/data/cards/)
  --help           도움말

예시:
  bun run tools/scraper/src/cli.ts --issuer hyundai
  bun run tools/scraper/src/cli.ts --issuer kb --url https://card.kbcard.com/...
  bun run tools/scraper/src/cli.ts --issuer samsung --output ./output/
`);
}

function loadIssuerTarget(issuer: string): IssuerTarget {
  const targetsDir = join(__dirname, '../targets');
  const targetFile = join(targetsDir, `${issuer}.json`);

  try {
    const content = readFileSync(targetFile, 'utf-8');
    return JSON.parse(content) as IssuerTarget;
  } catch {
    throw new Error(
      `카드사 "${issuer}" 설정 파일을 찾을 수 없습니다: ${targetFile}\n` +
        '지원 카드사: hyundai, kb, samsung, shinhan, lotte, hana, woori, ibk, nh, bc',
    );
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const { issuer, url: urlOverride, output } = parseArgs(args);

  // Load issuer target config
  const target = loadIssuerTarget(issuer);
  const targetUrl = urlOverride ?? target.baseUrl;

  console.log(`\n[CardPick 스크래퍼]`);
  console.log(`카드사: ${issuer}`);
  console.log(`대상 URL: ${targetUrl}`);
  console.log(`출력 디렉토리: ${output}`);
  console.log('');

  // Step 1: Fetch page
  console.log('1/4 페이지 가져오는 중...');
  const html = await fetchCardPage(targetUrl);
  console.log(`   HTML 크기: ${Math.round(html.length / 1024)}KB`);

  // Step 2: Clean HTML
  console.log('2/4 HTML 정리 중...');
  const cleaned = cleanHTML(html);
  console.log(`   텍스트 크기: ${Math.round(cleaned.length / 1024)}KB`);

  // Step 3: Extract rules with LLM
  console.log('3/4 LLM으로 혜택 규칙 추출 중...');
  const cardRules = await extractCardRules(cleaned, issuer);
  console.log(`   카드명: ${cardRules.card.nameKo} (${cardRules.card.name})`);
  console.log(`   혜택 규칙: ${cardRules.rewards.length}개 카테고리`);
  console.log(`   전월실적 구간: ${cardRules.performanceTiers.length}개`);

  // Step 4: Write YAML
  console.log('4/4 YAML 파일 저장 중...');
  const filePath = await writeCardRule(cardRules, output);
  console.log(`   저장 완료: ${filePath}`);

  console.log('\n완료!\n');
}

await main();
