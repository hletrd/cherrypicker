import { describe, expect, test, beforeAll, afterAll } from 'bun:test';
import { mkdtempSync, writeFileSync, unlinkSync, rmdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { runAnalyze } from '../src/commands/analyze.js';
import { runOptimize } from '../src/commands/optimize.js';
import { runReport } from '../src/commands/report.js';
import {
  buildScraperArgs,
  parseScrapeCommandArgs,
  runScrape,
} from '../src/commands/scrape.js';
import {
  parsePreviousSpendingArgument,
  validateFilePath,
} from '../src/validation.js';
import { authorizeRemoteLLMFallback } from '../src/consent.js';
import {
  parseStatementLocalFirst,
  REMOTE_LLM_REQUIRED,
  type StatementParser,
} from '../src/parse-statement.js';
import type { ParseResult, RawTransaction } from '@cherrypicker/parser/types';

let tempDir: string;
let tempCsv: string;

beforeAll(() => {
  tempDir = mkdtempSync(join(tmpdir(), 'cherrypicker-test-'));
  tempCsv = join(tempDir, 'statement.csv');
  writeFileSync(tempCsv, 'date,merchant,amount\n2024-01-01,test,10000');
});

afterAll(() => {
  try { unlinkSync(tempCsv); } catch {}
  try { rmdirSync(tempDir); } catch {}
});

const parsedTransaction: RawTransaction = {
  date: '2024-01-01',
  merchant: '테스트',
  amount: 10000,
};

function createParseResult(
  transactions: RawTransaction[] = [],
  errors: ParseResult['errors'] = [],
): ParseResult {
  return {
    bank: null,
    format: 'pdf',
    transactions,
    errors,
  };
}

function createRemoteRequiredResult(): ParseResult {
  const error = Object.assign(new Error('원격 폴백이 필요합니다.'), {
    name: 'ParseError',
    code: REMOTE_LLM_REQUIRED,
  }) as ParseResult['errors'][number];
  return createParseResult([], [error]);
}

function createTrackingParser(
  resolveResult: (allowRemoteLLM: boolean) => ParseResult,
): { parser: StatementParser; calls: boolean[] } {
  const calls: boolean[] = [];
  const parser: StatementParser = async (_filePath, options) => {
    const allowRemoteLLM = options?.allowRemoteLLM ?? false;
    calls.push(allowRemoteLLM);
    return resolveResult(allowRemoteLLM);
  };
  return { parser, calls };
}

describe('CLI command argument guards', () => {
  test('analyze requires a statement path', async () => {
    await expect(runAnalyze([])).rejects.toThrow('명세서 파일 경로를 지정하세요');
  });

  test('optimize requires a statement path', async () => {
    await expect(runOptimize([])).rejects.toThrow('명세서 파일 경로를 지정하세요');
  });

  test('report requires a statement path', async () => {
    await expect(runReport([])).rejects.toThrow('명세서 파일 경로를 지정하세요');
  });

  test('previous spending accepts only non-negative safe integers', () => {
    expect(parsePreviousSpendingArgument('0')).toBe(0);
    expect(parsePreviousSpendingArgument('300000')).toBe(300000);

    for (const invalid of [
      undefined,
      '-1',
      '1.5',
      '12abc',
      '1e3',
      String(Number.MAX_SAFE_INTEGER + 1),
    ]) {
      expect(() => parsePreviousSpendingArgument(invalid)).toThrow('전월실적은');
    }
  });

  test('optimize and report reject invalid previous spending before parsing', async () => {
    await expect(
      runOptimize([tempCsv, '--prev-spending', '12abc']),
    ).rejects.toThrow('0 이상의 정수');
    await expect(
      runReport([tempCsv, '--prev-spending', '1.5']),
    ).rejects.toThrow('0 이상의 정수');
  });

  test('scrape requires an issuer', async () => {
    await expect(runScrape([])).rejects.toThrow('--issuer 옵션이 필요합니다');
  });

  test('scrape rejects unsupported issuers before spawning the scraper', () => {
    expect(() =>
      parseScrapeCommandArgs(['--issuer', '../outside']),
    ).toThrow('지원하지 않는 카드사');
  });

  test('scrape forwards force and repeatable host expansion exactly', () => {
    const parsed = parseScrapeCommandArgs([
      '--issuer',
      'shinhan',
      '--url',
      'https://www.shinhancard.com/card',
      '--allow-host',
      'www.shinhancard.com',
      '--allow-host',
      'm.shinhancard.com',
      '--output',
      '/tmp/cards',
      '--force',
    ]);
    expect(buildScraperArgs(parsed)).toEqual([
      '--issuer',
      'shinhan',
      '--url',
      'https://www.shinhancard.com/card',
      '--allow-host',
      'www.shinhancard.com',
      '--allow-host',
      'm.shinhancard.com',
      '--output',
      '/tmp/cards',
      '--force',
    ]);
  });

  test('scrape does not forward force by default', () => {
    const parsed = parseScrapeCommandArgs(['--issuer', 'shinhan']);
    expect(buildScraperArgs(parsed)).toEqual(['--issuer', 'shinhan']);
  });

  test('scrape rejects duplicate singleton options, positionals, and incomplete values', () => {
    const duplicateCases = [
      ['--issuer', 'kb', '--issuer', 'shinhan'],
      [
        '--issuer',
        'kb',
        '--url',
        'https://one.example',
        '--url',
        'https://two.example',
      ],
      ['--issuer', 'kb', '--output', 'one', '--output', 'two'],
      ['--issuer', 'kb', '--force', '--force'],
      ['--help', '-h'],
    ];
    for (const args of duplicateCases) {
      expect(() => parseScrapeCommandArgs(args)).toThrow(
        '옵션을 중복 지정할 수 없습니다',
      );
    }
    expect(() =>
      parseScrapeCommandArgs(['--issuer', 'kb', 'unexpected']),
    ).toThrow('위치 인수');
    expect(() =>
      parseScrapeCommandArgs(['--issuer', 'kb', '--url']),
    ).toThrow('값이 필요');
  });

  test('scrape help and invalid arguments never spawn the direct scraper', async () => {
    let spawnCalls = 0;
    const logs: string[] = [];
    const dependencies = {
      spawn: () => {
        spawnCalls++;
        return { status: 0 };
      },
      log: (message: string) => {
        logs.push(message);
      },
    };

    await runScrape(['--help'], dependencies);
    expect(logs.join('\n')).toContain('cherrypicker scrape --issuer');
    expect(logs.join('\n')).toContain('--allow-host');
    expect(logs.join('\n')).toContain('pending_source_review');
    expect(logs.join('\n')).toContain('원문과 대조');
    expect(logs.join('\n')).toContain('support.status를 supported');
    expect(spawnCalls).toBe(0);

    await expect(
      runScrape(
        ['--issuer', 'shinhan', '--output', 'one', '--output', 'two'],
        dependencies,
      ),
    ).rejects.toThrow('옵션을 중복 지정할 수 없습니다');
    expect(spawnCalls).toBe(0);
  });

  test('scrape rejects a null-byte output before spawning', async () => {
    let spawnCalls = 0;
    await expect(
      runScrape(
        ['--issuer', 'shinhan', '--output', 'bad\0path'],
        {
          spawn: () => {
            spawnCalls++;
            return { status: 0 };
          },
        },
      ),
    ).rejects.toThrow('널 바이트');
    expect(spawnCalls).toBe(0);
  });
});

describe('local-first LLM fallback (C1-024)', () => {
  test('locally parseable PDF succeeds without consent or a remote retry', async () => {
    const { parser, calls } = createTrackingParser(() => createParseResult([parsedTransaction]));
    let authorizationCalls = 0;

    const result = await parseStatementLocalFirst(
      {
        filePath: 'statement.pdf',
        allowRemoteLLM: false,
        yes: false,
      },
      {
        parseStatement: parser,
        authorizeRemoteFallback: async () => {
          authorizationCalls++;
        },
      },
    );

    expect(result.transactions).toEqual([parsedTransaction]);
    expect(calls).toEqual([false]);
    expect(authorizationCalls).toBe(0);
  });

  test('typed local failure without the flag gives instructions and never retries remotely', async () => {
    const { parser, calls } = createTrackingParser(() => createRemoteRequiredResult());

    await expect(
      parseStatementLocalFirst(
        {
          filePath: 'statement.pdf',
          allowRemoteLLM: false,
          yes: false,
        },
        { parseStatement: parser },
      ),
    ).rejects.toThrow('--allow-remote-llm');

    expect(calls).toEqual([false]);
  });

  test('interactive approval occurs between the local parse and remote retry', async () => {
    const events: string[] = [];
    const parser: StatementParser = async (_filePath, options) => {
      const remote = options?.allowRemoteLLM ?? false;
      events.push(remote ? 'parse:remote' : 'parse:local');
      return remote ? createParseResult([parsedTransaction]) : createRemoteRequiredResult();
    };

    const result = await parseStatementLocalFirst(
      {
        filePath: 'statement.pdf',
        allowRemoteLLM: true,
        yes: false,
      },
      {
        parseStatement: parser,
        authorizeRemoteFallback: async (options) => {
          events.push('consent');
          await authorizeRemoteLLMFallback(options, {
            isCI: () => false,
            prompt: async () => true,
          });
        },
      },
    );

    expect(result.transactions).toEqual([parsedTransaction]);
    expect(events).toEqual(['parse:local', 'consent', 'parse:remote']);
  });

  test('binds local parsing, consent, and remote retry to one captured byte sequence', async () => {
    let currentPathBytes = Buffer.from('original pdf bytes');
    let fileReads = 0;
    const parsedBytes: string[] = [];
    let consentIdentity: string | undefined;
    const parser: StatementParser = async (_filePath, options, dependencies) => {
      const bytes = await dependencies?.readFile?.('statement.pdf');
      parsedBytes.push(Buffer.from(bytes ?? []).toString('utf8'));
      return options?.allowRemoteLLM
        ? createParseResult([parsedTransaction])
        : createRemoteRequiredResult();
    };

    const result = await parseStatementLocalFirst(
      {
        filePath: 'statement.pdf',
        allowRemoteLLM: true,
        yes: false,
      },
      {
        readFile: async () => {
          fileReads++;
          return currentPathBytes;
        },
        parseStatement: parser,
        authorizeRemoteFallback: async (options) => {
          consentIdentity = options.documentIdentity;
          currentPathBytes = Buffer.from('replacement secret bytes');
        },
      },
    );

    expect(result.transactions).toEqual([parsedTransaction]);
    expect(fileReads).toBe(1);
    expect(parsedBytes).toEqual([
      'original pdf bytes',
      'original pdf bytes',
    ]);
    expect(consentIdentity).toMatch(
      /^sha256:[0-9a-f]{64} \(18 bytes\)$/,
    );
  });

  test('interactive denial does not trigger a remote retry', async () => {
    const { parser, calls } = createTrackingParser(() => createRemoteRequiredResult());

    await expect(
      parseStatementLocalFirst(
        {
          filePath: 'statement.pdf',
          allowRemoteLLM: true,
          yes: false,
        },
        {
          parseStatement: parser,
          authorizeRemoteFallback: (options) =>
            authorizeRemoteLLMFallback(options, {
              isCI: () => false,
              prompt: async () => false,
            }),
        },
      ),
    ).rejects.toThrow('거부했습니다');

    expect(calls).toEqual([false]);
  });

  test('consent timeout does not trigger a remote retry', async () => {
    const { parser, calls } = createTrackingParser(() => createRemoteRequiredResult());

    await expect(
      parseStatementLocalFirst(
        {
          filePath: 'statement.pdf',
          allowRemoteLLM: true,
          yes: false,
        },
        {
          parseStatement: parser,
          authorizeRemoteFallback: (options) =>
            authorizeRemoteLLMFallback(options, {
              isCI: () => false,
              prompt: async () => {
                throw new Error('LLM 동의 확인 시간이 초과되었습니다.');
              },
            }),
        },
      ),
    ).rejects.toThrow('시간이 초과되었습니다');

    expect(calls).toEqual([false]);
  });

  test('--yes explicitly authorizes a noninteractive retry after typed local failure', async () => {
    const { parser, calls } = createTrackingParser((remote) =>
      remote ? createParseResult([parsedTransaction]) : createRemoteRequiredResult(),
    );
    let promptCalls = 0;

    await parseStatementLocalFirst(
      {
        filePath: 'statement.pdf',
        allowRemoteLLM: true,
        yes: true,
      },
      {
        parseStatement: parser,
          authorizeRemoteFallback: (options) =>
          authorizeRemoteLLMFallback(options, {
            isCI: () => true,
            prompt: async () => {
              promptCalls++;
              return true;
            },
          }),
      },
    );

    expect(calls).toEqual([false, true]);
    expect(promptCalls).toBe(0);
  });

  test('CI without --yes fails after local parsing and never retries remotely', async () => {
    const { parser, calls } = createTrackingParser((remote) =>
      remote ? createParseResult([parsedTransaction]) : createRemoteRequiredResult(),
    );
    let promptCalls = 0;

    await expect(
      parseStatementLocalFirst(
        {
          filePath: 'statement.pdf',
          allowRemoteLLM: true,
          yes: false,
        },
        {
          parseStatement: parser,
          authorizeRemoteFallback: (options) =>
            authorizeRemoteLLMFallback(options, {
              isCI: () => true,
              prompt: async () => {
                promptCalls++;
                return true;
              },
            }),
        },
      ),
    ).rejects.toThrow('--yes');

    expect(calls).toEqual([false]);
    expect(promptCalls).toBe(0);
  });

  test('non-PDF results without the typed signal never enter the consent path', async () => {
    const localResult = {
      ...createParseResult(),
      format: 'csv' as const,
    };
    const { parser, calls } = createTrackingParser(() => localResult);
    let authorizationCalls = 0;

    const result = await parseStatementLocalFirst(
      {
        filePath: 'statement.csv',
        allowRemoteLLM: true,
        yes: false,
      },
      {
        parseStatement: parser,
        authorizeRemoteFallback: async () => {
          authorizationCalls++;
        },
      },
    );

    expect(result).toBe(localResult);
    expect(calls).toEqual([false]);
    expect(authorizationCalls).toBe(0);
  });

  test('non-PDF command still parses without consent', async () => {
    await expect(runAnalyze([tempCsv])).resolves.toBeUndefined();
  });
});

describe('validateFilePath', () => {
  test('rejects path containing ..', () => {
    expect(() => validateFilePath('../foo.csv', { mustExist: false })).toThrow('상위 디렉토리 참조');
    expect(() => validateFilePath('foo/../bar.csv', { mustExist: false })).toThrow('상위 디렉토리 참조');
    expect(() => validateFilePath('/tmp/../etc/passwd', { mustExist: false })).toThrow('상위 디렉토리 참조');
  });

  test('rejects non-existent file when mustExist is true', () => {
    expect(() => validateFilePath('/nonexistent/file.csv', { mustExist: true })).toThrow('찾을 수 없습니다');
  });

  test('allows non-existent file when mustExist is false', () => {
    expect(() => validateFilePath('/nonexistent/file.csv', { mustExist: false })).not.toThrow();
  });

  test('allows valid existing file', () => {
    // Use this test file itself as a known-existing file
    const testFile = import.meta.filename;
    expect(() => validateFilePath(testFile, { mustExist: true })).not.toThrow();
  });

  test('rejects empty path', () => {
    expect(() => validateFilePath('', { mustExist: false })).toThrow('비어 있습니다');
  });

  test('allows path with double dots in filename (not segment)', () => {
    expect(() => validateFilePath('foo..bar.csv', { mustExist: false })).not.toThrow();
  });

  test('rejects null bytes without validating a surrogate path', () => {
    for (const mustExist of [false, true]) {
      expect(() =>
        validateFilePath('/tmp/file\x00.txt', { mustExist }),
      ).toThrow('널 바이트');
    }
  });

  test('rejects symbolic link when mustExist is true', () => {
    const { symlinkSync, unlinkSync } = require('node:fs');
    const { join } = require('node:path');
    const linkPath = join(tempDir, 'evil-link');
    symlinkSync(tempCsv, linkPath);
    expect(() => validateFilePath(linkPath, { mustExist: true })).toThrow('심볼릭 링크');
    unlinkSync(linkPath);
  });
});
