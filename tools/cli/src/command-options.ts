import type { BankId } from '@cherrypicker/parser/types';
import { parsePreviousSpendingArgument } from './validation.js';

export type StatementCommandName = 'analyze' | 'optimize' | 'report';

const ALL_COMMANDS = ['analyze', 'optimize', 'report'] as const;
const OPTIMIZATION_COMMANDS = ['optimize', 'report'] as const;

export const SUPPORTED_BANK_IDS = [
  'hyundai',
  'kb',
  'ibk',
  'woori',
  'samsung',
  'shinhan',
  'lotte',
  'hana',
  'nh',
  'bc',
  'kakao',
  'toss',
  'kbank',
  'bnk',
  'dgb',
  'suhyup',
  'jb',
  'kwangju',
  'jeju',
  'sc',
  'mg',
  'cu',
  'kdb',
  'epost',
] as const satisfies readonly BankId[];

export const DEFAULT_REPORT_OUTPUT = 'cherrypicker-report.html';

type OptionKey =
  | 'help'
  | 'bank'
  | 'categoriesPath'
  | 'cardsDir'
  | 'prevSpending'
  | 'output'
  | 'force'
  | 'allowRemoteLLM'
  | 'yes';

interface CommandOptionSpec {
  readonly names: readonly string[];
  readonly key: OptionKey;
  readonly kind: 'flag' | 'value';
  readonly commands: readonly StatementCommandName[];
  readonly valueLabel?: string;
  readonly description: string;
}

/**
 * The single source of truth for statement-command parsing and command help.
 * Keep command availability, value arity, and user-facing documentation here.
 */
export const STATEMENT_COMMAND_OPTION_SPECS: readonly CommandOptionSpec[] = [
  {
    names: ['--bank'],
    key: 'bank',
    kind: 'value',
    commands: ALL_COMMANDS,
    valueLabel: '<bankId>',
    description: `은행을 직접 지정합니다. 지원 ID: ${SUPPORTED_BANK_IDS.join(', ')}`,
  },
  {
    names: ['--categories'],
    key: 'categoriesPath',
    kind: 'value',
    commands: ALL_COMMANDS,
    valueLabel: '<file>',
    description:
      '사용할 카테고리 규칙 파일을 지정합니다. optimize/report에서는 작성용 카드 규칙과 함께 사용해야 합니다. ' +
      '(기본값: 내장 categories.yaml)',
  },
  {
    names: ['--cards'],
    key: 'cardsDir',
    kind: 'value',
    commands: OPTIMIZATION_COMMANDS,
    valueLabel: '<dir>',
    description:
      '작성용 YAML 카드 규칙 디렉토리를 재귀 로드합니다. ' +
      '--categories와 함께 사용해야 합니다. (생략: 웹과 같은 컴파일 최적화 카탈로그)',
  },
  {
    names: ['--prev-spending'],
    key: 'prevSpending',
    kind: 'value',
    commands: OPTIMIZATION_COMMANDS,
    valueLabel: '<amount>',
    description: '전월실적을 0 이상의 원 단위 정수로 지정합니다. (기본값: 명세서 기반 계산)',
  },
  {
    names: ['--output'],
    key: 'output',
    kind: 'value',
    commands: ['report'],
    valueLabel: '<file.html>',
    description: `HTML 출력 경로를 지정합니다. (기본값: ${DEFAULT_REPORT_OUTPUT})`,
  },
  {
    names: ['--force'],
    key: 'force',
    kind: 'flag',
    commands: ['report'],
    description: '기존의 일반 출력 파일을 원자적으로 교체합니다. (기본값: 덮어쓰기 안 함)',
  },
  {
    names: ['--allow-remote-llm'],
    key: 'allowRemoteLLM',
    kind: 'flag',
    commands: ALL_COMMANDS,
    description: '로컬 파싱 실패 시 원격 LLM 폴백 동의 절차를 허용합니다. (기본값: 비활성화)',
  },
  {
    names: ['--yes'],
    key: 'yes',
    kind: 'flag',
    commands: ALL_COMMANDS,
    description: '원격 LLM 폴백을 비대화식으로 승인합니다. --allow-remote-llm과 함께 사용하세요.',
  },
  {
    names: ['--help', '-h'],
    key: 'help',
    kind: 'flag',
    commands: ALL_COMMANDS,
    description: '이 명령의 도움말을 표시합니다.',
  },
] as const;

