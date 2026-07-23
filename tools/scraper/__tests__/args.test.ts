import { describe, expect, test } from 'bun:test';
import { parseScraperArgs } from '../src/args.js';

describe('parseScraperArgs', () => {
  test('uses no-overwrite and configured-host defaults', () => {
    expect(parseScraperArgs(['--issuer', 'shinhan'], '/cards')).toEqual({
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

  test('rejects missing values and unknown options', () => {
    expect(() => parseScraperArgs(['--issuer'], '/cards')).toThrow('값이 필요');
    expect(() =>
      parseScraperArgs(['--issuer', 'shinhan', '--unknown'], '/cards'),
    ).toThrow('알 수 없는 옵션');
  });
});
