#!/usr/bin/env bun
import { runAnalyze } from './commands/analyze.js';
import { runOptimize } from './commands/optimize.js';
import { runReport } from './commands/report.js';
import { runScrape } from './commands/scrape.js';

function printHelp(): void {
  console.log(`
CardPick — 한국 신용카드 최적화 도구

사용법:
  cherrypicker <command> [options]

명령어:
  analyze   카드 명세서를 분석하여 지출 내역을 요약합니다
  optimize  지출에 최적화된 카드 조합을 추천합니다
  report    최적화 결과를 HTML 보고서로 생성합니다
  scrape    카드사 페이지에서 혜택 규칙을 자동 추출합니다

예시:
  cherrypicker analyze statement.csv
  cherrypicker analyze statement.csv --bank hyundai
  cherrypicker optimize statement.csv --cards ./rules/
  cherrypicker optimize statement.csv --prev-spending 500000
  cherrypicker report statement.csv --output report.html
  cherrypicker scrape --issuer hyundai
  cherrypicker scrape --issuer kb --url https://card.kbcard.com/...

옵션:
  --help, -h    도움말 표시
  --version     버전 표시
`);
}

function printVersion(): void {
  console.log('cherrypicker v0.1.0');
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    printHelp();
    process.exit(0);
  }

  if (args[0] === '--version') {
    printVersion();
    process.exit(0);
  }

  const [command, ...rest] = args;

  try {
    switch (command) {
      case 'analyze':
        await runAnalyze(rest);
        break;
      case 'optimize':
        await runOptimize(rest);
        break;
      case 'report':
        await runReport(rest);
        break;
      case 'scrape':
        await runScrape(rest);
        break;
      default:
        console.error(`알 수 없는 명령어: ${command}`);
        console.error('사용 가능한 명령어 목록을 보려면 --help 를 사용하세요.');
        process.exit(1);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`오류: ${message}`);
    process.exit(1);
  }
}

await main();
