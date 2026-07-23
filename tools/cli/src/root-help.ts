import { formatScraperEnvironmentHelp } from '@cherrypicker/scraper/args';

export type RootHelpCommand = 'analyze' | 'optimize' | 'report' | 'scrape';

export interface RootHelpExample {
  readonly command: RootHelpCommand;
  readonly args: readonly string[];
}

/**
 * Copyable root-help examples. Tests run every vector through the same parser
 * used by its command, so option contracts cannot drift from this display.
 */
export const ROOT_HELP_EXAMPLES: readonly RootHelpExample[] = [
  { command: 'analyze', args: ['statement.csv'] },
  {
    command: 'analyze',
    args: ['statement.csv', '--bank', 'hyundai'],
  },
  { command: 'optimize', args: ['statement.csv'] },
  {
    command: 'optimize',
    args: [
      'statement.csv',
      '--categories',
      './categories.yaml',
      '--cards',
      './rules/',
    ],
  },
  {
    command: 'optimize',
    args: ['statement.csv', '--prev-spending', '500000'],
  },
  {
    command: 'report',
    args: ['statement.csv', '--output', 'report.html'],
  },
  { command: 'scrape', args: ['--issuer', 'hyundai'] },
  {
    command: 'scrape',
    args: ['--issuer', 'kb', '--url', 'https://card.kbcard.com/'],
  },
] as const;

function formatExample(example: RootHelpExample): string {
  return `  ${['cherrypicker', example.command, ...example.args].join(' ')}`;
}

export function formatRootHelp(): string {
  return [
    'CherryPicker — 한국 신용카드 최적화 도구',
    '',
    '사용법:',
    '  cherrypicker <command> [options]',
    '',
    '명령어:',
    '  analyze   카드 명세서를 분석하여 지출 내역을 요약합니다',
    '  optimize  지출에 최적화된 카드 조합을 추천합니다',
    '  report    최적화 결과를 HTML 보고서로 생성합니다',
    '  scrape    카드사 페이지에서 혜택 규칙을 자동 추출합니다',
    '',
    '예시:',
    ...ROOT_HELP_EXAMPLES.map(formatExample),
    '',
    '스크래퍼 실행 전:',
    ...formatScraperEnvironmentHelp().split('\n').map((line) => `  ${line}`),
    '',
    '옵션:',
    '  --help, -h    도움말 표시',
    '  --version     버전 표시',
  ].join('\n');
}
