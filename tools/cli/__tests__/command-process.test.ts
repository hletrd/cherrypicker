import { afterEach, describe, expect, test } from 'bun:test';
import {
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { performance } from 'node:perf_hooks';

const cliEntry = fileURLToPath(new URL('../src/index.ts', import.meta.url));
const repositoryRoot = fileURLToPath(new URL('../../..', import.meta.url));
const cardCatalogModuleUrl = new URL(
  '../src/card-catalog.ts',
  import.meta.url,
).href;
const temporaryDirectories: string[] = [];
const FRESH_PROCESS_RUNS = 3;
// Shared CI hosts can add process-launch jitter. Peak RSS is the primary guard
// against restoring the old 683-file YAML fan-out.
const STARTUP_MEDIAN_BUDGET_MS = 1_500;
const MAX_RSS_BUDGET_BYTES = 160 * 1024 * 1024;

interface CliResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

function runCli(args: readonly string[]): CliResult {
  const processResult = Bun.spawnSync({
    cmd: [process.execPath, cliEntry, ...args],
    cwd: repositoryRoot,
    env: { ...process.env, NO_COLOR: '1' },
    stdout: 'pipe',
    stderr: 'pipe',
  });
  return {
    exitCode: processResult.exitCode,
    stdout: processResult.stdout.toString(),
    stderr: processResult.stderr.toString(),
  };
}

async function createCommandFixture(): Promise<{
  directory: string;
  statement: string;
  cards: string;
}> {
  const directory = await mkdtemp(join(tmpdir(), 'cherrypicker-command-'));
  temporaryDirectories.push(directory);
  const statement = join(directory, 'statement.csv');
  const cards = join(directory, 'cards');
  await mkdir(cards);
  await writeFile(
    statement,
    [
      'date,merchant,amount',
      '2026-01-05,Prior Store,10000',
      '2026-02-05,Latest Store,20000',
      'not-a-date,Invalid Store,3000',
    ].join('\n'),
  );
  await writeFile(
    join(cards, 'test-card.yaml'),
    `card:
  id: test-card
  issuer: kb
  name: Test Card
  nameKo: 테스트 카드
  type: credit
  annualFee:
    domestic: 0
    international: 0
  url: ""
  lastUpdated: "2026-07-23"
  source: manual
performanceTiers:
  - id: tier0
    label: 무실적
    minSpending: 0
    maxSpending: null
performanceExclusions: []
rewards:
  - category: "*"
    id: base
    priority: 1
    combination: exclusive
    stackingGroup: base
    capGroup: base
    label: 기본 할인
    type: discount
    tiers:
      - performanceTier: tier0
        rate: 1
        monthlyCap: null
        perTransactionCap: null
    support:
      status: supported
globalConstraints:
  monthlyTotalDiscountCap: null
  minimumAnnualSpending: null
`,
  );
  return { directory, statement, cards };
}

afterEach(async () => {
  await Promise.all(
    temporaryDirectories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  );
});

describe('CLI process contract', () => {
  test('report help exits successfully before validating a supplied path', () => {
    const result = runCli([
      'report',
      '/definitely/not/a/statement.csv',
      '--help',
    ]);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe('');
    expect(result.stdout).toContain('CherryPicker report');
    expect(result.stdout).toContain('--output');
    expect(result.stdout).toContain('--force');
    expect(result.stdout).toContain('가장 최근 달의 거래만');
  });

  test('a mistyped option fails before file validation', () => {
    const result = runCli([
      'analyze',
      '/definitely/not/a/statement.csv',
      '--outpt',
      'report.html',
    ]);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain('알 수 없는 옵션입니다: --outpt');
    expect(result.stderr).not.toContain('찾을 수 없습니다');
  });

  test(
    'optimize uses the compiled web catalog when --cards is omitted',
    async () => {
      const fixture = await createCommandFixture();
      const result = runCli(['optimize', fixture.statement]);

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toMatch(/로드된 카드: \d+개/);
      expect(result.stderr).not.toContain('작성용 카드 규칙 모드');
    },
    30_000,
  );

  test(
    'fresh compiled-catalog processes stay within startup and peak-RSS budgets',
    () => {
      const samples: Array<{ wallMs: number; maxRSS: number }> = [];
      const probe = `
        const { loadCliCardCatalog } = await import(${JSON.stringify(cardCatalogModuleUrl)});
        const catalog = await loadCliCardCatalog();
        if (catalog.mode !== 'compiled') throw new Error('compiled mode required');
        console.log(JSON.stringify({
          cards: catalog.cards.length,
          sourceHash: catalog.sourceHash,
        }));
      `;

      for (let index = 0; index < FRESH_PROCESS_RUNS; index += 1) {
        const startedAt = performance.now();
        const result = Bun.spawnSync({
          cmd: [process.execPath, '-e', probe],
          cwd: repositoryRoot,
          env: { ...process.env, NO_COLOR: '1' },
          stdout: 'pipe',
          stderr: 'pipe',
          timeout: 10_000,
        });
        const wallMs = performance.now() - startedAt;
        expect(result.exitCode).toBe(0);
        expect(result.stderr.toString()).toBe('');
        const output = JSON.parse(result.stdout.toString()) as {
          cards: number;
          sourceHash: string;
        };
        expect(output.cards).toBeGreaterThan(600);
        expect(output.sourceHash).toMatch(/^[a-f0-9]{64}$/);
        samples.push({
          wallMs,
          maxRSS: result.resourceUsage?.maxRSS ?? 0,
        });
      }

      const medianWallMs = [...samples]
        .map(({ wallMs }) => wallMs)
        .sort((left, right) => left - right)[
          Math.floor(FRESH_PROCESS_RUNS / 2)
        ]!;
      const peakRSS = Math.max(...samples.map(({ maxRSS }) => maxRSS));

      expect(medianWallMs).toBeLessThanOrEqual(STARTUP_MEDIAN_BUDGET_MS);
      expect(peakRSS).toBeGreaterThan(0);
      expect(peakRSS).toBeLessThanOrEqual(MAX_RSS_BUDGET_BYTES);
    },
    30_000,
  );

  test(
    'report output is exclusive by default and --force performs the explicit replacement',
    async () => {
      const fixture = await createCommandFixture();
      const output = join(fixture.directory, 'report.html');
      const args = [
        'report',
        fixture.statement,
        '--cards',
        fixture.cards,
        '--output',
        output,
      ];

      const first = runCli(args);
      expect(first.exitCode).toBe(0);
      expect(first.stdout).toContain('보고서 저장 완료');
      expect(first.stderr).toContain('작성용 카드 규칙 모드');
      const firstHtml = await readFile(output, 'utf8');
      expect(firstHtml).toContain('<h2>분석 범위와 제한</h2>');
      expect(firstHtml).toContain('2026-02-05 ~ 2026-02-05');
      expect(firstHtml).toContain('2026-01-05 ~ 2026-02-05');
      expect(firstHtml).toContain('날짜를 해석할 수 없습니다');
      expect(firstHtml).toContain('최신 명세서 월');

      const exclusive = runCli(args);
      expect(exclusive.exitCode).toBe(1);
      expect(exclusive.stderr).toContain('--force');
      expect(await readFile(output, 'utf8')).toBe(firstHtml);

      const forced = runCli([...args, '--force']);
      expect(forced.exitCode).toBe(0);
      expect(await readFile(output, 'utf8')).toContain('분석 범위와 제한');
    },
    30_000,
  );

  test(
    'report --force rejects a symlink and leaves its target unchanged',
    async () => {
      const fixture = await createCommandFixture();
      const target = join(fixture.directory, 'target.html');
      const output = join(fixture.directory, 'report.html');
      await writeFile(target, 'do-not-change');
      await symlink(target, output);

      const result = runCli([
        'report',
        fixture.statement,
        '--cards',
        fixture.cards,
        '--output',
        output,
        '--force',
      ]);

      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('심볼릭 링크');
      expect(await readFile(target, 'utf8')).toBe('do-not-change');
      expect((await lstat(output)).isSymbolicLink()).toBe(true);
    },
    30_000,
  );
});
