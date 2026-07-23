import { describe, expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  runScraperCli,
  runScraperMain,
  type ScraperCliDependencies,
} from '../src/cli.js';
import { makeCardRule } from './fixtures.js';

const repositoryRoot = fileURLToPath(new URL('../../..', import.meta.url));
const scraperEntry = fileURLToPath(new URL('../src/cli.ts', import.meta.url));
const scraperModuleUrl = new URL('../src/cli.ts', import.meta.url).href;
const fixtureModuleUrl = new URL('./fixtures.ts', import.meta.url).href;

const OSC_8 =
  '\u001b]8;;https://terminal.invalid\u0007LINK\u001b]8;;\u0007';
const OSC_52 = '\u001b]52;c;YXR0YWNr\u0007CLIP';
const CSI = '\u001b[31mRED\u001b[0m';
const LINE_CONTROLS = 'LINE\r\nNEXT\u0001C0\u0085C1';
const BIDI = 'LEFT\u202eRIGHT\u2066END\u2069';
const HOSTILE_TEXT = `${OSC_8}${OSC_52}${CSI}${LINE_CONTROLS}${BIDI}`;
const INJECTED_CONTROLS =
  /[\u0000-\u001f\u007f-\u009f\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/u;

interface CapturedConsole {
  logs: string[];
  warnings: string[];
  errors: string[];
}

function spawnBun(
  args: readonly string[],
  env: NodeJS.ProcessEnv = process.env,
) {
  const executable = process.versions.bun ? process.execPath : 'bun';
  const result = spawnSync(executable, [...args], {
    cwd: repositoryRoot,
    env,
    stdio: 'pipe',
  });
  if (result.error) {
    throw result.error;
  }
  return {
    exitCode: result.status,
    stdout: result.stdout,
    stderr: result.stderr,
  };
}

async function captureConsole(
  run: () => Promise<void>,
): Promise<CapturedConsole> {
  const originalLog = console.log;
  const originalWarn = console.warn;
  const originalError = console.error;
  const captured: CapturedConsole = {
    logs: [],
    warnings: [],
    errors: [],
  };
  console.log = (...values: unknown[]) => {
    captured.logs.push(values.map(String).join(' '));
  };
  console.warn = (...values: unknown[]) => {
    captured.warnings.push(values.map(String).join(' '));
  };
  console.error = (...values: unknown[]) => {
    captured.errors.push(values.map(String).join(' '));
  };
  try {
    await run();
  } finally {
    console.log = originalLog;
    console.warn = originalWarn;
    console.error = originalError;
  }
  return captured;
}

function successfulDependencies(
  overrides: Partial<ScraperCliDependencies> = {},
): Partial<ScraperCliDependencies> {
  return {
    loadIssuerTarget: (issuer) => ({
      issuer,
      baseUrl: 'https://issuer.example/card',
    }),
    buildIssuerNetworkPolicy: () => ({
      url: `https://issuer.example/${HOSTILE_TEXT}`,
      allowedHosts: ['issuer.example'],
    }),
    fetchCardPage: async () => '<html>card</html>',
    cleanHTML: () => 'card',
    extractCardRules: async () =>
      makeCardRule({
        nameKo: HOSTILE_TEXT,
        name: HOSTILE_TEXT,
      }),
    writeCardRule: async () => `/tmp/${HOSTILE_TEXT}.yaml`,
    ...overrides,
  };
}

describe('direct scraper CLI boundary', () => {
  test('sanitizes successful extraction values at captured console sinks', async () => {
    const captured = await captureConsole(async () => {
      await runScraperCli(
        [
          '--issuer',
          'shinhan',
          '--allow-host',
          HOSTILE_TEXT,
          '--output',
          `/tmp/${HOSTILE_TEXT}`,
        ],
        successfulDependencies(),
      );
    });

    const dynamicLines = [
      ...captured.logs.filter((line) =>
        /카드사:|대상 URL:|출력 디렉토리:|카드명:|저장 완료:/.test(line),
      ),
      ...captured.warnings,
    ];
    expect(dynamicLines.length).toBeGreaterThan(0);
    for (const line of dynamicLines) {
      expect(line).not.toMatch(INJECTED_CONTROLS);
    }
    const output = dynamicLines.join('\n');
    expect(output).not.toContain('terminal.invalid');
    expect(output).not.toContain('YXR0YWNr');
    expect(output).not.toContain('LINE\r\nNEXT');
    expect(output).toContain('LINE  NEXT C0 C1');
    expect(output).toContain('LEFTRIGHTEND');
  });

  test('sanitizes a validation failure at the owned top-level error sink', async () => {
    const captured = await captureConsole(async () => {
      const exitCode = await runScraperMain(
        ['--issuer', 'shinhan'],
        successfulDependencies({
          extractCardRules: async () => {
            throw new Error(`추출된 규칙 검증 실패:\n${HOSTILE_TEXT}`);
          },
        }),
      );
      expect(exitCode).toBe(1);
    });

    expect(captured.errors).toHaveLength(1);
    expect(captured.errors[0]).not.toMatch(INJECTED_CONTROLS);
    expect(captured.errors[0]).not.toContain('terminal.invalid');
    expect(captured.errors[0]).not.toContain('YXR0YWNr');
    expect(captured.errors[0]).toContain('추출된 규칙 검증 실패:');
    expect(captured.errors[0]).toContain('LINE  NEXT C0 C1');
  });

  test('help and invalid arguments finish before any operational dependency', async () => {
    let operationCalls = 0;
    const unavailable = () => {
      operationCalls++;
      throw new Error('operation must not start');
    };
    const dependencies: Partial<ScraperCliDependencies> = {
      loadIssuerTarget: unavailable,
      buildIssuerNetworkPolicy: unavailable,
      fetchCardPage: unavailable,
      cleanHTML: unavailable,
      extractCardRules: unavailable,
      writeCardRule: unavailable,
    };

    const help = await captureConsole(async () => {
      await runScraperCli(['--help'], dependencies);
    });
    expect(help.logs.join('\n')).toContain('--allow-host');
    expect(operationCalls).toBe(0);

    let invalidExit = 0;
    const invalid = await captureConsole(async () => {
      invalidExit = await runScraperMain(
        ['--issuer', 'shinhan', '--force', '--force'],
        dependencies,
      );
    });
    expect(invalidExit).toBe(1);
    expect(invalid.errors).toHaveLength(1);
    expect(operationCalls).toBe(0);
  });

  test('sanitizes a successful extraction in a fresh subprocess', () => {
    const probe = `
      const { runScraperMain } = await import(${JSON.stringify(scraperModuleUrl)});
      const { makeCardRule } = await import(${JSON.stringify(fixtureModuleUrl)});
      const hostile = ${JSON.stringify(HOSTILE_TEXT)};
      const exitCode = await runScraperMain(
        ['--issuer', 'shinhan', '--allow-host', hostile, '--output', '/tmp/output'],
        {
          loadIssuerTarget: (issuer) => ({ issuer, baseUrl: 'https://issuer.example/card' }),
          buildIssuerNetworkPolicy: () => ({
            url: 'https://issuer.example/' + hostile,
            allowedHosts: ['issuer.example'],
          }),
          fetchCardPage: async () => '<html>card</html>',
          cleanHTML: () => 'card',
          extractCardRules: async () => makeCardRule({ nameKo: hostile, name: hostile }),
          writeCardRule: async () => '/tmp/' + hostile + '.yaml',
        },
      );
      process.exitCode = exitCode;
    `;
    const result = spawnBun(
      ['-e', probe],
      { ...process.env, NO_COLOR: '1' },
    );

    expect(result.exitCode).toBe(0);
    const stderr = result.stderr.toString();
    expect(stderr).toContain('추가 허용 호스트:');
    expect(stderr).not.toContain('\u001b]8;');
    expect(stderr).not.toContain('\u001b]52;');
    expect(stderr).not.toMatch(/[\r\u0001\u0085\u202e\u2066\u2069]/u);
    expect(stderr).not.toContain('terminal.invalid');
    expect(stderr).not.toContain('YXR0YWNr');
    const stdout = result.stdout.toString();
    expect(stdout).not.toContain('\u001b]8;');
    expect(stdout).not.toContain('\u001b]52;');
    expect(stdout).not.toMatch(/[\r\u0001\u0085\u202e\u2066\u2069]/u);
    expect(stdout).not.toContain('terminal.invalid');
    expect(stdout).not.toContain('YXR0YWNr');
  });

  test('sanitizes an extraction validation failure in a fresh subprocess', () => {
    const probe = `
      const { runScraperMain } = await import(${JSON.stringify(scraperModuleUrl)});
      const hostile = ${JSON.stringify(HOSTILE_TEXT)};
      const exitCode = await runScraperMain(
        ['--issuer', 'shinhan'],
        {
          loadIssuerTarget: (issuer) => ({ issuer, baseUrl: 'https://issuer.example/card' }),
          buildIssuerNetworkPolicy: () => ({
            url: 'https://issuer.example/card',
            allowedHosts: ['issuer.example'],
          }),
          fetchCardPage: async () => '<html>card</html>',
          cleanHTML: () => 'card',
          extractCardRules: async () => {
            throw new Error('validation failed:\\n' + hostile);
          },
        },
      );
      process.exitCode = exitCode;
    `;
    const result = spawnBun(
      ['-e', probe],
      { ...process.env, NO_COLOR: '1' },
    );

    expect(result.exitCode).toBe(1);
    const stderr = result.stderr.toString();
    expect(stderr).toContain('오류: validation failed:');
    expect(stderr).not.toContain('\u001b]8;');
    expect(stderr).not.toContain('\u001b]52;');
    expect(stderr).not.toMatch(/[\r\u0001\u0085\u202e\u2066\u2069]/u);
    expect(stderr).not.toContain('terminal.invalid');
    expect(stderr).not.toContain('YXR0YWNr');
  });

  test('direct help exits zero and malformed input exits before scraping', () => {
    const help = spawnBun([scraperEntry, '-h']);
    expect(help.exitCode).toBe(0);
    expect(help.stderr.toString()).toBe('');
    expect(help.stdout.toString()).toContain('--allow-host');

    const invalid = spawnBun([
      scraperEntry,
      '--issuer',
      `invalid${HOSTILE_TEXT}`,
    ]);
    expect(invalid.exitCode).toBe(1);
    expect(invalid.stdout.toString()).not.toContain('[CherryPicker 스크래퍼]');
    expect(invalid.stderr.toString()).not.toMatch(
      /[\r\u0001\u0085\u202e\u2066\u2069]/u,
    );
    expect(invalid.stderr.toString()).not.toContain('terminal.invalid');
    expect(invalid.stderr.toString()).not.toContain('YXR0YWNr');
  });
});
