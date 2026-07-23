import { describe, expect, test } from 'bun:test';
import { parseScraperArgs } from '@cherrypicker/scraper/args';
import { parseStatementCommandArgs } from '../src/command-options.js';
import {
  ROOT_HELP_EXAMPLES,
  formatRootHelp,
} from '../src/root-help.js';

describe('root CLI help examples', () => {
  test('every displayed example reaches its authoritative option parser', () => {
    for (const example of ROOT_HELP_EXAMPLES) {
      const parsed = example.command === 'scrape'
        ? parseScraperArgs(example.args)
        : parseStatementCommandArgs(example.command, example.args);

      expect(parsed.help).toBe(false);
      expect(formatRootHelp()).toContain(
        ['cherrypicker', example.command, ...example.args].join(' '),
      );
    }
  });

  test('advertises both compiled defaults and paired authoring overrides', () => {
    const optimizeExamples = ROOT_HELP_EXAMPLES.filter(
      ({ command }) => command === 'optimize',
    );

    expect(optimizeExamples).toContainEqual({
      command: 'optimize',
      args: ['statement.csv'],
    });
    expect(optimizeExamples).toContainEqual({
      command: 'optimize',
      args: [
        'statement.csv',
        '--categories',
        './categories.yaml',
        '--cards',
        './rules/',
      ],
    });
  });

  test('discloses scraper environment prerequisites beside scrape examples', () => {
    const help = formatRootHelp();

    expect(help).toContain('ANTHROPIC_API_KEY');
    expect(help).toContain('ANTHROPIC_MODEL');
    expect(help).not.toMatch(/sk-ant-[A-Za-z0-9_-]+/);
  });
});