interface ParsedValues {
  readonly bank?: BankId;
  readonly categoriesPath?: string;
  readonly cardsDir?: string;
  readonly prevSpending?: number;
  readonly output?: string;
  readonly force: boolean;
  readonly allowRemoteLLM: boolean;
  readonly yes: boolean;
}

type ParsedArgsWithValues<T extends ParsedValues> =
  | (T & {
      readonly help: true;
      readonly file?: string;
    })
  | (T & {
      readonly help: false;
      readonly file: string;
    });

export type ParsedStatementCommandArgs = ParsedArgsWithValues<ParsedValues>;
export type ParsedReportCommandArgs = ParsedArgsWithValues<
  Omit<ParsedValues, 'output'> & { readonly output: string }
>;

interface MutableParsedValues {
  help: boolean;
  bank?: BankId;
  categoriesPath?: string;
  cardsDir?: string;
  prevSpending?: number;
  output?: string;
  force: boolean;
  allowRemoteLLM: boolean;
  yes: boolean;
}

const BANK_IDS = new Set<string>(SUPPORTED_BANK_IDS);

function optionLabel(spec: CommandOptionSpec): string {
  const names = spec.names.join(', ');
  return spec.kind === 'value' ? `${names} ${spec.valueLabel}` : names;
}

function parseBankId(raw: string): BankId {
  if (!BANK_IDS.has(raw)) {
    throw new Error(
      `지원하지 않는 은행 ID입니다: ${raw}\n` +
      `지원 ID: ${SUPPORTED_BANK_IDS.join(', ')}`,
    );
  }
  return raw as BankId;
}

function assignFlag(values: MutableParsedValues, key: OptionKey): void {
  switch (key) {
    case 'help':
      values.help = true;
      break;
    case 'force':
      values.force = true;
      break;
    case 'allowRemoteLLM':
      values.allowRemoteLLM = true;
      break;
    case 'yes':
      values.yes = true;
      break;
    default:
      throw new Error(`내부 오류: 값이 필요한 옵션을 플래그로 처리할 수 없습니다: ${key}`);
  }
}

function assignValue(values: MutableParsedValues, key: OptionKey, raw: string): void {
  switch (key) {
    case 'bank':
      values.bank = parseBankId(raw);
      break;
    case 'categoriesPath':
      values.categoriesPath = raw;
      break;
    case 'cardsDir':
      values.cardsDir = raw;
      break;
    case 'prevSpending':
      values.prevSpending = parsePreviousSpendingArgument(raw);
      break;
    case 'output':
      values.output = raw;
      break;
    default:
      throw new Error(`내부 오류: 값을 받지 않는 옵션에 값을 지정할 수 없습니다: ${key}`);
  }
}

function findOption(token: string): CommandOptionSpec | undefined {
  return STATEMENT_COMMAND_OPTION_SPECS.find((spec) => spec.names.includes(token));
}

function missingValue(next: string | undefined): boolean {
  return (
    next === undefined ||
    next.length === 0 ||
    next === '--' ||
    next.startsWith('--') ||
    /^-[A-Za-z]$/.test(next)
  );
}

