#!/usr/bin/env bun
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchCardPage, cleanHTML } from './fetcher.js';
import { extractCardRules } from './extractor.js';
import { writeCardRule } from './writer.js';
import { parseScraperArgs } from './args.js';
import type { ScraperIssuer } from './config.js';
import { SCRAPER_ISSUERS } from './config.js';
import { buildIssuerNetworkPolicy } from './network-policy.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface IssuerTarget {
  issuer: ScraperIssuer;
  baseUrl: string;
  cardListUrl?: string;
  allowedHosts?: string[];
  notes?: string;
}

function printHelp(): void {
  console.log(`
CherryPicker 카드 규칙 스크래퍼

사용법:
  bun run tools/scraper/src/cli.ts --issuer <issuerId> [--url <url>] [--output <dir>] [--force]

옵션:
  --issuer <id>    카드사 ID (필수): ${SCRAPER_ISSUERS.join(', ')}
  --url <url>      스크래핑할 특정 카드 URL (생략 시 카드사 기본 URL 사용)
  --allow-host <host> 공식 호스트 외 대상을 명시적으로 추가 (반복 가능)
  --output <dir>   출력 디렉토리 (기본: packages/rules/data/cards/)
  --force          같은 카드 파일이 있으면 일반 파일만 덮어쓰기
  --help           도움말

예시:
  bun run tools/scraper/src/cli.ts --issuer hyundai
  bun run tools/scraper/src/cli.ts --issuer kb --url https://card.kbcard.com/...
  bun run tools/scraper/src/cli.ts --issuer samsung --output ./output/
`);
}

export function loadIssuerTarget(issuer: ScraperIssuer): IssuerTarget {
  const targetsDir = join(__dirname, '../targets');
  const targetFile = join(targetsDir, `${issuer}.json`);

  let content: string;
  try {
    content = readFileSync(targetFile, 'utf-8');
  } catch {
    throw new Error(
      `카드사 "${issuer}" 설정 파일을 찾을 수 없습니다: ${targetFile}\n` +
        `지원 카드사: ${SCRAPER_ISSUERS.join(', ')}`,
    );
  }

  let target: IssuerTarget;
  try {
    target = JSON.parse(content) as IssuerTarget;
  } catch {
    throw new Error(`카드사 "${issuer}" 설정 파일이 올바른 JSON이 아닙니다.`);
  }
  if (target.issuer !== issuer) {
    throw new Error(
      `카드사 설정 불일치: 요청 "${issuer}", 설정 "${target.issuer}"`,
    );
  }
  return target;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.includes('-h')) {
    printHelp();
    return;
  }
  const defaultOutput = join(__dirname, '../../../packages/rules/data/cards');
  const {
    issuer,
    url: urlOverride,
    output,
    force,
    allowHosts: requestedAllowedHosts,
  } = parseScraperArgs(args, defaultOutput);

  // Load issuer target config
  const target = loadIssuerTarget(issuer);
  const networkPolicy = buildIssuerNetworkPolicy(
    target,
    urlOverride,
    requestedAllowedHosts,
  );
  const targetUrl = networkPolicy.url;
  const allowedHosts = networkPolicy.allowedHosts;

  console.log(`\n[CherryPicker 스크래퍼]`);
  console.log(`카드사: ${issuer}`);
  console.log(`대상 URL: ${targetUrl}`);
  console.log(`출력 디렉토리: ${output}`);
  if (requestedAllowedHosts.length > 0) {
    console.warn(`추가 허용 호스트: ${requestedAllowedHosts.join(', ')}`);
  }
  console.log('');

  // Step 1: Fetch page
  console.log('1/4 페이지 가져오는 중...');
  const html = await fetchCardPage(targetUrl, { allowedHosts });
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
  const filePath = await writeCardRule(cardRules, {
    outputDir: output,
    expectedIssuer: issuer,
    overwrite: force,
  });
  console.log(`   저장 완료: ${filePath}`);

  console.log('\n완료!\n');
}

await main();
