#!/usr/bin/env bun
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { fetchCardPage, cleanHTML } from './fetcher.js';
import {
  createCardExtractionClient,
  extractCardRules as extractCardRulesWithClaude,
} from './extractor.js';
import { writeCardRule } from './writer.js';
import {
  formatScrapeHelp,
  parseScraperArgs,
} from './args.js';
import {
  SCRAPER_ISSUERS,
  type ScraperIssuer,
} from './config.js';
import { buildIssuerNetworkPolicy } from './network-policy.js';
import {
  resolveScraperRuntimeConfig,
  type ScraperRuntimeConfig,
} from './runtime-config.js';
import { sanitizeTerminalText } from '@cherrypicker/viz';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export interface IssuerTarget {
  issuer: ScraperIssuer;
  baseUrl: string;
  cardListUrl?: string;
  allowedHosts?: string[];
  notes?: string;
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

export interface ScraperCliDependencies {
  resolveRuntimeConfig: typeof resolveScraperRuntimeConfig;
  loadIssuerTarget: typeof loadIssuerTarget;
  buildIssuerNetworkPolicy: typeof buildIssuerNetworkPolicy;
  fetchCardPage: typeof fetchCardPage;
  cleanHTML: typeof cleanHTML;
  extractCardRules(
    pageContent: string,
    issuer: ScraperIssuer,
    runtimeConfig: ScraperRuntimeConfig,
  ): ReturnType<typeof extractCardRulesWithClaude>;
  writeCardRule: typeof writeCardRule;
}

const DEFAULT_DEPENDENCIES: ScraperCliDependencies = {
  resolveRuntimeConfig: resolveScraperRuntimeConfig,
  loadIssuerTarget,
  buildIssuerNetworkPolicy,
  fetchCardPage,
  cleanHTML,
  extractCardRules(pageContent, issuer, runtimeConfig) {
    return extractCardRulesWithClaude(
      pageContent,
      issuer,
      createCardExtractionClient(runtimeConfig.apiKey),
      undefined,
      runtimeConfig.model,
    );
  },
  writeCardRule,
};

function terminalText(value: unknown): string {
  return sanitizeTerminalText(value);
}

export async function runScraperCli(
  args: readonly string[],
  dependencyOverrides: Partial<ScraperCliDependencies> = {},
): Promise<void> {
  const defaultOutput = join(__dirname, '../../../packages/rules/data/cards');
  const parsed = parseScraperArgs(args, defaultOutput);
  if (parsed.help) {
    console.log(
      formatScrapeHelp('bun run tools/scraper/src/cli.ts'),
    );
    return;
  }
  const dependencies = {
    ...DEFAULT_DEPENDENCIES,
    ...dependencyOverrides,
  };
  const {
    issuer,
    url: urlOverride,
    output,
    force,
    allowHosts: requestedAllowedHosts,
  } = parsed;
  const outputDir = output ?? defaultOutput;
  const runtimeConfig = dependencies.resolveRuntimeConfig();

  // Load issuer target config
  const target = dependencies.loadIssuerTarget(issuer);
  const networkPolicy = dependencies.buildIssuerNetworkPolicy(
    target,
    urlOverride,
    requestedAllowedHosts,
  );
  const targetUrl = networkPolicy.url;
  const allowedHosts = networkPolicy.allowedHosts;

  console.log(`\n[CherryPicker 스크래퍼]`);
  console.log(`카드사: ${terminalText(issuer)}`);
  console.log(`대상 URL: ${terminalText(targetUrl)}`);
  console.log(`출력 디렉토리: ${terminalText(outputDir)}`);
  console.log(`Claude 모델: ${terminalText(runtimeConfig.model)}`);
  if (requestedAllowedHosts.length > 0) {
    console.warn(
      `추가 허용 호스트: ${terminalText(requestedAllowedHosts.join(', '))}`,
    );
  }
  console.log('');

  // Step 1: Fetch page
  console.log('1/4 페이지 가져오는 중...');
  const html = await dependencies.fetchCardPage(targetUrl, { allowedHosts });
  console.log(
    `   HTML 크기: ${terminalText(Math.round(html.length / 1024))}KB`,
  );

  // Step 2: Clean HTML
  console.log('2/4 HTML 정리 중...');
  const cleaned = dependencies.cleanHTML(html);
  console.log(
    `   텍스트 크기: ${terminalText(Math.round(cleaned.length / 1024))}KB`,
  );

  // Step 3: Extract rules with LLM
  console.log('3/4 LLM으로 혜택 규칙 추출 중...');
  const cardRules = await dependencies.extractCardRules(
    cleaned,
    issuer,
    runtimeConfig,
  );
  console.log(
    `   카드명: ${terminalText(cardRules.card.nameKo)} ` +
      `(${terminalText(cardRules.card.name)})`,
  );
  console.log(
    `   혜택 규칙: ${terminalText(cardRules.rewards.length)}개 카테고리`,
  );
  console.log(
    `   전월실적 구간: ${terminalText(cardRules.performanceTiers.length)}개`,
  );

  // Step 4: Write YAML
  console.log('4/4 YAML 파일 저장 중...');
  const filePath = await dependencies.writeCardRule(cardRules, {
    outputDir,
    expectedIssuer: issuer,
    overwrite: force,
  });
  console.log(`   저장 완료: ${terminalText(filePath)}`);

  console.log('\n완료!\n');
}

/** Own the process error sink so Bun never prints untrusted stack text. */
export async function runScraperMain(
  args: readonly string[],
  dependencyOverrides: Partial<ScraperCliDependencies> = {},
): Promise<number> {
  try {
    await runScraperCli(args, dependencyOverrides);
    return 0;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`오류: ${terminalText(message)}`);
    return 1;
  }
}

if (import.meta.main) {
  process.exitCode = await runScraperMain(process.argv.slice(2));
}
