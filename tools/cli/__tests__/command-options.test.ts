import { describe, expect, test } from 'bun:test';
import {
  DEFAULT_REPORT_OUTPUT,
  STATEMENT_COMMAND_OPTION_SPECS,
  SUPPORTED_BANK_IDS,
  formatStatementCommandHelp,
  parseStatementCommandArgs,
  type StatementCommandName,
} from '../src/command-options.js';
import { runAnalyze } from '../src/commands/analyze.js';
import { runOptimize } from '../src/commands/optimize.js';

const EXPECTED_BANK_IDS = [
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
] as const;

async function captureConsoleLog(action: () => Promise<void>): Promise<string[]> {
  const original = console.log;
  const messages: string[] = [];
  console.log = (...values: unknown[]) => {
    messages.push(values.map(String).join(' '));
  };
  try {
    await action();
  } finally {
    console.log = original;
  }
  return messages;
}

describe('shared statement-command option parser', () => {
  test('validates the exact 24 BankId values at runtime', () => {
    expect(SUPPORTED_BANK_IDS).toEqual(EXPECTED_BANK_IDS);
    expect(SUPPORTED_BANK_IDS).toHaveLength(24);

    for (const bank of EXPECTED_BANK_IDS) {
      const parsed = parseStatementCommandArgs('analyze', [
        'statement.csv',
        '--bank',
        bank,
      ]);
      expect(parsed.bank).toBe(bank);
    }
  });

  test('parses options before or after the single statement path', () => {
    expect(
      parseStatementCommandArgs('analyze', [
        '--bank',
        'kb',
        '--categories',
        'categories.yaml',
        'statement.csv',
        '--allow-remote-llm',
        '--yes',
      ]),
    ).toEqual({
      help: false,
      file: 'statement.csv',
      bank: 'kb',
      categoriesPath: 'categories.yaml',
      force: false,
      allowRemoteLLM: true,
      yes: true,
    });

    expect(
      parseStatementCommandArgs('optimize', [
        'statement.csv',
        '--cards',
        'cards',
        '--prev-spending',
        '500000',
      ]),
    ).toEqual({
      help: false,
      file: 'statement.csv',
      cardsDir: 'cards',
      prevSpending: 500000,
      force: false,
      allowRemoteLLM: false,
      yes: false,
    });
  });

  test('applies report defaults from the shared specification parser', () => {
    expect(parseStatementCommandArgs('report', ['statement.csv'])).toEqual({
      help: false,
      file: 'statement.csv',
      output: DEFAULT_REPORT_OUTPUT,
      force: false,
      allowRemoteLLM: false,
      yes: false,
    });
    expect(
      parseStatementCommandArgs('report', [
        'statement.csv',
        '--output',
        'result.html',
        '--force',
      ]),
    ).toMatchObject({
      output: 'result.html',
      force: true,
    });
  });

  test('allows help without a statement path but still rejects malformed arguments', () => {
    expect(parseStatementCommandArgs('analyze', ['--help'])).toMatchObject({
      help: true,
    });
    expect(parseStatementCommandArgs('optimize', ['-h'])).toMatchObject({
      help: true,
    });
    expect(parseStatementCommandArgs('report', ['--help'])).toMatchObject({
      help: true,
      output: DEFAULT_REPORT_OUTPUT,
    });

    expect(() =>
      parseStatementCommandArgs('analyze', ['--help', '--unknown']),
    ).toThrow('알 수 없는 옵션');
  });

  test('rejects unknown and command-unsupported options', () => {
    expect(() =>
      parseStatementCommandArgs('analyze', ['statement.csv', '--wat']),
    ).toThrow('알 수 없는 옵션');
    expect(() =>
      parseStatementCommandArgs('analyze', [
        'statement.csv',
        '--cards',
        'cards',
      ]),
    ).toThrow('analyze 명령에서 지원하지 않는 옵션');
    expect(() =>
      parseStatementCommandArgs('optimize', [
        'statement.csv',
        '--output',
        'result.html',
      ]),
    ).toThrow('optimize 명령에서 지원하지 않는 옵션');
    expect(() =>
      parseStatementCommandArgs('optimize', ['statement.csv', '--force']),
    ).toThrow('optimize 명령에서 지원하지 않는 옵션');
  });

  test('rejects stray and duplicate positional arguments', () => {
    for (const command of ['analyze', 'optimize', 'report'] as const) {
      expect(() =>
        parseStatementCommandArgs(command, ['one.csv', 'two.csv']),
      ).toThrow('명세서 파일은 하나만');
    }
    expect(() => parseStatementCommandArgs('analyze', [])).toThrow(
      '명세서 파일 경로를 지정하세요',
    );
  });

  test('rejects duplicate flags, aliases, and value options', () => {
    const cases: Array<[StatementCommandName, string[]]> = [
      ['analyze', ['statement.csv', '--yes', '--yes']],
      ['analyze', ['statement.csv', '--help', '-h']],
      ['analyze', ['statement.csv', '--bank', 'kb', '--bank', 'shinhan']],
      [
        'optimize',
        ['statement.csv', '--prev-spending', '0', '--prev-spending', '1'],
      ],
      ['report', ['statement.csv', '--output', 'a.html', '--output', 'b.html']],
      ['report', ['statement.csv', '--force', '--force']],
    ];

    for (const [command, args] of cases) {
      expect(() => parseStatementCommandArgs(command, args)).toThrow(
        '옵션을 중복 지정할 수 없습니다',
      );
    }
  });

  test('requires every value option to have a non-option value', () => {
    const cases: Array<[StatementCommandName, string[]]> = [
      ['analyze', ['statement.csv', '--bank']],
      ['analyze', ['statement.csv', '--categories', '--yes']],
      ['optimize', ['statement.csv', '--cards', '']],
      ['optimize', ['statement.csv', '--prev-spending', '--yes']],
      ['report', ['statement.csv', '--output', '--force']],
    ];

    for (const [command, args] of cases) {
      expect(() => parseStatementCommandArgs(command, args)).toThrow(
        '옵션에',
      );
    }
  });

  test('rejects invalid banks and delegates previous-spending validation', () => {
    expect(() =>
      parseStatementCommandArgs('analyze', [
        'statement.csv',
        '--bank',
        'not-a-bank',
      ]),
    ).toThrow('지원하지 않는 은행 ID');

    for (const invalid of ['-1', '1.5', '12abc', '1e3']) {
      expect(() =>
        parseStatementCommandArgs('optimize', [
          'statement.csv',
          '--prev-spending',
          invalid,
        ]),
      ).toThrow('전월실적은');
    }
  });

  test('supports the option terminator for a statement path beginning with a dash', () => {
    expect(parseStatementCommandArgs('analyze', ['--', '-statement.csv'])).toMatchObject({
      help: false,
      file: '-statement.csv',
    });
  });
});

