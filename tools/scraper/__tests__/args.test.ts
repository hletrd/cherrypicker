import { describe, expect, test } from 'bun:test';
import {
  formatScrapeHelp,
  parseScraperArgs,
  SCRAPE_OPTION_SPECS,
} from '../src/args.js';

describe('parseScraperArgs', () => {
  test('uses no-overwrite and configured-host defaults', () => {
    expect(parseScraperArgs(['--issuer', 'shinhan'], '/cards')).toEqual({
      help: false,
      issuer: 'shinhan',
      output: '/cards',
      force: false,
      allowHosts: [],
      url: undefined,
    });
  });

  test('parses explicit force and repeatable host expansion', () => {
    expect(
      parseScraperArgs(
        [
          '--issuer',
          'kb',
          '--url',
          'https://card.kbcard.com/card',
          '--allow-host',
          'card.kbcard.com',
          '--allow-host',
          'm.kbcard.com',
          '--force',
        ],
        '/cards',
      ),
    ).toEqual({
      help: false,
      issuer: 'kb',
      output: '/cards',
      url: 'https://card.kbcard.com/card',
      force: true,
      allowHosts: ['card.kbcard.com', 'm.kbcard.com'],
    });
  });

  test('rejects unsupported issuers before target-path construction', () => {
    expect(() =>
      parseScraperArgs(['--issuer', '../../escape'], '/cards'),
    ).toThrow('지원하지 않는 카드사');
  });

  test('only allow-host may repeat and preserves host order', () => {
    const parsed = parseScraperArgs([
      '--allow-host',
      'first.example',
      '--issuer',
      'kb',
      '--allow-host',
      'second.example',
    ]);
    expect(parsed.allowHosts).toEqual([
      'first.example',
      'second.example',
    ]);

    const duplicateCases = [
      ['--issuer', 'kb', '--issuer', 'shinhan'],
      ['--issuer', 'kb', '--url', 'https://one.example', '--url', 'https://two.example'],
      ['--issuer', 'kb', '--output', 'one', '--output', 'two'],
      ['--issuer', 'kb', '--force', '--force'],
      ['--help', '-h'],
    ];
    for (const args of duplicateCases) {
      expect(() => parseScraperArgs(args)).toThrow(
        '옵션을 중복 지정할 수 없습니다',
      );
    }
  });

  test('help is issuer-optional but still validates the complete vector', () => {
    expect(parseScraperArgs(['--help'])).toMatchObject({ help: true });
    expect(parseScraperArgs(['-h'])).toMatchObject({ help: true });
    expect(() => parseScraperArgs(['--help', '--unknown'])).toThrow(
      '알 수 없는 옵션',
    );
    expect(() =>
      parseScraperArgs(['--help', '--issuer', '../invalid']),
    ).toThrow('지원하지 않는 카드사');
  });

  test('rejects missing values, unknown options, positionals, and null bytes', () => {
    expect(() => parseScraperArgs(['--issuer'], '/cards')).toThrow('값이 필요');
    expect(() =>
      parseScraperArgs(['--issuer', 'shinhan', '--unknown'], '/cards'),
    ).toThrow('알 수 없는 옵션');
    expect(() =>
      parseScraperArgs(['shinhan'], '/cards'),
    ).toThrow('위치 인수');
    expect(() =>
      parseScraperArgs(['--issuer', 'shinhan', '--output', 'bad\0path']),
    ).toThrow('널 바이트');
  });

  test('never accepts a credential through argv or echoes it in an error', () => {
    const secret = 'sk-ant-api03-do-not-print-this-secret';
    let thrown: unknown;
    try {
      parseScraperArgs([
        '--issuer',
        'shinhan',
        '--api-key',
        secret,
      ]);
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(Error);
    expect((thrown as Error).message).toContain('알 수 없는 옵션');
    expect((thrown as Error).message).not.toContain(secret);
  });

  test('generates complete direct and root help from one specification', () => {
    const direct = formatScrapeHelp('bun run tools/scraper/src/cli.ts');
    const root = formatScrapeHelp('cherrypicker scrape');
    for (const spec of SCRAPE_OPTION_SPECS) {
      expect(direct).toContain(spec.names[0]!);
      expect(root).toContain(spec.names[0]!);
    }
    expect(direct).toContain('packages/rules/data/cards');
    expect(direct).toContain('반복 가능');
    expect(root).toContain('cherrypicker scrape --issuer');
    for (const help of [direct, root]) {
      expect(help).toContain('ANTHROPIC_API_KEY');
      expect(help).toContain('ANTHROPIC_MODEL');
      expect(help).toContain('공식 호스트');
      expect(help).toContain('--allow-host');
      expect(help).toContain('--force');
      expect(help).not.toMatch(/sk-ant-[A-Za-z0-9_-]+/);
    }
    expect(
      direct.replaceAll('bun run tools/scraper/src/cli.ts', '<scrape>'),
    ).toBe(root.replaceAll('cherrypicker scrape', '<scrape>'));
  });
});
