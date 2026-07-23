import type { ScraperIssuer } from './config.js';
import {
  parseScraperIssuer,
  SCRAPER_ISSUERS,
} from './config.js';

type ScrapeOptionKey =
  | 'issuer'
  | 'url'
  | 'allowHost'
  | 'output'
  | 'force'
  | 'help';

interface ScrapeOptionSpec {
  readonly names: readonly string[];
  readonly key: ScrapeOptionKey;
  readonly kind: 'flag' | 'value';
  readonly repeatable: boolean;
  readonly valueLabel?: string;
  readonly description: string;
}

export const DEFAULT_SCRAPER_OUTPUT = 'packages/rules/data/cards';

/** Single source of truth for both the root wrapper and direct scraper CLI. */
export const SCRAPE_OPTION_SPECS: readonly ScrapeOptionSpec[] = [
  {
    names: ['--issuer'],
    key: 'issuer',
    kind: 'value',
    repeatable: false,
    valueLabel: '<issuerId>',
    description: `카드사 ID (필수): ${SCRAPER_ISSUERS.join(', ')}`,
  },
  {
    names: ['--url'],
    key: 'url',
    kind: 'value',
    repeatable: false,
    valueLabel: '<url>',
    description: '특정 카드 URL (기본값: 카드사 설정의 기본 URL)',
  },
  {
    names: ['--allow-host'],
    key: 'allowHost',
    kind: 'value',
    repeatable: true,
    valueLabel: '<host>',
    description: '공식 호스트 외 대상을 명시적으로 추가 (반복 가능)',
  },
  {
    names: ['--output'],
    key: 'output',
    kind: 'value',
    repeatable: false,
    valueLabel: '<dir>',
    description: `출력 디렉토리 (기본값: ${DEFAULT_SCRAPER_OUTPUT})`,
  },
  {
    names: ['--force'],
    key: 'force',
    kind: 'flag',
    repeatable: false,
    description: '기존 일반 카드 파일을 덮어쓰기 (기본값: 덮어쓰기 안 함)',
  },
  {
    names: ['--help', '-h'],
    key: 'help',
    kind: 'flag',
    repeatable: false,
    description: '이 명령의 도움말 표시',
  },
] as const;

interface ScraperArgsBase {
  url?: string;
  output?: string;
  force: boolean;
  allowHosts: string[];
}

export type ScraperArgs =
  | (ScraperArgsBase & {
      help: true;
      issuer?: ScraperIssuer;
    })
  | (ScraperArgsBase & {
      help: false;
      issuer: ScraperIssuer;
    });

function optionLabel(spec: ScrapeOptionSpec): string {
  const names = spec.names.join(', ');
  return spec.kind === 'value'
    ? `${names} ${spec.valueLabel ?? '<value>'}`
    : names;
}

export function formatScrapeHelp(invocation: string): string {
  const labels = SCRAPE_OPTION_SPECS.map(optionLabel);
  const labelWidth = Math.max(...labels.map((label) => label.length));
  const options = SCRAPE_OPTION_SPECS.map(
    (spec, index) =>
      `  ${labels[index]!.padEnd(labelWidth)}  ${spec.description}`,
  ).join('\n');

  return `CherryPicker 카드 규칙 스크래퍼

사용법:
  ${invocation} --issuer <issuerId> [options]

옵션:
${options}

예시:
  ${invocation} --issuer hyundai
  ${invocation} --issuer kb --url https://card.kbcard.com/...
  ${invocation} --issuer samsung --output ./output`;
}

function missingValue(value: string | undefined): boolean {
  return value === undefined || value.length === 0 || value.startsWith('-');
}

function requireSafeValue(
  args: readonly string[],
  index: number,
  spec: ScrapeOptionSpec,
): string {
  const value = args[index + 1];
  if (missingValue(value)) {
    throw new Error(
      `${spec.names[0]} 옵션 값이 필요합니다 (${spec.valueLabel ?? '<value>'}).`,
    );
  }
  if (value!.includes('\0')) {
    throw new Error(`${spec.names[0]} 옵션 값에 널 바이트를 포함할 수 없습니다.`);
  }
  return value!;
}

function findOption(token: string): ScrapeOptionSpec | undefined {
  return SCRAPE_OPTION_SPECS.find((spec) => spec.names.includes(token));
}

/**
 * Parse the complete scrape argument vector before any spawn, network, or
 * filesystem work. `--allow-host` is the only repeatable option.
 */
export function parseScraperArgs(
  args: readonly string[],
  defaultOutput?: string,
): ScraperArgs {
  let help = false;
  let issuer: ScraperIssuer | undefined;
  let url: string | undefined;
  let output = defaultOutput;
  let force = false;
  const allowHosts: string[] = [];
  const seen = new Set<ScrapeOptionKey>();

  for (let index = 0; index < args.length; index++) {
    const token = args[index]!;
    const spec = findOption(token);
    if (!spec) {
      if (token.startsWith('-')) {
        throw new Error(`알 수 없는 옵션입니다: ${token}`);
      }
      throw new Error(`예상하지 않은 위치 인수입니다: ${token}`);
    }

    if (!spec.repeatable && seen.has(spec.key)) {
      throw new Error(`옵션을 중복 지정할 수 없습니다: ${token}`);
    }
    seen.add(spec.key);

    if (spec.kind === 'flag') {
      if (spec.key === 'help') help = true;
      if (spec.key === 'force') force = true;
      continue;
    }

    const value = requireSafeValue(args, index, spec);
    index++;
    switch (spec.key) {
      case 'issuer':
        issuer = parseScraperIssuer(value);
        break;
      case 'url':
        url = value;
        break;
      case 'allowHost':
        allowHosts.push(value);
        break;
      case 'output':
        output = value;
        break;
      default:
        throw new Error(`내부 오류: 값을 받지 않는 옵션입니다: ${token}`);
    }
  }

  const base = { url, output, force, allowHosts };
  if (help) return { ...base, help: true, issuer };
  if (!issuer) {
    throw new Error(
      '--issuer 옵션이 필요합니다. 도움말은 --help 또는 -h를 사용하세요.',
    );
  }
  return { ...base, help: false, issuer };
}