export function parseStatementCommandArgs(
  command: 'report',
  args: readonly string[],
): ParsedReportCommandArgs;
export function parseStatementCommandArgs(
  command: 'analyze' | 'optimize',
  args: readonly string[],
): ParsedStatementCommandArgs;
export function parseStatementCommandArgs(
  command: StatementCommandName,
  args: readonly string[],
): ParsedStatementCommandArgs;
export function parseStatementCommandArgs(
  command: StatementCommandName,
  args: readonly string[],
): ParsedStatementCommandArgs {
  const values: MutableParsedValues = {
    help: false,
    force: false,
    allowRemoteLLM: false,
    yes: false,
  };
  const seen = new Set<OptionKey>();
  const positionals: string[] = [];
  let optionsEnded = false;

  for (let index = 0; index < args.length; index++) {
    const token = args[index]!;

    if (!optionsEnded && token === '--') {
      optionsEnded = true;
      continue;
    }

    if (!optionsEnded && token.startsWith('-')) {
      const spec = findOption(token);
      if (!spec) {
        throw new Error(`알 수 없는 옵션입니다: ${token}`);
      }
      if (!spec.commands.includes(command)) {
        throw new Error(`${command} 명령에서 지원하지 않는 옵션입니다: ${token}`);
      }
      if (seen.has(spec.key)) {
        throw new Error(`옵션을 중복 지정할 수 없습니다: ${token}`);
      }
      seen.add(spec.key);

      if (spec.kind === 'flag') {
        assignFlag(values, spec.key);
        continue;
      }

      const raw = args[index + 1];
      if (missingValue(raw)) {
        throw new Error(`${token} 옵션에 ${spec.valueLabel ?? '값'}이 필요합니다.`);
      }
      assignValue(values, spec.key, raw!);
      index++;
      continue;
    }

    positionals.push(token);
    if (positionals.length > 1) {
      throw new Error(
        `명세서 파일은 하나만 지정할 수 있습니다: ${positionals.join(', ')}`,
      );
    }
  }

  const file = positionals[0];
  const parsedValues: ParsedValues = {
    ...(values.bank ? { bank: values.bank } : {}),
    ...(values.categoriesPath ? { categoriesPath: values.categoriesPath } : {}),
    ...(values.cardsDir ? { cardsDir: values.cardsDir } : {}),
    ...(values.prevSpending !== undefined ? { prevSpending: values.prevSpending } : {}),
    ...(command === 'report'
      ? { output: values.output ?? DEFAULT_REPORT_OUTPUT }
      : {}),
    force: values.force,
    allowRemoteLLM: values.allowRemoteLLM,
    yes: values.yes,
  };

  if (
    command !== 'analyze' &&
    Boolean(values.categoriesPath) !== Boolean(values.cardsDir)
  ) {
    throw new Error(
      `${command} 명령에서 --categories와 --cards는 함께 지정해야 합니다.`,
    );
  }

  if (values.help) {
    return {
      ...parsedValues,
      help: true,
      ...(file ? { file } : {}),
    };
  }

  if (!file) {
    throw new Error(
      `명세서 파일 경로를 지정하세요.\n  사용법: cherrypicker ${command} <statement-file> [options]`,
    );
  }

  return {
    ...parsedValues,
    help: false,
    file,
  };
}

const COMMAND_DESCRIPTIONS: Readonly<Record<StatementCommandName, string>> = {
  analyze: '카드 명세서를 분석하여 지출 내역을 요약합니다.',
  optimize: '명세서의 최근 월 지출에 맞는 카드 조합을 추천합니다.',
  report: '최적화 결과와 분석 제한을 담은 독립형 HTML 보고서를 생성합니다.',
};

function commandAssumptions(command: StatementCommandName): readonly string[] {
  const assumptions = [
    '--categories를 생략하면 배포본에 포함된 기본 카테고리 데이터를 사용합니다.',
    '원격 LLM 폴백은 기본적으로 꺼져 있습니다. --allow-remote-llm을 지정한 경우에만 동의를 확인하며, 비대화식 실행은 --yes도 필요합니다.',
  ];

  if (command !== 'analyze') {
    assumptions.unshift(
      '카드 추천은 명세서에서 날짜가 유효한 거래 중 가장 최근 달의 거래만 사용합니다.',
      '--prev-spending을 생략하면 가장 최근 달의 달력상 직전 달 합계를 전월실적으로 사용하고, 해당 전월 데이터가 없으면 0원으로 가정합니다.',
      '--cards를 생략하면 웹 분석과 같은 배포된 cards-optimizer.json을 검증하여 사용합니다.',
      '--cards와 --categories를 함께 지정하면 두 작성용 소스를 하나의 의미 계약으로 재귀 검증하는 override 모드로 실행하고 경고를 표시합니다.',
    );
  }

  if (command === 'report') {
    assumptions.push(
      `--output을 생략하면 현재 디렉토리의 ${DEFAULT_REPORT_OUTPUT}에 저장합니다.`,
      '기존 출력 파일은 기본적으로 덮어쓰지 않으며, --force를 지정해야 교체합니다.',
    );
  }

  return assumptions;
}

export function formatStatementCommandHelp(command: StatementCommandName): string {
  const optionLines = STATEMENT_COMMAND_OPTION_SPECS
    .filter((spec) => spec.commands.includes(command))
    .map((spec) => `  ${optionLabel(spec).padEnd(36)} ${spec.description}`)
    .join('\n');
  const assumptionLines = commandAssumptions(command)
    .map((assumption) => `  - ${assumption}`)
    .join('\n');

  return [
    `CherryPicker ${command}`,
    '',
    COMMAND_DESCRIPTIONS[command],
    '',
    '사용법:',
    `  cherrypicker ${command} <statement-file> [options]`,
    '',
    '옵션:',
    optionLines,
    '',
    '기본값 및 분석 가정:',
    assumptionLines,
  ].join('\n');
}
