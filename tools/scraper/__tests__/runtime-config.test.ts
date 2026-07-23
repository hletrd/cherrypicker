import { describe, expect, test } from 'bun:test';
import {
  DEFAULT_ANTHROPIC_MODEL,
  resolveScraperRuntimeConfig,
} from '../src/runtime-config.js';

const VALID_API_KEY = 'sk-ant-api03-test-key-1234567890';

describe('scraper runtime configuration', () => {
  test('resolves a valid key and the default model without mutating input', () => {
    const environment = { ANTHROPIC_API_KEY: VALID_API_KEY };

    expect(resolveScraperRuntimeConfig(environment)).toEqual({
      apiKey: VALID_API_KEY,
      model: DEFAULT_ANTHROPIC_MODEL,
    });
    expect(environment).toEqual({ ANTHROPIC_API_KEY: VALID_API_KEY });
  });

  test('accepts a plausibly shaped explicit model override', () => {
    expect(resolveScraperRuntimeConfig({
      ANTHROPIC_API_KEY: VALID_API_KEY,
      ANTHROPIC_MODEL: 'claude-custom-20260724',
    })).toEqual({
      apiKey: VALID_API_KEY,
      model: 'claude-custom-20260724',
    });
  });

  test.each([
    ['missing', undefined],
    ['empty', ''],
    ['surrounding whitespace', ` ${VALID_API_KEY}`],
    ['wrong prefix', 'anthropic-secret-value-1234567890'],
    ['too short', 'sk-ant-short'],
    ['embedded whitespace', 'sk-ant-api03-secret value'],
  ])('rejects a %s API key without echoing it', (_label, apiKey) => {
    let thrown: unknown;
    try {
      resolveScraperRuntimeConfig({
        ...(apiKey === undefined ? {} : { ANTHROPIC_API_KEY: apiKey }),
      });
    } catch (error) {
      thrown = error;
    }

    expect(thrown).toBeInstanceOf(Error);
    const message = (thrown as Error).message;
    expect(message).toContain('ANTHROPIC_API_KEY');
    if (apiKey) expect(message).not.toContain(apiKey);
  });

  test.each(['', ' claude-sonnet-5', 'claude sonnet', 'bad\nmodel'])(
    'rejects unsafe model override %j without mentioning the API key',
    (model) => {
      expect(() =>
        resolveScraperRuntimeConfig({
          ANTHROPIC_API_KEY: VALID_API_KEY,
          ANTHROPIC_MODEL: model,
        }),
      ).toThrow('ANTHROPIC_MODEL');

      try {
        resolveScraperRuntimeConfig({
          ANTHROPIC_API_KEY: VALID_API_KEY,
          ANTHROPIC_MODEL: model,
        });
      } catch (error) {
        expect((error as Error).message).not.toContain(VALID_API_KEY);
      }
    },
  );
});