describe('statement-command help', () => {
  test('renders only options supported by each command from the shared spec', () => {
    for (const command of ['analyze', 'optimize', 'report'] as const) {
      const help = formatStatementCommandHelp(command);
      expect(help).toContain(
        `cherrypicker ${command} <statement-file> [options]`,
      );

      for (const spec of STATEMENT_COMMAND_OPTION_SPECS) {
        const primaryName = spec.names[0]!;
        if (spec.commands.includes(command)) {
          expect(help).toContain(primaryName);
        } else {
          expect(help).not.toContain(primaryName);
        }
      }
    }
  });

  test('documents analysis scope, defaults, and remote consent', () => {
    const analyzeHelp = formatStatementCommandHelp('analyze');
    expect(analyzeHelp).toContain('기본 카테고리 데이터');
    expect(analyzeHelp).toContain('원격 LLM 폴백은 기본적으로 꺼져');
    expect(analyzeHelp).toContain('--allow-remote-llm');
    expect(analyzeHelp).toContain('--yes');

    for (const command of ['optimize', 'report'] as const) {
      const help = formatStatementCommandHelp(command);
      expect(help).toContain('가장 최근 달의 거래만');
      expect(help).toContain('달력상 직전 달 합계');
      expect(help).toContain('전월 데이터가 없으면 0원');
      expect(help).toContain('cards-optimizer.json');
      expect(help).toContain('작성용 YAML');
      expect(help).toContain('override 모드');
    }

    const reportHelp = formatStatementCommandHelp('report');
    expect(reportHelp).toContain(DEFAULT_REPORT_OUTPUT);
    expect(reportHelp).toContain('기본적으로 덮어쓰지 않');
  });

  test('analyze and optimize return help before validating a supplied file path', async () => {
    const nonexistent = '/definitely/not/a/cherrypicker-statement.csv';

    const analyzeMessages = await captureConsoleLog(() =>
      runAnalyze([nonexistent, '--help']),
    );
    expect(analyzeMessages.join('\n')).toContain('CherryPicker analyze');

    const optimizeMessages = await captureConsoleLog(() =>
      runOptimize([nonexistent, '-h']),
    );
    expect(optimizeMessages.join('\n')).toContain('CherryPicker optimize');
  });
});
